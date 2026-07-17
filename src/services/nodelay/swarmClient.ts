/**
 * Cliente do protocolo "swarm" (BetConstruct/FssBio) — 7games, betão, 7k,
 * apostatudo. Casas desse grupo falam o MESMO protocolo e só mudam a wssUrl,
 * por isso o endereço vem da config admin da casa, não hardcoded aqui.
 *
 * Roda NO BROWSER de propósito: a conexão sai da máquina do apostador direto
 * para a casa, sem hop pelo nosso backend. É isso que dá o "no delay" — e de
 * quebra a casa vê o IP residencial dele, não o do nosso servidor.
 *
 * Protocolo: JSON sobre WebSocket, request/response correlacionados por `rid`.
 *   → {"command":"login","params":{...},"rid":"<uuid>"}
 *   ← {"code":0,"rid":"<uuid>","data":{...}}
 * `code` 0 = sucesso; qualquer outro = erro (a casa manda `data` como string).
 *
 * ⚠️ O browser define o header `Origin` sozinho (será a origem do ArbPrime).
 * Se a casa validar Origin no handshake, a conexão direta será recusada e o
 * caminho terá de mudar (extensão MV3 ou app local). Não dá para contornar por
 * JS — está documentado aqui porque é o risco #1 desta arquitetura.
 */

export interface SwarmConfig {
  wssUrl: string;
  siteId?: string | null;
  source?: number | null;
  language?: string | null;
}

export interface SwarmLoginResult {
  userId: string;
  authToken: string;
  jweToken: string | null;
  raw: Record<string, unknown>;
}

/** Saldo lido do perfil. Campos confirmados no probe da 7games (Test/7games). */
export interface SwarmBalance {
  balance: number;
  currency: string;
  bonusBalance: number | null;
  frozenBalance: number | null;
}

export type SwarmErrorKind =
  | 'connect'        // não abriu o WebSocket (rede/Origin/casa fora)
  | 'timeout'        // conectou mas a casa não respondeu no prazo
  | 'rejected'       // credenciais recusadas
  | 'mfa_required'   // a casa pediu 2FA
  | 'protocol';      // resposta fora do formato esperado

export class SwarmError extends Error {
  readonly kind: SwarmErrorKind;
  readonly code?: number;

  constructor(kind: SwarmErrorKind, message: string, code?: number) {
    super(message);
    this.name = 'SwarmError';
    this.kind = kind;
    this.code = code;
  }
}

interface SwarmResponse {
  code: number;
  rid?: string;
  data?: unknown;
  msg?: string;
}

/**
 * Extrai o motivo do erro. A casa é inconsistente: às vezes `data` é string,
 * às vezes objeto `{status, details}` (ex.: restore_login com token velho →
 * `{status:1006, details:"Token de cliente errado"}`), e ainda há `msg`.
 */
function errorDetail(r: SwarmResponse): string {
  const d = r.data;
  if (typeof d === 'string' && d) return d;
  if (d && typeof d === 'object') {
    const o = d as { details?: unknown; message?: unknown };
    if (typeof o.details === 'string' && o.details) return o.details;
    if (typeof o.message === 'string' && o.message) return o.message;
  }
  return r.msg || '';
}

/** code do swarm p/ credencial/token inválido (confirmado no probe). */
const CODE_INVALID_CREDENTIALS = 12;

const CONNECT_TIMEOUT_MS = 12_000;
const COMMAND_TIMEOUT_MS = 15_000;

/** Carimbo de build que o site manda no request_session (ver requestSession). */
const RELEASE_DATE = 'Mon Mar 09 2026 16:46:16 GMT+0400 (Armenia Standard Time)';

const newRid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class SwarmClient {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<string, { resolve: (r: SwarmResponse) => void; reject: (e: Error) => void; timer: number }>();
  /** subid → handler do delta (ver dispatchPush). */
  private readonly subs = new Map<string, (delta: unknown) => void>();
  private closedByUs = false;

  constructor(private readonly config: SwarmConfig) {}

  /**
   * Avisa quando a conexão cai. É uma LISTA, não um callback só: a conexão de
   * odds é compartilhada (o serviço quer limpar o cache, cada hook quer
   * reassinar). Com um callback único, o último a registrar apagava o outro.
   */
  private readonly disconnectListeners = new Set<() => void>();

  /** Registra um ouvinte de queda. Devolve a função que o remove. */
  onDisconnect(fn: () => void): () => void {
    this.disconnectListeners.add(fn);
    return () => this.disconnectListeners.delete(fn);
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Abre o WebSocket. Rejeita com SwarmError('connect') se não subir. */
  connect(): Promise<void> {
    if (this.isOpen) return Promise.resolve();

    return new Promise((resolve, reject) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.config.wssUrl);
      } catch (e) {
        reject(new SwarmError('connect', `URL de WebSocket inválida: ${(e as Error).message}`));
        return;
      }
      this.ws = ws;
      this.closedByUs = false;

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* já morreu */ }
        reject(new SwarmError('connect', 'A casa não respondeu ao abrir a conexão (12s).'));
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        // O browser não expõe o motivo do erro de WS (política de segurança):
        // pode ser rede, a casa fora do ar, ou Origin recusado no handshake.
        reject(new SwarmError('connect', 'Não foi possível conectar na casa. Verifique sua conexão e tente de novo.'));
      };

      ws.onmessage = (ev) => this.onMessage(ev);

      ws.onclose = () => {
        // Derruba quem estava esperando resposta — senão a promise pendura.
        const err = new SwarmError('connect', 'A conexão com a casa caiu.');
        for (const [, p] of this.pending) {
          window.clearTimeout(p.timer);
          p.reject(err);
        }
        this.pending.clear();
        // As assinaturas morrem com o socket: os subids do servidor não valem
        // mais. Quem reconectar tem que assinar de novo.
        this.subs.clear();
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          reject(err);
        }
        if (!this.closedByUs) {
          for (const fn of [...this.disconnectListeners]) {
            try { fn(); } catch { /* um ouvinte ruim não pode calar os outros */ }
          }
        }
      };
    });
  }

  private onMessage(ev: MessageEvent) {
    let msg: SwarmResponse;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return; // frame não-JSON (keep-alive etc.) — ignora
    }

    const rid = msg?.rid;
    if (rid && this.pending.has(rid)) {
      const p = this.pending.get(rid)!;
      this.pending.delete(rid);
      window.clearTimeout(p.timer);
      p.resolve(msg);
      return;
    }

    // Não é resposta a comando nosso ⇒ é push de assinatura.
    // ATENÇÃO: o push vem com `rid:"0"` (não vazio!), então NÃO dá pra detectar
    // push por "rid ausente" — é por "rid não está pendente". Errar isso faz o
    // delta de odd ser descartado em silêncio.
    this.dispatchPush(msg);
  }

  /**
   * Roteia o delta de uma assinatura. Formato real (probe):
   *   {code:0, rid:"0", data:{ "<subid>": { event: { "<eventId>": {price: 6.2} } } }}
   * Só os campos que MUDARAM vêm — quem recebe faz merge no estado local.
   */
  private dispatchPush(msg: SwarmResponse) {
    const data = msg?.data;
    if (!data || typeof data !== 'object') return;
    for (const [subid, delta] of Object.entries(data as Record<string, unknown>)) {
      const h = this.subs.get(subid);
      if (h) h(delta);
    }
  }

  /** Envia um comando e espera a resposta com o mesmo `rid`. */
  send(command: string, params: Record<string, unknown> = {}): Promise<SwarmResponse> {
    if (!this.isOpen) {
      return Promise.reject(new SwarmError('connect', 'Conexão não está aberta.'));
    }

    const rid = newRid();
    return new Promise<SwarmResponse>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(rid);
        reject(new SwarmError('timeout', `A casa não respondeu ao comando '${command}'.`));
      }, COMMAND_TIMEOUT_MS);

      this.pending.set(rid, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify({ command, params, rid }));
      } catch (e) {
        this.pending.delete(rid);
        window.clearTimeout(timer);
        reject(new SwarmError('connect', `Falha ao enviar '${command}': ${(e as Error).message}`));
      }
    });
  }

  /**
   * Handshake de sessão — OBRIGATÓRIO. O swarm exige uma sessão antes de
   * qualquer comando; sem isto o `login` volta "Invalid session".
   *
   * Params confirmados ao vivo (Test/7games/7games_swarm_probe.ts): o site_id é
   * o partner_id da casa (7games = 18751367) e o idioma é 'pt-br'. Sem o site_id
   * certo a casa recusa a sessão — pegue-o em DevTools → Network → WS → 1º frame.
   * `release_date` é o carimbo de build que o site manda; replicado porque o
   * fluxo foi validado com ele.
   */
  async requestSession(): Promise<void> {
    const r = await this.send('request_session', {
      site_id: this.config.siteId ? Number(this.config.siteId) : null,
      language: this.config.language || 'pt-br',
      source: this.config.source ?? 42,
      release_date: RELEASE_DATE,
    });
    if (r.code !== 0) {
      const detail = errorDetail(r);
      throw new SwarmError(
        'protocol',
        `A casa recusou abrir a sessão${detail ? `: ${detail}` : ` (code ${r.code})`}. Confira o site_id na configuração da casa.`,
        r.code,
      );
    }
  }

  /**
   * Revalida uma sessão salva num socket NOVO, sem a senha. É o que responde
   * "a conta ainda está logada?" no botão Atualizar.
   *
   * Confirmado no probe (Test/7games/7games_swarm_restore_probe.ts):
   *   token bom      → code 0 (e o `get profile` volta a funcionar)
   *   token vencido  → code 12 {status:1006,"Token de cliente errado"}
   * Por isso o retorno é tri-estado: quem chama precisa separar "caiu" (esperado,
   * é só relogar) de "deu ruim" (rede/casa fora — não mexer no status da conta).
   */
  async restoreLogin(userId: string, authToken: string): Promise<'ok' | 'expired'> {
    await this.connect();
    await this.requestSession();

    const r = await this.send('restore_login', { user_id: Number(userId), auth_token: authToken });
    if (r.code === 0) return 'ok';
    if (r.code === CODE_INVALID_CREDENTIALS) return 'expired';

    throw new SwarmError('protocol', errorDetail(r) || `Não deu para validar a sessão (code ${r.code}).`, r.code);
  }

  /** Conecta (se preciso), abre sessão e loga. Devolve os tokens da casa. */
  async login(username: string, password: string): Promise<SwarmLoginResult> {
    await this.connect();
    await this.requestSession();

    const r = await this.send('login', {
      username,
      password,
      encrypted_token: true,
      login_type: 2,
    });

    if (r.code !== 0) {
      const detail = errorDetail(r);
      if (/2fa|two.?factor|verification|sms|código/i.test(detail)) {
        throw new SwarmError('mfa_required', 'A conta exige verificação em duas etapas — ainda não suportada no NoDelay.', r.code);
      }
      throw new SwarmError('rejected', detail || `Login recusado pela casa (code ${r.code}).`, r.code);
    }

    const d = (r.data || {}) as Record<string, unknown>;
    const authToken = typeof d.auth_token === 'string' ? d.auth_token : '';
    if (!authToken) {
      throw new SwarmError('protocol', 'A casa aceitou o login mas não devolveu o auth_token.');
    }

    return {
      userId: d.user_id != null ? String(d.user_id) : '',
      authToken,
      jweToken: typeof d.jwe_token === 'string' ? d.jwe_token : null,
      raw: d,
    };
  }

  /**
   * Lê o saldo pelo perfil do usuário logado. Formato confirmado no probe:
   *   { code:0, data:{ data:{ profile:{ "<user_id>": { balance, currency, … } } } } }
   * — repare no `data.data` aninhado e no perfil CHAVEADO pelo user_id.
   *
   * `subscribe:false` = só um retrato. Quando o disparo mantiver o socket vivo,
   * `subscribe:true` faz a casa empurrar o saldo a cada mudança (sem polling).
   */
  async getBalance(userId: string): Promise<SwarmBalance | null> {
    const r = await this.send('get', {
      source: 'user',
      what: { profile: [] },
      subscribe: false,
    });
    if (r.code !== 0) return null;

    const profiles = (r.data as { data?: { profile?: Record<string, Record<string, unknown>> } })?.data?.profile;
    if (!profiles) return null;

    // Chaveado pelo user_id; se vier só um, aceita o primeiro (defensivo).
    const p = profiles[userId] ?? Object.values(profiles)[0];
    if (!p || typeof p.balance !== 'number') return null;

    return {
      balance: p.balance,
      currency: typeof p.currency === 'string' ? p.currency : 'BRL',
      bonusBalance: typeof p.bonus_balance === 'number' ? p.bonus_balance : null,
      frozenBalance: typeof p.frozen_balance === 'number' ? p.frozen_balance : null,
    };
  }

  // ---------------------------------------------------------------------------
  // (As odds ao vivo NÃO vêm mais do swarm — o swarm dava livro diferente/pior.
  //  Migraram para a ROGUE SSE, ver services/nodelay/rogueClient. O swarm ficou
  //  só para conta: login, saldo e restore_login.)

  /** Logout educado na casa. Nunca lança — desconectar não pode falhar a UI. */
  async logout(): Promise<void> {
    if (!this.isOpen) return;
    try {
      await this.send('logout', {});
    } catch {
      /* a casa não respondeu; fechar o socket já resolve do nosso lado */
    }
  }

  close(): void {
    this.closedByUs = true;
    try {
      this.ws?.close();
    } catch {
      /* já fechado */
    }
    this.ws = null;
  }

  /** Foi fechada por nós (≠ queda da casa)? Útil para decidir se reconecta. */
  get wasClosedByUs(): boolean {
    return this.closedByUs;
  }
}

/**
 * Loga e já lê o saldo NA MESMA conexão, depois descarta. É o caminho usado ao
 * cadastrar/reconectar uma conta pelo painel — o saldo sai de graça aqui, porque
 * reabrir o socket só pra ler saldo custaria outro handshake+login.
 *
 * Na fase de disparo (apostar), o socket fica ABERTO por conta — reconectar na
 * hora da aposta jogaria fora justamente o tempo que a feature existe pra ganhar.
 */
export async function swarmLoginOnce(
  config: SwarmConfig,
  username: string,
  password: string,
): Promise<SwarmLoginResult & { balance: SwarmBalance | null }> {
  const client = new SwarmClient(config);
  try {
    const login = await client.login(username, password);
    // Saldo é um bônus: se falhar, a conta conectou do mesmo jeito.
    let balance: SwarmBalance | null = null;
    try {
      balance = await client.getBalance(login.userId);
    } catch {
      /* segue sem saldo — a UI mostra '—' */
    }
    return { ...login, balance };
  } finally {
    client.close();
  }
}
