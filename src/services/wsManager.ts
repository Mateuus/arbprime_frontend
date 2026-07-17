import { serverManager } from '@/services/serverManager';

type WSCallback = (data: unknown) => void;

/**
 * Gerenciador de WebSocket robusto.
 *
 * Correção do bug "Failed to execute 'send' on 'WebSocket': Still in CONNECTING
 * state": NUNCA chamamos `send()` num socket que ainda não abriu. As mensagens
 * são enfileiradas e descarregadas no evento `open`. Mensagens com `method`
 * (assinaturas, ex.: arbitrage_betting) ficam "sticky" e são reenviadas a cada
 * (re)conexão — então trocar de token ou cair e reconectar re-inscreve sozinho.
 */
class WSManager {
  private ws: WebSocket | null = null;
  private listeners: WSCallback[] = [];
  private token = 'anonymous';
  private activeUnsub: (() => void) | null = null;

  // Resiliência de reconexão (mobile: a rede oscila e a aba vai a background).
  private wantConnected = false;                 // queremos estar conectados?
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private retries = 0;                           // p/ backoff exponencial
  private netListenersBound = false;

  /** Base do WS é resolvida pelo servidor ativo (failover/seleção). */
  private get urlBase() {
    return serverManager.getWsBase() || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
  }

  /**
   * Reconecta no novo servidor mantendo token e assinaturas (sticky). Chamado
   * quando o serverManager troca o servidor ativo (escolha do usuário ou
   * failover automático).
   */
  private switchServer = () => {
    if (!this.ws) return; // ainda não conectou: nada a fazer
    this.closeSocket();
    this.connect(this.token);
  };

  // Assinaturas por método (reenviadas em toda reconexão).
  private sticky = new Map<string, string>();
  // Mensagens avulsas (sem método) pendentes até a conexão abrir.
  private outbox: string[] = [];

  private get isOpen() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(token: string = 'anonymous') {
    // Liga o monitor de servidores e escuta trocas de servidor ativo (1x).
    serverManager.init();
    if (!this.activeUnsub) {
      this.activeUnsub = serverManager.onActiveChange(this.switchServer);
    }

    // Já conectado/conectando com o MESMO token → não recria.
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (token === this.token) return;
      this.closeSocket(); // token mudou → troca a conexão
    }

    this.token = token;
    this.wantConnected = true;
    this.bindNetListeners();
    const ws = new WebSocket(`${this.urlBase}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    // Watchdog do handshake: se o socket não ABRIR em 12s (rede móvel presa,
    // captive portal, servidor mudo), derruba e reagenda — senão a página fica
    // "Carregando..." pra sempre. Só cobre o handshake: a mensagem grande (5MB
    // dos surebets) chega DEPOIS do open, então um download lento não dispara.
    if (this.openTimer) clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
        this.closeSocket();
        this.scheduleReconnect();
      }
    }, 12000);

    ws.onopen = () => {
      if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
      this.retries = 0; // conexão boa → zera o backoff
      // (Re)inscreve as assinaturas e descarrega a fila avulsa.
      this.sticky.forEach((msg) => this.rawSend(msg));
      const pending = this.outbox;
      this.outbox = [];
      pending.forEach((msg) => this.rawSend(msg));
    };

    ws.onmessage = (event) => {
      let msg: unknown;
      try { msg = JSON.parse(event.data); } catch { return; }
      this.listeners.forEach((cb) => cb(msg));
    };

    // Caiu (troca wifi↔4G, tela apagou, servidor reiniciou): reconecta com
    // backoff enquanto quisermos estar conectados. Mantém sticky/listeners.
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
      this.scheduleReconnect();
    };
    ws.onerror = () => { /* silencioso: o navegador já loga; o onclose reagenda */ };
  }

  /** Reagenda a reconexão com backoff exponencial (cap 15s). */
  private scheduleReconnect() {
    if (!this.wantConnected || this.reconnectTimer || this.isOpen) return;
    const delay = Math.min(1000 * 2 ** this.retries, 15000);
    this.retries++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wantConnected && !this.isOpen) this.connect(this.token);
    }, delay);
  }

  /** Reconecta JÁ (rede voltou / aba ficou visível), zerando o backoff. */
  private kick = () => {
    if (!this.wantConnected || this.isOpen) return;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return; // já a caminho
    this.retries = 0;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.connect(this.token);
  };

  /** Reconecta ao voltar de background (celular) ou quando a rede volta (1x). */
  private bindNetListeners() {
    if (this.netListenersBound || typeof window === 'undefined') return;
    this.netListenersBound = true;
    window.addEventListener('online', this.kick);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.kick();
    });
  }

  public reconnect(newToken: string) {
    if (newToken === this.token && this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // nada muda
    }
    this.closeSocket();
    this.connect(newToken);
  }

  /** Envia (ou enfileira) uma mensagem. Mensagens com `method` viram sticky. */
  public send(data: unknown) {
    const msg = JSON.stringify(data);
    const method = (data as { method?: string })?.method;
    if (method) this.sticky.set(method, msg);

    if (this.isOpen) {
      this.rawSend(msg);
      return;
    }
    if (!method) this.outbox.push(msg);
    // Garante que há uma conexão a caminho.
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect(this.token);
    }
  }

  /** Compat: resolve quando a mensagem foi (ou será) enviada. */
  public async sendWhenReady(data: unknown): Promise<void> {
    this.send(data);
  }

  private rawSend(msg: string) {
    try {
      this.ws?.send(msg);
    } catch {
      // Se falhar (corrida rara), reenfileira para o próximo open.
      this.outbox.push(msg);
    }
  }

  public subscribe(cb: WSCallback) {
    this.listeners.push(cb);
  }

  public unsubscribe(cb: WSCallback) {
    this.listeners = this.listeners.filter((fn) => fn !== cb);
  }

  /** Fecha o socket atual mantendo listeners/sticky (para reconexão). */
  private closeSocket() {
    if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
  }

  /** Teardown completo (logout): fecha e limpa tudo. */
  public disconnect() {
    this.wantConnected = false; // desliga a reconexão automática (logout)
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.closeSocket();
    this.listeners = [];
    this.sticky.clear();
    this.outbox = [];
  }
}

export const wsManager = new WSManager();
