import { useState, useEffect, useRef, useCallback } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { fetchSuperbetEvent, fetchSuperbetStruct, fetchSuperbetGroups } from '@/services/nodelay/superbetClient';
import { parseSuperbetEvent } from '@/services/nodelay/superbetModel';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';

/**
 * Evento ao vivo da Superbet por POLLING REST — mesma saída do `useInstanceLiveEvent`
 * (fssb/SSE) e do `useAltenarLiveEvent`, pra UI (EventBoard/QuickBet) não mudar.
 * Busca `/events/<id>` a cada ~1s (odds + placar, tudo no mesmo payload). O `struct`
 * (nomes) e o `market-groups` (abas) são cacheados no client.
 *
 * `changed` = ids de seleção cujo PREÇO mudou entre polls (a célula pisca).
 */
const ODDS_MS = 1000;
const FLASH_MS = 1200;

type PriceMap = Map<string, number>;
function priceMap(detail: LiveGameDetail | null): PriceMap {
  const m: PriceMap = new Map();
  if (detail) for (const mk of detail.markets) for (const s of mk.selections) m.set(s.id, s.price);
  return m;
}

export function useSuperbetLiveEvent(house: NoDelayBookmaker | undefined, eventId: string) {
  const ready = !!(house?.ready && house.platform === 'superbet') && !!eventId;
  const active = ready;

  const [detail, setDetail] = useState<LiveGameDetail | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  const detailRef = useRef<LiveGameDetail | null>(null);
  const priceRef = useRef<PriceMap>(new Map());
  const flashTimers = useRef<Map<string, number>>(new Map());
  const aliveRef = useRef(true);

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
    const timers = flashTimers.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!active) { setLoading(false); return; }

    let stop = false;
    let ac: AbortController | null = null;
    let timer: number | undefined;

    const tick = async () => {
      if (stop || document.hidden) { schedule(); return; }
      ac = new AbortController();
      try {
        const struct = await fetchSuperbetStruct(ac.signal);
        const raw = await fetchSuperbetEvent(eventId, ac.signal);
        const ev = ((raw.data as Record<string, unknown>[]) || [])[0];
        const sportId = ev ? String(ev.sportId) : '0';
        const { byMarket, tabs } = await fetchSuperbetGroups(sportId, ac.signal).catch(() => ({ byMarket: new Map(), tabs: [] }));
        const next = parseSuperbetEvent(raw, struct, byMarket, tabs);
        if (!aliveRef.current || stop) return;
        if (next) {
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
        schedule();
      }
    };
    const schedule = () => { if (!stop) timer = window.setTimeout(tick, ODDS_MS); };

    void tick();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, active, flash]);

  return { detail, loading, error, changed, live, getHousePrice, ready };
}
