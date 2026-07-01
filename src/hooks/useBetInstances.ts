import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { apiGateway } from '@/gateways/api.gateway';
import { BetInstance } from '@/interfaces/betinstance.interface';

/**
 * Assina o WebSocket `bet_instances` (push a cada 5s, por-usuário) E faz um fetch
 * REST imediato no mount — assim a lista aparece na hora (não espera o tick do WS)
 * e depois fica viva. Sem login não assina.
 */
export function useBetInstances(enabled = true) {
  const [data, setData] = useState<BetInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;

    // Seed imediato via REST (instantâneo).
    apiGateway.getInstances()
      .then((r) => { if (alive && r.data?.result === 1) { setData(r.data.data as BetInstance[]); setLoading(false); } })
      .catch(() => {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (msg: any) => {
      if (msg?.method === 'bet_instances') {
        setData(Array.isArray(msg.data) ? msg.data : []);
        setLoading(false);
      }
    };
    wsManager.subscribe(handler);
    wsManager.send({ method: 'bet_instances', options: { autoUpdate: true } });
    return () => { alive = false; wsManager.unsubscribe(handler); };
  }, [enabled]);

  return { data, loading };
}
