type WSCallback = (data: unknown) => void;

class WSManager {
  private ws: WebSocket | null = null;
  private listeners: WSCallback[] = [];
  private urlBase = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
  private connected = false;
  private token: string = 'anonymous';

  public connect(token: string = 'anonymous') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.token = token;
    const url = `${this.urlBase}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[WS] Conectado com token:', this.token);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.listeners.forEach((cb) => cb(msg));
    };

    this.ws.onclose = () => {
      this.connected = false;
      console.warn('[WS] Conexão encerrada.');
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Erro:', err);
    };
  }

  public reconnect(newToken: string) {
    this.disconnect();
    this.connect(newToken);
  }

  public send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Ainda não conectado. Aguardando abrir...');
  
      const sendWhenReady = () => {
        this.ws?.send(JSON.stringify(data));
        console.log('[WS] Mensagem enviada após conexão:', data);
      };
  
      // Se estiver "connecting", escuta o evento
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.addEventListener('open', sendWhenReady, { once: true });
      } else {
        // Se a conexão nem existir ainda, tenta reconectar e então enviar
        this.connect(this.token); // reconecta
        this.ws?.addEventListener('open', sendWhenReady, { once: true });
      }
    }
  }
  

  public subscribe(cb: WSCallback) {
    this.listeners.push(cb);
  }

  public unsubscribe(cb: WSCallback) {
    this.listeners = this.listeners.filter(fn => fn !== cb);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.listeners = [];
    }
  }
}

export const wsManager = new WSManager();
