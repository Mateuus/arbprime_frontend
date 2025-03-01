interface WebSocketParams {
    method: string;
    [key: string]: string | boolean | number; // Define que os campos dinâmicos podem ser string, boolean ou number
}
  
interface WebSocketResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
}
  
export class WebSocketClient {
    private static readonly DEFAULT_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080"; // URL padrão do WebSocket
    private socket: WebSocket | null = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
  
    constructor(private url: string = WebSocketClient.DEFAULT_URL) {}
  
    connect<T = unknown>(
      params: WebSocketParams,
      onMessage: (data: WebSocketResponse<T>) => void,
      autoReconnect = true
    ): void {
      this.socket = new WebSocket(this.url);
  
      this.socket.onopen = () => {
        console.log('WebSocket conectado.');
        this.send(params);
      };
  
      this.socket.onmessage = (event) => {
        const response: WebSocketResponse<T> = JSON.parse(event.data);
        onMessage(response);
      };
  
      this.socket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
  
      this.socket.onclose = () => {
        console.log('WebSocket desconectado.');
        if (autoReconnect) {
          this.reconnect(params, onMessage);
        }
      };
    }
  
    private reconnect<T>(
      params: WebSocketParams,
      onMessage: (data: WebSocketResponse<T>) => void
    ): void {
      if (!this.reconnectInterval) {
        console.log('Tentando reconectar...');
        this.reconnectInterval = setInterval(() => {
          this.connect(params, onMessage);
        }, 5000);
      }
    }
  
    disconnect(): void {
      if (this.socket) {
        this.socket.close();
      }
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }
  
    send(data: WebSocketParams): void {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
      } else {
        console.error('WebSocket não está conectado.');
      }
    }
  }