import { useState, useEffect, useRef } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { fetchLiveOverview, AltenarHost } from '@/services/nodelay/altenarClient';
import { parseAltenarLiveList } from '@/services/nodelay/altenarModel';
import { LiveGame } from '@/services/nodelay/rogueModel';

/**
 * Jogos AO VIVO de uma casa biahosted (Altenar) por POLLING REST — mesma saída do
 * `useLiveGames` (fssb/SSE), pra lista renderizar igual. Busca `GetLiveOverview`
 * a cada ~3s (placar/relógio/entrada-saída de jogos). OBJETIVO = WebSocket depois.
 */
const POLL_MS = 3000;

export function useAltenarLiveGames(house: NoDelayBookmaker | undefined) {
  const host: AltenarHost | null = house?.oddsUrl
    ? { oddsUrl: house.oddsUrl, integration: house.integration || house.slug }
    : null;
  const hostKey = host ? `${host.oddsUrl}|${host.integration}` : '';

  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(!!host);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!host) { setLoading(false); return; }

    let stop = false;
    let ac: AbortController | null = null;
    let timer: number | undefined;

    const tick = async () => {
      if (stop || document.hidden) { schedule(); return; }
      ac = new AbortController();
      try {
        const lo = await fetchLiveOverview(host, undefined, ac.signal);
        if (!aliveRef.current || stop) return;
        setGames(parseAltenarLiveList(lo));
        setError(null);
        setLive(true);
      } catch (e) {
        if (!aliveRef.current || stop) return;
        if ((e as Error)?.name !== 'AbortError') {
          setLive(false);
          setError((prev) => prev ?? 'Não foi possível carregar os jogos ao vivo.');
        }
      } finally {
        if (aliveRef.current && !stop) setLoading(false);
        schedule();
      }
    };
    const schedule = () => { if (!stop) timer = window.setTimeout(tick, POLL_MS); };

    void tick();

    return () => {
      stop = true;
      aliveRef.current = false;
      if (timer) window.clearTimeout(timer);
      try { ac?.abort(); } catch { /* já fechado */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostKey]);

  return { games, loading, error, live };
}
