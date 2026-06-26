import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { ValuebetGroup } from '@/interfaces/valuebet.interface';

/**
 * Assina o WebSocket `valuebet` e devolve os grupos de value bets vivos
 * (prematch), com auto-update. O backend já ordena os grupos pelo melhor edge e
 * cada grupo traz seus `valuebets[]` ordenados por edgePct. A conexão do WS é
 * gerida globalmente (wsManager, sticky por método) — aqui só assinamos.
 */
export function useValuebets(autoUpdate = true, enabled = true) {
  const [data, setData] = useState<ValuebetGroup[]>([]);
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
      if (msg?.method === 'valuebet') {
        setData(Array.isArray(msg.data) ? msg.data : []);
        setLoading(false);
      }
    };
    wsManager.subscribe(handler);
    wsManager.send({ method: 'valuebet', options: { type: 'prematch', autoUpdate } });
    return () => wsManager.unsubscribe(handler);
  }, [autoUpdate, enabled]);

  return { data, loading };
}
