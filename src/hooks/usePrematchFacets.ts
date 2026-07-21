import { useEffect, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';

/**
 * Facets do PRÉ-JOGO (esporte → país → liga, com contagem) do nosso catálogo
 * /events — a mesma árvore da /events (getEventFacets), de TODAS as casas. Alimenta
 * as ABAS de esporte (topo da lista) e a SIDEBAR de país/liga do NoDelay.
 *
 * Hoje o catálogo só tem Futebol → uma aba. Quando os coletores trouxerem outros
 * esportes, as abas aparecem sozinhas (nada hardcoded).
 */

export interface FacetLeague { leagueId: string | null; league: string; count: number }
export interface FacetCountry { countryKey: string | null; country: string | null; count: number; leagues: FacetLeague[] }
export interface FacetSport { sport: string; count: number; countries: FacetCountry[] }

export function usePrematchFacets() {
  const [facets, setFacets] = useState<FacetSport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGateway.getEventFacets({ upcomingOnly: true });
        if (!alive) return;
        setFacets(res.data?.result === 1 ? (res.data.data?.sports || []) : []);
      } catch {
        /* auxiliar — falha silenciosa não quebra a lista */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { facets, loading };
}
