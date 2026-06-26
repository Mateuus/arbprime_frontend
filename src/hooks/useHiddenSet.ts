import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGateway, HiddenItemDTO } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';

/**
 * Itens ocultados pelo usuário (preferência pessoal), persistidos no backend e
 * aplicados como filtro client-side no stream de surebets.
 *
 * Chaves (idênticas ao backend):
 *  - event     => eventId (SurebetData.id / groupId)
 *  - house     => `${bookmaker}:${houseEventId}`
 *  - selection => `${houseEventId}|${bookmaker}|${market}|${option}|${handicap}`
 */
export type HideType = 'event' | 'house' | 'selection';

export const houseKey = (bookmaker: string, houseEventId: string): string =>
  `${(bookmaker || '').toLowerCase()}:${houseEventId}`;

export const selectionKey = (leg: { eventId: string; bookmaker: string; market: string; option: string; handicap?: number | string | null }): string =>
  `${leg.eventId}|${(leg.bookmaker || '').toLowerCase()}|${leg.market}|${leg.option}|${leg.handicap ?? ''}`;

export function useHiddenSet() {
  const { isAuthenticated } = useUserContext();
  const [items, setItems] = useState<HiddenItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await apiGateway.getHidden();
      if (res.data?.result === 1) setItems(res.data.data || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const sets = useMemo(() => {
    const events = new Set<string>();
    const houses = new Set<string>();
    const selections = new Set<string>();
    for (const it of items) {
      if (it.type === 'event') events.add(it.itemKey);
      else if (it.type === 'house') houses.add(it.itemKey);
      else if (it.type === 'selection') selections.add(it.itemKey);
    }
    return { events, houses, selections };
  }, [items]);

  const hide = useCallback(async (type: HideType, itemKey: string, label?: string) => {
    if (!isAuthenticated) return false;
    // Otimista
    setItems((prev) => prev.some((i) => i.type === type && i.itemKey === itemKey)
      ? prev
      : [{ id: `tmp-${itemKey}`, type, itemKey, label: label || null, createdAt: new Date().toISOString() }, ...prev]);
    try {
      const res = await apiGateway.addHidden(type, itemKey, label);
      if (res.data?.result === 1) { await load(); return true; }
    } catch { /* reverte abaixo */ }
    await load();
    return false;
  }, [isAuthenticated, load]);

  const unhide = useCallback(async (type: HideType, itemKey: string) => {
    setItems((prev) => prev.filter((i) => !(i.type === type && i.itemKey === itemKey)));
    try { await apiGateway.removeHidden(type, itemKey); } catch { /* ignore */ }
  }, []);

  const clearAll = useCallback(async () => {
    setItems([]);
    try { await apiGateway.clearHidden(); } catch { /* ignore */ }
  }, []);

  // Predicado: a surebet deve ser EXIBIDA? (eventId = groupId; legs com {bookmaker,eventId,market,option,handicap})
  const isSurebetVisible = useCallback((eventId: string, legs: Array<{ eventId: string; bookmaker: string; market: string; option: string; handicap?: number | string | null }>): boolean => {
    if (sets.events.has(eventId)) return false;
    for (const leg of legs) {
      if (sets.houses.has(houseKey(leg.bookmaker, leg.eventId))) return false;
      if (sets.selections.has(selectionKey(leg))) return false;
    }
    return true;
  }, [sets]);

  const isEventHidden = useCallback((eventId: string) => sets.events.has(eventId), [sets]);

  const isHidden = useCallback((type: HideType, itemKey: string): boolean => {
    if (type === 'event') return sets.events.has(itemKey);
    if (type === 'house') return sets.houses.has(itemKey);
    return sets.selections.has(itemKey);
  }, [sets]);

  return { items, loading, hide, unhide, clearAll, reload: load, isSurebetVisible, isEventHidden, isHidden, count: items.length };
}
