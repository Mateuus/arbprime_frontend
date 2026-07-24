/**
 * Cliente WS zap da bet365 — odds ao vivo DIRETO no browser (B2). PORTA do ZapLiveClient que funciona no
 * coletor (arbbetting_master/bet365.zap.ts): modelo SEQUENCIAL com fila (recv/queue), NÃO event-driven
 * com handlers async concorrentes (que geravam race e reconexão em loop).
 *
 * Transporte: `new WebSocket` direto — o Chrome real passa o Cloudflare do premws sem sidecar (provado
 * em Test/bet365_browser_ws_probe). O nst é mintado pelo backend (o browser não pode) — análogo do
 * rogueClient do 7games. O token vem do backend (live-token.service); os hooks (useBet365InstanceGames /
 * useBet365LiveEvent) abrem e fecham este stream no próprio useEffect, como as outras casas.
 *
 * HANDSHAKE (igual ao app real): abre → servidor manda `101<connId>` → respondemos com o handshake
 *   #\x03P\x01__time,P-ENDP,S_<pstk>,A_<nst>\x00  (nst mintado COM o connId → campo `g`, amarra à conexão)
 *   → servidor `100<connId>` → subscribe `\x16\x00<tópicos>,A_<nst>\x01`. Heartbeat 55s.
 * O token do 101 é REUSADO no subscribe (provado no E2E) — assim o subscribe sai na hora, sem um 2º
 * round-trip ao backend no meio do handshake (era o que fechava o WS e disparava o loop de reconexão).
 */
import { apiGateway } from '@/gateways/api.gateway';
import { getBet365BrowserProfile } from '@/services/nodelay/bet365Fingerprint';

const DEBUG_LIVE = false;   // true → loga o handshake do WS no console (diagnóstico do premws)
const HOST = 'premws-pt1.365lpodds.com';
const SUBPROTOCOL = 'zap-protocol-v2';
const HEARTBEAT_MS = 55_000;
const BASE_TOPICS = ['P-ENDP', 'P_CONFIG', 'OVInPlay_33_0', 'PVG_CONFIG_1', 'PV_CHARTS', 'PVG_IPPG'];

export interface Bet365LiveStream {
  subscribe: (topics: string[]) => void;
  close: () => void;
}

function newUid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < 16; i++) s += String(b[i] % 10);
  return s;
}

async function mintFromBackend(uid: string, conId: string): Promise<{ nst: string; pstk: string }> {
  // manda o perfil DESTE navegador → o device do token casa com quem abre o WS (senão premws=1000)
  const browser = await getBet365BrowserProfile();
  const r = await apiGateway.getBet365LiveToken(uid, conId, browser);
  if (r.data?.result !== 1) throw new Error(r.data?.message || 'token bet365 live');
  return r.data.data as { nst: string; pstk: string };
}

class ZapBrowserClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];               // frames recebidos aguardando (pré-streaming)
  private waiter: ((s: string) => void) | null = null;
  private streaming = false;                  // após o subscribe, os frames vão pro onFrame
  private closed = false;
  private hbTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = 1000;
  private uid = '';
  private connId = '';
  private nst = '';                           // token do 101, reusado no subscribe/heartbeat da conexão
  private wantTopics: Set<string>;

  constructor(
    private onFrame: (raw: string) => void,
    private opts: { extraTopics?: string[]; host?: string; onStatus?: (up: boolean) => void },
  ) {
    this.wantTopics = new Set([...BASE_TOPICS, ...(opts.extraTopics || [])]);
    void this.connect();
  }

  /** Próximo frame (só no handshake; depois vira streaming). Igual ao recv() do master. */
  private recv(timeoutMs = 15000): Promise<string> {
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => { this.waiter = null; reject(new Error('recv timeout')); }, timeoutMs);
      this.waiter = (s) => { clearTimeout(to); resolve(s); };
    });
  }
  private onMessage(raw: string) {
    if (this.streaming) { this.onFrame(raw); return; }
    if (this.waiter) { const w = this.waiter; this.waiter = null; w(raw); } else this.queue.push(raw);
  }

  private async connect() {
    if (this.closed) return;
    this.uid = newUid();
    this.connId = ''; this.nst = ''; this.queue = []; this.waiter = null;
    this.streaming = false;
    const host = this.opts.host || HOST;
    const t0 = Date.now();
    const dbg = (s: string) => { try { console.log(`[bet365-live +${Date.now() - t0}ms] ${s}`); } catch { /* */ } };
    dbg('abrindo WS…');
    const sock = new WebSocket(`wss://${host}/zap/?uid=${this.uid}`, SUBPROTOCOL);
    this.ws = sock;
    sock.onmessage = (ev) => this.onMessage(String(ev.data));
    sock.onclose = (ev) => { dbg(`onclose code=${ev.code} reason="${ev.reason}" clean=${ev.wasClean} streaming=${this.streaming}`); this.onClose(); };
    sock.onerror = () => { dbg('onerror'); try { sock.close(); } catch { /* */ } };

    try {
      // espera abrir (o 101 que chegar nesse meio já cai na fila via onmessage)
      await new Promise<void>((res, rej) => {
        const to = setTimeout(() => rej(new Error('open timeout')), 12000);
        sock.onopen = () => { clearTimeout(to); dbg('WS aberto (101 http)'); res(); };
      });
      if (this.closed) { try { sock.close(); } catch { /* */ } return; } // StrictMode fechou durante o await

      // HANDSHAKE sequencial: 101 → mint(+conId) → handshake COMPLETO (S_+A_) → 100.
      let connected = false;
      for (let step = 0; step < 4; step++) {
        const msg = await this.recv(15000);
        if (this.closed) { try { sock.close(); } catch { /* */ } return; }
        const head = msg.split('\x03')[0].split('\x02');
        const code = head[0];
        this.connId = (head[1] || '').split('\x00')[0];
        dbg(`recv frame code=${code} conn=${this.connId}`);
        if (code === '100') { connected = true; break; }
        if (code === '101') {
          const { nst, pstk } = await mintFromBackend(this.uid, this.connId);
          if (this.closed) { try { sock.close(); } catch { /* */ } return; }
          dbg(`token mintado (${nst.length}b), ws.readyState=${sock.readyState}`);
          if (sock.readyState !== WebSocket.OPEN) throw new Error('ws fechou no handshake');
          sock.send('#\x03P\x01__time,P-ENDP,S_' + pstk + ',A_' + nst + '\x00');
          dbg('handshake enviado');
          continue;
        }
        throw new Error('handshake inesperado: ' + JSON.stringify(msg.slice(0, 16)));
      }
      if (!connected) throw new Error('handshake não convergiu');

      // SUBSCRIBE: token FRESCO amarrado ao conId (IGUAL ao master — o servidor REJEITA um token reusado
      // do 101 e fecha a conexão com CLOSE 1000; o app real minta um nst novo por frame).
      const { nst: subNst } = await mintFromBackend(this.uid, this.connId);
      if (this.closed) { try { sock.close(); } catch { /* */ } return; }
      if (sock.readyState !== WebSocket.OPEN) throw new Error('ws fechou antes do subscribe');
      this.nst = subNst;
      sock.send('\x16\x00' + [...this.wantTopics].join(',') + ',A_' + subNst + '\x01');
      dbg('subscribe enviado (token fresco) → STREAMING');
      this.streaming = true;
      this.backoff = 1000;
      this.opts.onStatus?.(true);
      for (const q of this.queue.splice(0)) this.onFrame(q); // drena o que chegou durante o subscribe
      this.startHeartbeat();
    } catch (e) {
      dbg('handshake FALHOU: ' + ((e as Error)?.message || e));
      try { sock.close(); } catch { /* */ } // onClose reconecta com backoff
    }
  }

  private onClose() {
    this.stopHeartbeat();
    this.streaming = false;
    this.opts.onStatus?.(false);
    if (!this.closed) { setTimeout(() => this.connect(), this.backoff); this.backoff = Math.min(this.backoff * 2, 15000); }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // heartbeat: re-assina vazio com token FRESCO (como o app real), a cada 55s.
    this.hbTimer = setInterval(async () => {
      try {
        const { nst } = await mintFromBackend(this.uid, this.connId);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send('\x16\x00A_' + nst + '\x01');
      } catch { /* */ }
    }, HEARTBEAT_MS);
  }
  private stopHeartbeat() { if (this.hbTimer) { clearInterval(this.hbTimer); this.hbTimer = null; } }

  /** Assina tópicos extras na conexão viva (ex.: a ficha de um jogo). Minta fresco com o conId corrente. */
  async addTopics(topics: string[]) {
    const novos = topics.filter((t) => !this.wantTopics.has(t));
    for (const t of novos) this.wantTopics.add(t);
    if (!novos.length || !this.streaming || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const { nst } = await mintFromBackend(this.uid, this.connId);
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send('\x16\x00' + novos.join(',') + ',A_' + nst + '\x01');
    } catch { /* a próxima reconexão já leva os tópicos */ }
  }

  close() {
    this.closed = true;
    this.stopHeartbeat();
    try { this.ws?.send('\x1d\x00'); } catch { /* */ }
    try { this.ws?.close(); } catch { /* */ }
  }
}

/**
 * Pré-aquece a sessão do backend para ESTE navegador — chamado na ENTRADA da instância bet365, para o
 * WS abrir rápido depois na aba live. Coleta o perfil (cacheado) e minta um token descartável, o que
 * dispara o collectState + activateGeo + bumpIr no backend (a parte lenta ~1.5s), já com o device do
 * navegador. Best-effort: erro aqui não quebra nada (o WS re-minta na hora).
 */
export async function prewarmBet365Live(): Promise<void> {
  try { await mintFromBackend(newUid(), ''); } catch { /* best-effort */ }
}

/** Abre a stream zap e chama `onFrame(raw)` para cada frame. Reconecta sozinha. */
export function openBet365LiveStream(
  onFrame: (raw: string) => void,
  opts: { extraTopics?: string[]; host?: string; onStatus?: (up: boolean) => void } = {},
): Bet365LiveStream {
  const client = new ZapBrowserClient(onFrame, opts);
  return {
    subscribe: (topics: string[]) => { void client.addTopics(topics); },
    close: () => client.close(),
  };
}
