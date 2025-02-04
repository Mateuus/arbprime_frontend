import { Arbitrage } from '@/interfaces';

const ApiWsUrl = "ws://172.22.83.251:8080";
let ws: WebSocket;
let arbitrageCallback: (data: Arbitrage[]) => void;

const connectWebSocket = () => {
  ws = new WebSocket(ApiWsUrl);

  ws.onopen = () => {
    console.log("Conectado ao WebSocket");
    ws.send(JSON.stringify({
      method: "arbitrage_pairs",
      marketType: "spot",
      limit: 10,
    }));
  };

  ws.onmessage = (event) => {
    const parsedData = JSON.parse(event.data) as { success: boolean; data: Arbitrage[] };
    console.log("Dados recebidos do WebSocket:", parsedData);

    if (parsedData.success && arbitrageCallback) {
      arbitrageCallback(parsedData.data); // Atualiza os dados via callback
    }
  };

  ws.onclose = () => {
    console.log("WebSocket desconectado. Tentando reconectar...");
    setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (error) => {
    console.error("Erro no WebSocket:", error);
  };
};

export const startWebSocketConnection = (callback: (data: Arbitrage[]) => void) => {
  arbitrageCallback = callback; // Registra o callback
  connectWebSocket();
};
