import { useState, useEffect } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { fetchSuperbetLive, fetchSuperbetStruct } from '@/services/nodelay/superbetClient';
import { parseSuperbetLiveList } from '@/services/nodelay/superbetModel';
import { InstanceLiveGame } from '@/hooks/useInstanceLiveGames';

/**
 * Jogos AO VIVO da Superbet de uma instância, por polling REST, já no formato
 * `InstanceLiveGame` (com houseSlug/houseName) — pra mesclar com o feed fssb
 * (`useInstanceLiveGames`) e Altenar (`useAltenarInstanceGames`) no InstanceLiveFeed.
 *
 * Diferente do Altenar (1 host por casa), a Superbet tem UM feed global (CDN Fastly
 * público) — então basta 1 poll (~3s) e taggeamos com a casa `superbet` da instância.
 */
export function useSuperbetInstanceGames(houses: NoDelayBookmaker[]) {
  const [games, setGames] = useState<InstanceLiveGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  const sb = houses.find((h) => h.ready && h.platform === 'superbet');
  const key = sb ? `${sb.slug}` : '';

  useEffect(() => {
    if (!sb) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGames([]); setLoading(false); setLiveCount(0);
      return;
    }
    setLoading(true);

    let alive = true;
    let timer: number | undefined;

    const poll = async () => {
      if (!alive) return;
      if (document.hidden) { schedule(); return; }
      const ac = new AbortController();
      try {
        const struct = await fetchSuperbetStruct(ac.signal);
        const raw = await fetchSuperbetLive(ac.signal);
        if (!alive) return;
        const list = parseSuperbetLiveList(raw, struct).map((g) => ({ ...g, houseSlug: sb.slug, houseName: sb.name }));
        setGames(list);
        setLiveCount(list.length > 0 ? 1 : 0);
      } catch {
        if (alive) setLiveCount(0);
      } finally {
        if (alive) { setLoading(false); schedule(); }
      }
    };
    const schedule = () => { if (alive) timer = window.setTimeout(poll, 3000); };
    void poll();

    return () => { alive = false; if (timer) window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { games, loading, liveCount };
}
