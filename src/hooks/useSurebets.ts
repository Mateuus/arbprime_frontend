import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { SurebetData } from '@/interfaces/arbitragem.interface';

/**
 * Assina o WebSocket `arbitrage_betting` e devolve a lista de surebets do tipo
 * pedido (prematch | live), com auto-update. O backend já ordena por melhor
 * lucro. A conexão do WS é gerida globalmente (wsManager); aqui só assinamos.
 */
export function useSurebets(type: 'prematch' | 'live', autoUpdate = true, enabled = true) {
  const [data, setData] = useState<SurebetData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sem login (enabled=false) não assina o WS — não streama surebets p/ deslogado.
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (msg: any) => {
      if (msg?.method === 'arbitrage_betting') {
        setData(Array.isArray(msg.data) ? msg.data : []);
        setLoading(false);
      }
    };
    wsManager.subscribe(handler);
    wsManager.send({ method: 'arbitrage_betting', options: { type, autoUpdate } });
    return () => wsManager.unsubscribe(handler);
  }, [type, autoUpdate, enabled]);

  return { data, loading };
}
