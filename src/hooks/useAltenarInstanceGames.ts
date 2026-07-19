import { useState, useEffect } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { fetchLiveOverview, AltenarHost } from '@/services/nodelay/altenarClient';
import { parseAltenarLiveList } from '@/services/nodelay/altenarModel';
import { InstanceLiveGame } from '@/hooks/useInstanceLiveGames';

/**
 * Jogos AO VIVO das casas BIAHOSTED (Altenar) de uma instância, por polling REST,
 * já no formato `InstanceLiveGame` (com houseSlug/houseName) — pra mesclar com o
 * feed fssb (`useInstanceLiveGames`) no InstanceLiveFeed sem tocar no caminho swarm.
 * Cada casa biahosted é pollada em paralelo (GetLiveOverview ~3s).
 */
export function useAltenarInstanceGames(houses: NoDelayBookmaker[]) {
  const [games, setGames] = useState<InstanceLiveGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  const bia = houses.filter((h) => h.ready && h.platform === 'biahosted' && h.oddsUrl);
  const key = bia.map((h) => `${h.slug}@${h.oddsUrl}`).sort().join(',');

  useEffect(() => {
    const list = houses.filter((h) => h.ready && h.platform === 'biahosted' && h.oddsUrl);
    if (list.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGames([]); setLoading(false);
      return;
    }
    setLoading(true);

    let alive = true;
    const byHouse = new Map<string, InstanceLiveGame[]>();
    const liveHouses = new Set<string>();
    const delivered = new Set<string>();
    const timers: number[] = [];

    const flush = () => {
      if (!alive) return;
      const all: InstanceLiveGame[] = [];
      for (const arr of byHouse.values()) all.push(...arr);
      setGames(all);
    };

    for (const house of list) {
      const host: AltenarHost = { oddsUrl: house.oddsUrl!, integration: house.integration || house.slug };
      const poll = async () => {
        if (!alive) return;
        if (document.hidden) { schedule(); return; }
        const ac = new AbortController();
        try {
          const lo = await fetchLiveOverview(host, undefined, ac.signal);
          if (!alive) return;
          byHouse.set(house.slug, parseAltenarLiveList(lo).map((g) => ({ ...g, houseSlug: house.slug, houseName: house.name })));
          liveHouses.add(house.slug); setLiveCount(liveHouses.size);
          flush();
        } catch {
          if (alive) { liveHouses.delete(house.slug); setLiveCount(liveHouses.size); }
        } finally {
          if (alive) {
            delivered.add(house.slug);
            if (delivered.size >= list.length) setLoading(false);
          }
          schedule();
        }
      };
      const schedule = () => { if (alive) timers.push(window.setTimeout(poll, 3000)); };
      void poll();
    }

    return () => { alive = false; for (const t of timers) window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { games, loading, liveCount };
}
