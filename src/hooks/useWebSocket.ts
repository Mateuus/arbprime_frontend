import { useEffect, useState } from 'react';
import { SurebetData, Arbitrage } from '@/interfaces';
import { wsManager } from '@/services/wsManager';

type WebSocketMethod = 'arbitrage_betting' | 'arbitrage_pairs' | 'monitor_pairs';

interface UseWebSocketOptions {
  method: WebSocketMethod;
  options?: Record<string, unknown>;
  autoUpdate?: boolean;
}

function getCookieValue(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}

const useWebSocket = ({
  method,
  options = {},
  autoUpdate = false,
}: UseWebSocketOptions) => {
  const [dataBet, setDataBet] = useState<SurebetData[]>([]);
  const [data, setData] = useState<Arbitrage[]>([]);

  // Conectar com token do cookie
  useEffect(() => {
    const cookieToken = getCookieValue('MToken');
    if (cookieToken) {
      wsManager.connect(cookieToken);
    } else {
      console.warn('[WS] Token MToken não encontrado nos cookies.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMessage = (msg: any) => {
      if (!msg?.method || !msg?.data) return;

      switch (msg.method) {
        case 'arbitrage_betting':
          setDataBet(msg.data || []);
          break;
        case 'arbitrage_pairs':
        case 'monitor_pairs':
          setData(msg.data || []);
          break;
        default:
          console.warn('[WS] Método desconhecido:', msg.method);
      }
    };

    wsManager.subscribe(handleMessage);
    wsManager.send({ method, options: { ...options, autoUpdate } });

    return () => {
      wsManager.unsubscribe(handleMessage);
    };
  }, [method, autoUpdate, options]);

  const fetchManual = () => {
    wsManager.send({ method, options: { ...options, autoUpdate: false } });
  };

  return {
    data,
    dataBet,
    setData,
    setDataBet,
    fetchManual,
    send: wsManager.send.bind(wsManager),
  };
};

export default useWebSocket;