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
    const ws = new WebSocket(`${this.urlBase}?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
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

    ws.onclose = () => { /* mantém sticky/listeners para reconectar */ };
    ws.onerror = () => { /* silencioso: o navegador já loga */ };
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
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
  }

  /** Teardown completo (logout): fecha e limpa tudo. */
  public disconnect() {
    this.closeSocket();
    this.listeners = [];
    this.sticky.clear();
    this.outbox = [];
  }
}

export const wsManager = new WSManager();
