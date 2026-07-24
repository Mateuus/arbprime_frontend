import { useEffect, useState } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { InstanceLiveGame } from '@/hooks/useInstanceLiveGames';
import { openBet365LiveStream } from '@/services/nodelay/bet365LiveClient';
import { parseZapFrames, Bet365LiveTopic, setServerTime } from '@/services/nodelay/bet365LiveModel';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';

/**
 * Jogos AO VIVO da casa bet365 de uma instância (B2 — odds DIRETO da bet365 no browser). O HOOK abre UM
 * stream (WS zap) e fecha no cleanup; a reconexão é do client. Chave de dep estável (slug). Só liga
 * quando há casa `platform === 'bet365'` pronta.
 */

const SPORT_ORDER: Record<string, number> = { soccer: 1, basketball: 2, tennis: 3, volleyball: 4, baseball: 5 };

function toInstanceGame(ev: LiveGameDetail, houseSlug: string, houseName: string): InstanceLiveGame {
  return {
    id: ev.id, sportId: ev.sportId, sportName: ev.sportName,
    sportOrder: SPORT_ORDER[ev.sportId] ?? ev.sportOrder ?? 99,
    regionName: ev.regionName || '', competitionId: ev.competitionId || '', competitionName: ev.competitionName || '',
    home: ev.home, away: ev.away, startTs: ev.startTs || 0, isBlocked: false,
    marketsCount: ev.markets?.length || 0, info: ev.info, fsbEventId: ev.id,
    houseSlug, houseName,
  };
}

export function useBet365InstanceGames(houses: NoDelayBookmaker[]) {
  const [games, setGames] = useState<InstanceLiveGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveCount, setLiveCount] = useState(0);

  const bet365 = houses.find((h) => h.platform === 'bet365' && h.ready);
  const key = bet365 ? bet365.slug : '';

  useEffect(() => {
    if (!bet365) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGames([]); setLoading(false); setLiveCount(0);
      return;
    }
    setLoading(true);
    let alive = true;
    const topic = new Bet365LiveTopic();
    let raf = 0;

    const flush = () => {
      raf = 0;
      if (!alive) return;
      const evs = topic.buildEvents().filter((e) => e.markets.length > 0);
      setGames(evs.map((e) => toInstanceGame(e, bet365.slug, bet365.name)));
      setLiveCount(evs.length);
      setLoading(false);
    };
    const schedule = () => { if (!raf && alive) raf = window.requestAnimationFrame(flush); };

    const stream = openBet365LiveStream((raw) => {
      if (!alive) return;
      for (const m of parseZapFrames(raw)) {
        if (m.topic === '__time') { setServerTime(m.kind === 'full' ? m.nodes[0]?.TI : m.fields?.TI); } // relógio do servidor
        else if (m.kind === 'full' && m.topic === 'OVInPlay_33_0') { topic.applyFull(m.nodes); schedule(); }
        else if (m.kind === 'update' && m.fields) { if (topic.applyUpdate(m.topic, m.fields)) schedule(); }
      }
    });

    const t = window.setTimeout(() => { if (alive) setLoading(false); }, 8000);
    // ticker: recomputa os relógios 1×/s (o clockSecOf usa o "agora do servidor", que avança sozinho)
    const tick = window.setInterval(() => { if (alive) schedule(); }, 1000);

    return () => {
      alive = false;
      window.clearTimeout(t);
      window.clearInterval(tick);
      if (raf) window.cancelAnimationFrame(raf);
      stream.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { games, loading, liveCount };
}
