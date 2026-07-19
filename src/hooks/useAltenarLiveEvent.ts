import { useState, useEffect, useRef, useCallback } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { fetchEventDetails, fetchScoreboard, AltenarHost } from '@/services/nodelay/altenarClient';
import { parseAltenarEvent, scoreFromOverview } from '@/services/nodelay/altenarModel';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';

/**
 * Evento ao vivo de uma casa biahosted (Altenar) por POLLING REST — mesma saída
 * do `useInstanceLiveEvent` (fssb/SSE), pra UI (MarketBoard/QuickBet) não mudar.
 *
 * FASE 1 = polling: busca `GetEventDetails` a cada ~1s (odds) e o placar do
 * `GetLiveOverview` a cada ~3s (o detail não traz placar). OBJETIVO = trocar por
 * WebSocket (graphql-ws) depois: o parse (`altenarModel`) fica igual, muda só isto.
 *
 * `changed` = ids de seleção cujo PREÇO mudou entre polls (a célula pisca).
 */
const ODDS_MS = 1000;
const SCORE_EVERY = 3; // a cada N polls busca o placar (overview)
const FLASH_MS = 1200;

type PriceMap = Map<string, number>;
function priceMap(detail: LiveGameDetail | null): PriceMap {
  const m: PriceMap = new Map();
  if (detail) for (const mk of detail.markets) for (const s of mk.selections) m.set(s.id, s.price);
  return m;
}

export function useAltenarLiveEvent(house: NoDelayBookmaker | undefined, eventId: string) {
  const ready = !!(house?.ready && house.oddsUrl && house.bffUrl != null) && !!eventId;
  const host: AltenarHost | null = house?.oddsUrl
    ? { oddsUrl: house.oddsUrl, integration: house.integration || house.slug }
    : null;
  const hostKey = host ? `${host.oddsUrl}|${host.integration}` : '';

  const [detail, setDetail] = useState<LiveGameDetail | null>(null);
  const [loading, setLoading] = useState(!!(host && eventId));
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  const detailRef = useRef<LiveGameDetail | null>(null);
  const priceRef = useRef<PriceMap>(new Map());
  const flashTimers = useRef<Map<string, number>>(new Map());
  const aliveRef = useRef(true);
  const scoreRef = useRef<[number, number] | null>(null);

  const getHousePrice = useCallback((_slug: string, selId: string): HousePrice | undefined => {
    const p = priceRef.current.get(selId);
    if (p == null) return undefined;
    return { price: p, points: null, line: null, disabled: p <= 1 };
  }, []);

  const flash = useCallback((ids: Set<string>) => {
    if (!ids.size) return;
    setChanged((prev) => new Set([...prev, ...ids]));
    for (const id of ids) {
      const t = flashTimers.current.get(id);
      if (t) window.clearTimeout(t);
      flashTimers.current.set(id, window.setTimeout(() => {
        if (!aliveRef.current) return;
        setChanged((prev) => { const n = new Set(prev); n.delete(id); return n; });
        flashTimers.current.delete(id);
      }, FLASH_MS));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    detailRef.current = null;
    priceRef.current = new Map();
    scoreRef.current = null;
    const timers = flashTimers.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!host || !eventId) { setLoading(false); return; }

    let poll = 0;
    let stop = false;
    let ac: AbortController | null = null;
    let timer: number | undefined;

    const tick = async () => {
      if (stop || document.hidden) { schedule(); return; }
      ac = new AbortController();
      try {
        // placar a cada N polls (o detail não traz placar) — GetScoreboardInfo
        // (oficial), mesmo shape do overview (events[].score).
        if (poll % SCORE_EVERY === 0) {
          try {
            const sb = await fetchScoreboard(host, eventId, ac.signal);
            scoreRef.current = scoreFromOverview(sb, eventId);
          } catch { /* placar é best-effort */ }
        }
        const raw = await fetchEventDetails(host, eventId, ac.signal);
        const next = parseAltenarEvent(raw, scoreRef.current);
        if (!aliveRef.current || stop) return;
        if (next) {
          // pisca as seleções cujo preço mudou.
          const prev = priceRef.current;
          const chg = new Set<string>();
          for (const mk of next.markets) for (const s of mk.selections) {
            const old = prev.get(s.id);
            if (old != null && old !== s.price) chg.add(s.id);
          }
          detailRef.current = next;
          priceRef.current = priceMap(next);
          setDetail(next);
          setError(null);
          setLive(true);
          if (chg.size) flash(chg);
        } else if (!detailRef.current) {
          setError('Jogo indisponível.');
        }
      } catch (e) {
        if (!aliveRef.current || stop) return;
        if ((e as Error)?.name !== 'AbortError') setLive(false);
      } finally {
        if (aliveRef.current && !stop) setLoading(false);
        poll++;
        schedule();
      }
    };
    const schedule = () => { if (!stop) timer = window.setTimeout(tick, ODDS_MS); };

    void tick();
    // desiste do "carregando" se o 1º poll demorar.
    const t0 = window.setTimeout(() => { if (aliveRef.current && !detailRef.current) setLoading(false); }, 10_000);

    return () => {
      stop = true;
      aliveRef.current = false;
      window.clearTimeout(t0);
      if (timer) window.clearTimeout(timer);
      try { ac?.abort(); } catch { /* já fechado */ }
      for (const tm of timers.values()) window.clearTimeout(tm);
      timers.clear();
      setChanged(new Set());
    };
    // hostKey/eventId cobrem a re-assinatura; flash é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostKey, eventId, flash]);

  return { detail, loading, error, changed, live, getHousePrice, ready };
}
