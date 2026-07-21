import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiGateway, GroupedEvent, GroupedHouse } from '@/gateways/api.gateway';

/**
 * Lista de PRÉ-JOGO do NoDelay a partir do NOSSO catálogo /events (agrupado /
 * deduplicado — 1 item por jogo real), filtrada para as casas da INSTÂNCIA.
 *
 * Fonte: apiGateway.getGroupedEvents({ upcomingOnly, sport, countryKey, leagueId,
 * search }). O catálogo agrupado NÃO traz odds na listagem (só as casas de cada
 * jogo) — as odds só existem DENTRO do evento (usePrematchEventGroup). Por isso a
 * lista mostra as casas prontas por jogo, não o 1X2. Vem ordenado por horário
 * (asc): os jogos mais próximos primeiro.
 *
 * Filtro por casa: não há parâmetro multi-casa no endpoint, então mantemos, no
 * cliente, só os jogos que têm alguma casa da instância (interseção com
 * `houseSlugs`). Os filtros de esporte/país/liga (sidebar) vão para o SERVIDOR.
 *
 * Variedade no 1º render: como ordenamos por horário, a 1ª página costuma cair
 * toda no mesmo campeonato (jogos do mesmo horário). Por isso, quando NÃO há liga
 * escolhida, pré-carregamos páginas até reunir ≥ MIN_LEAGUES campeonatos distintos
 * (das casas da instância) — respeitando um teto de páginas. Depois, "Carregar
 * mais" continua de onde parou.
 */

/** Uma partida da lista de pré-jogo, já reduzida às casas da instância. */
export interface PrematchGame {
  key: string;
  sport: string;
  /** Liga canônica (fallback "Outros"). */
  competition: string;
  country: string | null;
  /** eventDate — wallclock de Brasília tagueado Z (usar utils/eventTime). */
  kickoff: string | null;
  home: string;
  away: string;
  /** Rota do evento: 1ª casa da INSTÂNCIA que tem o jogo (garante que ela existe no grupo). */
  bookmaker: string;
  eventId: string;
  /** Casas do grupo que pertencem à instância (contas prontas). */
  houses: GroupedHouse[];
}

/** Filtros da sidebar (esporte → país → liga) + busca. */
export interface PrematchFilters {
  sport?: string;
  countryKey?: string;
  leagueId?: string;
  search?: string;
}

const PAGE_SIZE = 100;
const MIN_LEAGUES = 5;    // variedade mínima no 1º render
const MAX_AUTO_PAGES = 5; // teto de páginas pré-carregadas (proteção)

// Nº de campeonatos distintos entre os eventos cobertos pelas casas da instância.
function distinctLeagues(evs: GroupedEvent[], set: Set<string>): number {
  const s = new Set<string>();
  for (const ev of evs) {
    if (ev.houses.some((h) => set.has(h.bookmaker))) s.add(ev.league || 'Outros');
  }
  return s.size;
}

export function usePrematchGroupedGames(houseSlugs: string[], filters: PrematchFilters = {}) {
  const { sport, countryKey, leagueId, search } = filters;
  const [raw, setRaw] = useState<GroupedEvent[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chave estável do conjunto de casas p/ deps + Set p/ o pré-carregamento.
  const housesKey = useMemo(() => [...houseSlugs].sort().join(','), [houseSlugs]);
  // Guarda de corrida: um novo ciclo de filtros invalida o anterior em andamento.
  const runIdRef = useRef(0);

  // Uma página crua do endpoint.
  const fetchOne = useCallback(async (page: number) => {
    const res = await apiGateway.getGroupedEvents({
      upcomingOnly: true,
      sort: 'asc',
      page,
      limit: PAGE_SIZE,
      sport: sport || undefined,
      countryKey: countryKey || undefined,
      leagueId: leagueId || undefined,
      search: search || undefined,
    });
    if (res.data?.result !== 1) throw new Error(res.data?.message || 'Falha ao carregar jogos.');
    return {
      evs: (res.data.data?.events ?? []) as GroupedEvent[],
      more: !!res.data.data?.pagination?.hasNextPage,
    };
  }, [sport, countryKey, leagueId, search]);

  // Carga inicial: reseta e pré-carrega páginas até ter variedade de campeonatos
  // (a menos que já haja uma liga escolhida — aí a 1ª página basta).
  useEffect(() => {
    const myRun = ++runIdRef.current;
    const set = new Set(housesKey ? housesKey.split(',') : []);
    setLoading(true);
    setError(null);
    setRaw([]);
    (async () => {
      let acc: GroupedEvent[] = [];
      let page = 1;
      let more = true;
      const leagueScoped = !!leagueId;
      try {
        for (;;) {
          const { evs, more: m } = await fetchOne(page);
          if (runIdRef.current !== myRun) return; // filtros mudaram: aborta
          acc = acc.concat(evs);
          more = m;
          const enough = leagueScoped || distinctLeagues(acc, set) >= MIN_LEAGUES;
          if (!more || enough || page >= MAX_AUTO_PAGES) break;
          page += 1;
        }
        if (runIdRef.current !== myRun) return;
        setRaw(acc);
        setLastPage(page);
        setHasMore(more);
      } catch (e: unknown) {
        if (runIdRef.current !== myRun) return;
        const resp = (e as { response?: { data?: { message?: string } } })?.response;
        setError(resp?.data?.message || (e instanceof Error ? e.message : 'Erro ao carregar jogos.'));
      } finally {
        if (runIdRef.current === myRun) setLoading(false);
      }
    })();
    // housesKey nas deps: trocar de instância recompõe a variedade de ligas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchOne, leagueId, housesKey]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const myRun = runIdRef.current;
    setLoadingMore(true);
    try {
      const next = lastPage + 1;
      const { evs, more } = await fetchOne(next);
      if (runIdRef.current !== myRun) return;
      setRaw((prev) => [...prev, ...evs]);
      setLastPage(next);
      setHasMore(more);
    } catch {
      /* silencioso: mantém o que já tem */
    } finally {
      if (runIdRef.current === myRun) setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, lastPage, fetchOne]);

  // Só os jogos que têm alguma casa da instância. A rota aponta p/ a 1ª casa da
  // instância presente no grupo (não a houses[0] genérica, que pode ser de fora).
  const games = useMemo<PrematchGame[]>(() => {
    const set = new Set(houseSlugs);
    const out: PrematchGame[] = [];
    const seen = new Set<string>();
    for (const ev of raw) {
      if (seen.has(ev.key)) continue;
      const mine = ev.houses.filter((h) => set.has(h.bookmaker));
      if (mine.length === 0) continue;
      seen.add(ev.key);
      const primary = mine[0];
      out.push({
        key: ev.key,
        sport: ev.sport,
        competition: ev.league || 'Outros',
        country: ev.country ?? null,
        kickoff: ev.eventDate,
        home: ev.home,
        away: ev.away,
        bookmaker: primary.bookmaker,
        eventId: primary.eventId,
        houses: mine,
      });
    }
    return out;
  }, [raw, houseSlugs]);

  return { games, loading, loadingMore, hasMore, loadMore, error };
}
