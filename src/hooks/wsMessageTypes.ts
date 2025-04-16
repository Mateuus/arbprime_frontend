// Tipos específicos
export interface MonitorPairsResponse {
    success: boolean;
    method: 'monitor_pairs';
    data: {
      symbol: string;
      dataA: MarketData[];
      dataB: MarketData[];
      spread: number;
      profit: number;
      profitNet: number;
      totalFees: number;
      volume: number;
      timestamp: number;
    };
  }
  
  export interface MarketData {
    market: 'spot' | 'future';
    exchange: string;
    ask: number;
    bid: number;
    volume: number;
  }
  
  // Aqui podem entrar mais tipos: ArbitragePairsResponse, etc
  type WebSocketMessage =
    | MonitorPairsResponse // | ArbitragePairsResponse | Outros futuros
  
  export type MessageHandlers = {
    [K in WebSocketMessage['method']]: (
      data: Extract<WebSocketMessage, { method: K }>
    ) => void;
  };
  
  // Type guard genérico por método
  export function isTypedMessage<K extends WebSocketMessage['method']>(
    msg: unknown,
    method: K
  ): msg is Extract<WebSocketMessage, { method: K }> {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'method' in msg &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (msg as any).method === method
    );
  }
  