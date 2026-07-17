import { useState, useEffect, useRef, useCallback } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { openEventStream, RogueOp } from '@/services/nodelay/rogueClient';
import {
  eventToDetail, applyRogueDelta, applyEventDelta, LiveGameDetail,
} from '@/services/nodelay/rogueModel';

/**
 * UM evento ao vivo via ROGUE SSE: o "initial" monta o detalhe, os "update"
 * empurram delta de odd/placar. É aqui que o "NoDelay" acontece — a odd muda na
 * tela no instante em que muda na casa, na MESMA stream que o site usa.
 *
 * `changed` traz os ids de seleção que acabaram de mexer (p/ a célula piscar);
 * auto-limpa depois de FLASH_MS.
 */
const FLASH_MS = 1200;

export function useLiveEvent(house: NoDelayBookmaker | undefined, eventId: string) {
  const [detail, setDetail] = useState<LiveGameDetail | null>(null);
  const [loading, setLoading] = useState(!!(house?.ready && eventId));
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  const detailRef = useRef<LiveGameDetail | null>(null);
  const flashTimers = useRef<Map<string, number>>(new Map());
  const aliveRef = useRef(true);

  const setBoth = useCallback((d: LiveGameDetail | null) => {
    detailRef.current = d;
    setDetail(d);
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
    const timers = flashTimers.current;
    if (!house?.ready || !eventId) return;

    const onOps = (ops: RogueOp[]) => {
      for (const op of ops) {
        const type = String(op.Type || '');
        const cs = op.Changeset as Record<string, unknown> | undefined;

        // initial: o evento completo vem em Changeset.event.
        if (op.Operation === 'initial' && cs?.event) {
          const d = eventToDetail(cs.event as Record<string, unknown>);
          if (aliveRef.current) {
            setBoth(d);
            setError(d ? null : 'Jogo indisponível.');
            setLoading(false);
          }
          continue;
        }

        const cur = detailRef.current;
        if (!cur) continue;

        if (type === 'market') {
          const { next, changed: ids } = applyRogueDelta(cur, op);
          if (ids.size || next !== cur) { setBoth(next); flash(ids); }
        } else if (type === 'event') {
          const next = applyEventDelta(cur, op);
          if (next !== cur) setBoth(next);
        }
      }
    };

    const host = { slug: house.slug, rogueUrl: house.rogueUrl! };
    const stream = openEventStream(host, eventId, onOps, (isLive) => {
      if (aliveRef.current) setLive(isLive);
    });

    // Se o initial não chegar em 10s, desiste do "carregando".
    const t = window.setTimeout(() => { if (aliveRef.current && !detailRef.current) setLoading(false); }, 10_000);

    return () => {
      aliveRef.current = false;
      window.clearTimeout(t);
      for (const tm of timers.values()) window.clearTimeout(tm);
      timers.clear();
      stream.close();
    };
  }, [house, eventId, setBoth, flash]);

  return { detail, loading, error, changed, live };
}
