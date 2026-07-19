import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import { MultiArbData } from '@/interfaces/multipla.interface';

/**
 * Assina o WebSocket `multipla` e devolve os pares de MÚLTIPLA (arbitragem de
 * acumulada) vivos no prematch, com auto-update. O backend já ordena (pares por
 * profitMargin desc) e aplica as exclusões admin. A conexão do WS é gerida
 * globalmente (wsManager, sticky por método) — aqui só assinamos. Espelha
 * useSurebets/useMiddles.
 */
export function useMultiplas(type: 'prematch' | 'live' = 'prematch', autoUpdate = true, enabled = true) {
  const [data, setData] = useState<MultiArbData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sem login (enabled=false) não assina o WS.
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handler = (msg: any) => {
      if (msg?.method === 'multipla') {
        setData(Array.isArray(msg.data) ? msg.data : []);
        setLoading(false);
      }
    };
    wsManager.subscribe(handler);
    wsManager.send({ method: 'multipla', options: { type, autoUpdate } });
    return () => wsManager.unsubscribe(handler);
  }, [type, autoUpdate, enabled]);

  return { data, loading };
}
