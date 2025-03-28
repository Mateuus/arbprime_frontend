import { useEffect, useState } from 'react';
import { Arbitrage, SurebetData } from '@/interfaces';

const ApiWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:8080";

const useWebSocket = (id: number = 0) => {
  const [data, setData] = useState<Arbitrage[]>([]);
  const [dataBet, setDataBet] = useState<SurebetData[]>([]);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(ApiWsUrl);
    setWs(socket);

    socket.onopen = () => {
      console.log('WebSocket conectado.');
      if(id === 0) {
        socket.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: false }));
      } else {
        socket.send(JSON.stringify({ method: 'arbitrage_betting', autoUpdate: false }));
      }
    };

    socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.success && response.data) {
        if(response.method === 'arbitrage_pairs' || response.method === 'monitor_pairs') {
          setData(response.data || []);
        } else if(response.method === 'arbitrage_betting') {
          setDataBet(response.data || []);
        }
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
  }, [id]);

  useEffect(() => {
    if (autoUpdate && ws) {
      const sendMessage = () => {
        if (ws.readyState === WebSocket.OPEN) {
          if(id === 0) {
           ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: true }));
          } else if (id === 1) {
            ws.send(JSON.stringify({ method: 'arbitrage_betting', autoUpdate: true }));
          }
        } else {
          ws.addEventListener(
            'open',
            () => {
              if(id === 0) {
                ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: true }));
               } else if (id === 1) {
                 ws.send(JSON.stringify({ method: 'arbitrage_betting', autoUpdate: true }));
               }
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
  }, [id, autoUpdate, ws]);

  // Função para buscar os dados manualmente
  const fetchArbitrageData = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: 'arbitrage_pairs', autoUpdate: false }));
      console.log('Dados de arbitragem atualizados manualmente.');
    } else {
      console.error('WebSocket não está conectado.');
    }
  };

  return { data, dataBet, setData, setAutoUpdate, autoUpdate, fetchArbitrageData };
};

export default useWebSocket;