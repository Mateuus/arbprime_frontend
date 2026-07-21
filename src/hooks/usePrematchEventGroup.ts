import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  apiGateway, EventGroupDetail, EventGroupMarket, GroupedHouse,
} from '@/gateways/api.gateway';

/**
 * Evento de PRÉ-JOGO (grupo canônico) do NOSSO catálogo /events, reduzido às casas
 * da INSTÂNCIA. Fonte: apiGateway.getEventGroup(bookmaker, eventId).
 *
 * O endpoint devolve os mercados mesclados: cada seleção traz `prices[]` (uma por
 * casa) JÁ ORDENADO por melhor preço primeiro. Aqui, para cada seleção, ficamos só
 * com os `prices` das casas da instância e descartamos seleções/mercados que ficam
 * vazios. Como o filtro preserva a ordem, `prices[0]` continua sendo a MELHOR odd
 * entre as casas da instância (Contas prontas).
 *
 * DISPLAY-ONLY: ainda não dá pra apostar no pré-jogo (o catálogo não tem os ids
 * apostáveis) — o board só exibe.
 */

/** Evento de pré-jogo já filtrado para as casas da instância. */
export interface PrematchDetail {
  event: EventGroupDetail['event'];
  /** Casas do grupo que pertencem à instância. */
  houses: GroupedHouse[];
  /** Mercados com as odds só das casas da instância (melhor primeiro). */
  markets: EventGroupMarket[];
}

export function usePrematchEventGroup(bookmaker: string, eventId: string, houseSlugs: string[]) {
  const [full, setFull] = useState<EventGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!bookmaker || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGateway.getEventGroup(bookmaker, eventId);
      if (res.data?.result === 1) setFull(res.data.data);
      else setError(res.data?.message || 'Evento não encontrado.');
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string } } })?.response;
      setError(resp?.data?.message || (e instanceof Error ? e.message : 'Erro ao carregar evento.'));
    } finally {
      setLoading(false);
    }
  }, [bookmaker, eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDetail();
  }, [fetchDetail]);

  const detail = useMemo<PrematchDetail | null>(() => {
    if (!full) return null;
    const set = new Set(houseSlugs);
    const markets = full.markets
      .map((m) => ({
        ...m,
        selections: m.selections
          .map((s) => ({ ...s, prices: s.prices.filter((p) => set.has(p.bookmaker)) }))
          .filter((s) => s.prices.length > 0),
      }))
      .filter((m) => m.selections.length > 0);
    const houses = full.houses.filter((h) => set.has(h.bookmaker));
    return { event: full.event, houses, markets };
  }, [full, houseSlugs]);

  return { detail, loading, error, refetch: fetchDetail };
}
