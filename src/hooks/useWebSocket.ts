import { useEffect, useState } from 'react';
import { Arbitrage } from '@/interfaces';

const ApiWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";

const useWebSocket = () => {
  const [data, setData] = useState<Arbitrage[]>([]);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(ApiWsUrl);
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket conectado.');
      socket.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: false }));
    };

    socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.success && response.data) {
        setData(response.data || []);
      } else {
        console.error('Erro ao receber dados:', response.message);
      }
    };

    socket.onerror = (error) => {
      console.error('Erro no WebSocket:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket desconectado.');
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (autoUpdate && ws) {
      const sendMessage = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: true }));
        } else {
          ws.addEventListener(
            'open',
            () => {
              ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: true }));
            },
            { once: true }
          );
        }
      };

      sendMessage();
    }

    return () => {
      if (ws && autoUpdate) {
        ws.send(JSON.stringify({ method: 'stop' }));
      }
    };
  }, [autoUpdate, ws]);

  // Função para buscar os dados manualmente
  const fetchArbitrageData = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: false }));
      console.log('Dados de arbitragem atualizados manualmente.');
    } else {
      console.error('WebSocket não está conectado.');
    }
  };

  return { data, setData, setAutoUpdate, autoUpdate, fetchArbitrageData };
};

export default useWebSocket;