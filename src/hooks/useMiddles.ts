import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { MiddleData } from '@/interfaces/middle.interface';

/**
 * Assina o WebSocket `middles` e devolve os grupos de middles (apostas de
 * intervalo) vivos no prematch, com auto-update. O backend já ordena (middles
 * por EV desc dentro de cada evento; eventos por data asc) e aplica as exclusões
 * admin. A conexão do WS é gerida globalmente (wsManager, sticky por método) —
 * aqui só assinamos. Espelha useSurebets/useValuebets.
 */
export function useMiddles(type: 'prematch' | 'live' = 'prematch', autoUpdate = true, enabled = true) {
  const [data, setData] = useState<MiddleData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sem login (enabled=false) não assina o WS.
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (msg: any) => {
      if (msg?.method === 'middles') {
        setData(Array.isArray(msg.data) ? msg.data : []);
        setLoading(false);
      }
    };
    wsManager.subscribe(handler);
    wsManager.send({ method: 'middles', options: { type, autoUpdate } });
    return () => wsManager.unsubscribe(handler);
  }, [type, autoUpdate, enabled]);

  return { data, loading };
}
