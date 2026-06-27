import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Search, RefreshCcw, ChevronLeft, ChevronRight, ChevronDown, Trophy,
  X, BarChart3, MapPin, Filter, Store, Layers
} from 'lucide-react';
import {
  GiSoccerBall, GiBasketballBall, GiTennisBall, GiVolleyballBall,
  GiBoxingGlove, GiHockey, GiBaseballBat, GiAmericanFootballHelmet, GiPingPongBat
} from 'react-icons/gi';
import { apiGateway, GroupedEvent, ExternalEventsParams } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { usePopover } from '@/components/ui/usePopover';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Casas conhecidas do arbbetting_master (para o filtro). Extensível.
const BOOKMAKERS = [
  'marjosports', 'betano', 'pinnacle', 'superbet', 'brbet', 'mrjack', 'estrelabet',
  'betbra', 'betmgm', 'bet7k', 'pixbet', 'betfair', 'aev', 'palpitecerto',
  'betao', 'seubet', 'stake', 'betpix365', 'vaidebet'
];

const SPORTS = [
  { value: '', label: 'Todos os esportes' },
  { value: 'futebol', label: 'Futebol' },
  { value: 'basquete', label: 'Basquete' },
  { value: 'tenis', label: 'Tênis' }
];

// Facets da sidebar (esporte → país → campeonato, com contagem).
interface FacetLeague { leagueId: string | null; league: string; count: number }
interface FacetCountry { countryKey: string | null; country: string | null; count: number; leagues: FacetLeague[] }
interface FacetSport { sport: string; count: number; countries: FacetCountry[] }

// Sentinela do bucket "sem país" (alinha com o backend).
const NO_COUNTRY = '__none__';
const ckOf = (c: FacetCountry): string => c.countryKey || NO_COUNTRY;

// Ícone por esporte (cobre os mais comuns; cai no troféu se desconhecido).
type SportIcon = React.ComponentType<{ size?: number; className?: string }>;
const SPORT_ICONS: Record<string, SportIcon> = {
  futebol: GiSoccerBall,
  basquete: GiBasketballBall,
  tenis: GiTennisBall,
  'tenis de mesa': GiPingPongBat,
  volei: GiVolleyballBall,
  voleibol: GiVolleyballBall,
  mma: GiBoxingGlove,
  boxe: GiBoxingGlove,
  hoquei: GiHockey,
  'hoquei no gelo': GiHockey,
  beisebol: GiBaseballBat,
  'futebol americano': GiAmericanFootballHelmet
};
const sportIcon = (sport: string, size = 16) => {
  const Ico = SPORT_ICONS[(sport || '').toLowerCase()];
  return Ico
    ? <Ico size={size} className="shrink-0 text-teal-300/80" />
    : <Trophy size={size - 2} className="shrink-0 text-teal-300/80" />;
};
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || (e instanceof Error ? e.message : fallback);
};

// Data em duas linhas (dia/mês em cima, hora embaixo) para a lista compacta.
const formatDateParts = (dateString: string | null): { day: string; time: string } => {
  if (!dateString) return { day: '—', time: '' };
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return { day: '—', time: '' };
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  };
};

// Cor determinística por nome de time (mimetiza os marcadores/flags do mockup).
const DOT_COLORS = [
  'bg-rose-400', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400', 'bg-violet-400',
  'bg-teal-400', 'bg-pink-400', 'bg-indigo-400', 'bg-orange-400', 'bg-lime-400'
];
const teamDot = (name: string): string => {
  const sum = Array.from(name || '').reduce((a, c) => a + c.charCodeAt(0), 0);
  return DOT_COLORS[sum % DOT_COLORS.length];
};

// useLayoutEffect dá warning no SSR do Next; sem window cai no useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Contador de casas do grupo. Mostra só a quantidade; ao passar o mouse (ou tocar),
// abre um tooltip (posição fixed, não cortado) com as casas. Posição dinâmica/clampada.
const HousesCount = ({ houses }: { houses: { bookmaker: string }[] }) => {
  const [anchor, setAnchor] = useState<{ cx: number; top: number } | null>(null);
  const [left, setLeft] = useState(0);
  const tipRef = useRef<HTMLSpanElement>(null);

  const show = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top });
  };
  const hide = () => setAnchor(null);

  useIsoLayoutEffect(() => {
    if (!anchor || !tipRef.current) return;
    const margin = 8;
    const w = tipRef.current.offsetWidth;
    setLeft(Math.min(Math.max(anchor.cx - w / 2, margin), window.innerWidth - w - margin));
  }, [anchor]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={show}
      onTouchEnd={hide}
    >
      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium bg-white/5 text-gray-300 ring-1 ring-white/10 cursor-default">
        <Store size={12} className="text-teal-300/80" />
        {houses.length} <span className="hidden sm:inline text-gray-500">{houses.length === 1 ? 'casa' : 'casas'}</span>
      </span>
      {anchor && (
        <span
          ref={tipRef}
          style={{ left, top: anchor.top - 8 }}
          className="pointer-events-none fixed z-[9999] -translate-y-full max-w-[90vw] rounded-lg bg-black/90 px-2.5 py-2 ring-1 ring-white/10 shadow-xl"
        >
          <span className="flex flex-col gap-1.5 max-w-[260px]">
            {houses.map((h, i) => <BookmakerTag key={`${h.bookmaker}-${i}`} slug={h.bookmaker} size={16} nameClassName="text-xs" />)}
          </span>
        </span>
      )}
    </span>
  );
};

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<GroupedEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [sport, setSport] = useState('');
  const [countryKey, setCountryKey] = useState('');
  const [leagueId, setLeagueId] = useState('');
  // Aba: 'upcoming' = próximos (padrão) | 'past' = já aconteceram.
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Popover "Filtros" preso à viewport com clamp (não abre fora da tela no mobile).
  const { pos: filtersPos, place: placeFilters, menuRef: filtersMenuRef } = usePopover(filtersOpen, () => setFiltersOpen(false), { align: 'right' });
  // Sidebar de esportes/campeonatos (estilo casa de aposta).
  const [facets, setFacets] = useState<FacetSport[]>([]);
  const [expandedSport, setExpandedSport] = useState('');
  const [expandedCountry, setExpandedCountry] = useState(''); // chave `${sport}|${countryKey}`
  const limit = 20;

  // Debounce da busca (400ms).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset de página ao mudar filtros (ajuste durante render — padrão React).
  const filterKey = `${search}|${bookmaker}|${sport}|${countryKey}|${leagueId}|${tab}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ExternalEventsParams = {
        page: currentPage,
        limit,
        sort,
        ...(search && { search }),
        ...(bookmaker && { bookmaker }),
        ...(sport && { sport }),
        ...(countryKey && { countryKey }),
        ...(leagueId && { leagueId }),
        ...(tab === 'upcoming' ? { upcomingOnly: true } : { pastOnly: true })
      };
      const res = await apiGateway.getGroupedEvents(params);
      if (res.data?.result === 1) {
        setEvents(res.data.data.events || []);
        setPagination(res.data.data.pagination || null);
      } else {
        setError(res.data?.message || 'Erro ao carregar eventos.');
      }
    } catch (e: unknown) {
      setError(errorMessage(e, 'Erro de conexão com o servidor.'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, bookmaker, sport, countryKey, leagueId, tab, sort]);

  // Ao trocar de aba, ajusta a ordenação padrão (próximos: mais cedo; encerrados: mais recentes).
  const switchTab = (next: 'upcoming' | 'past') => {
    setTab(next);
    setSort(next === 'past' ? 'desc' : 'asc');
    // Os facets são por aba; limpa país/liga p/ não deixar um filtro "invisível" (a liga
    // selecionada pode não existir na outra aba e sumiria do popover).
    setCountryKey('');
    setLeagueId('');
    setExpandedCountry('');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  // Carrega os esportes/campeonatos disponíveis (muda conforme a aba próximos/encerrados).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGateway.getEventFacets(
          tab === 'upcoming' ? { upcomingOnly: true } : { pastOnly: true }
        );
        if (!alive) return;
        const list: FacetSport[] = res.data?.result === 1 ? (res.data.data?.sports || []) : [];
        setFacets(list);
        // Abre o primeiro esporte (ex.: futebol) por padrão, como numa casa de aposta.
        setExpandedSport((cur) => cur || list[0]?.sport || '');
      } catch {
        /* sidebar é auxiliar — falha silenciosa não quebra a lista */
      }
    })();
    return () => { alive = false; };
  }, [tab]);

  // Seleção pela sidebar (esporte → país → liga).
  const selectSport = (s: string) => { setSport(s); setCountryKey(''); setLeagueId(''); setExpandedSport(s); };
  const selectCountry = (s: string, ck: string) => { setSport(s); setCountryKey(ck); setLeagueId(''); setExpandedSport(s); setExpandedCountry(`${s}|${ck}`); };
  const selectLeague = (s: string, ck: string, lid: string) => { setSport(s); setCountryKey(ck); setLeagueId(lid); setExpandedSport(s); setExpandedCountry(`${s}|${ck}`); };
  const toggleExpand = (s: string) => setExpandedSport((cur) => (cur === s ? '' : s));
  const toggleExpandCountry = (key: string) => setExpandedCountry((cur) => (cur === key ? '' : key));
  const clearMarketFilters = () => { setSport(''); setCountryKey(''); setLeagueId(''); };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setBookmaker('');
    setSport('');
    setCountryKey('');
    setLeagueId('');
    setSort(tab === 'past' ? 'desc' : 'asc');
  };

  // Abre a página de detalhes do evento (grupo). Usa a 1ª casa como representante.
  const goDetail = (ev: GroupedEvent) => {
    const h = ev.houses[0];
    if (!h) return;
    router.push(`/events/event/${encodeURIComponent(h.bookmaker)}/${encodeURIComponent(h.eventId)}`);
  };

  const hasFilters = Boolean(search || bookmaker || sport || countryKey || leagueId);
  // Quantos filtros (fora a busca/aba) estão ativos — mostrado no badge do botão.
  const defaultSort = tab === 'past' ? 'desc' : 'asc';
  const activeFilters = [bookmaker, sport, countryKey || leagueId, sort !== defaultSort].filter(Boolean).length;

  // Janela de páginas em torno da atual.
  const pageNumbers = useMemo(() => {
    if (!pagination) return [];
    const { currentPage: cur, totalPages } = pagination;
    const start = Math.max(1, Math.min(cur - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const arr: number[] = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [pagination]);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Trophy className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Eventos</h1>
            <p className="text-sm text-gray-400">Catálogo de eventos das casas monitoradas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pagination && (
            <div className="text-right hidden sm:block">
              <div className="text-2xl font-bold text-white tabular-nums">{pagination.totalItems.toLocaleString('pt-BR')}</div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400">eventos</div>
            </div>
          )}
          <button
            onClick={() => fetchEvents()}
            className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
            title="Atualizar"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Abas: Próximos | Encerrados */}
      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {([['upcoming', 'Próximos'], ['past', 'Encerrados']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => switchTab(value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${
              tab === value ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Corpo: sidebar de esportes/campeonatos (lg+) + conteúdo */}
      <div className="flex gap-4 items-start">
        {/* Sidebar (estilo casa de aposta) — só desktop; no mobile usa-se o popover de Filtros */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-4 self-start">
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Esportes</span>
              {(sport || countryKey || leagueId) && (
                <button onClick={clearMarketFilters} className="text-[11px] text-rose-300 hover:text-rose-200">Limpar</button>
              )}
            </div>
            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-1.5 space-y-0.5">
              {/* Todos */}
              <button
                onClick={clearMarketFilters}
                className={`flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-2 text-sm transition ${
                  !sport ? 'bg-teal-500/15 text-teal-200' : 'text-gray-200 hover:bg-white/10'
                }`}
              >
                <Layers size={15} className="shrink-0 text-teal-300/80" />
                <span className="truncate">Todos os esportes</span>
              </button>

              {facets.length === 0 && (
                <div className="px-2.5 py-3 text-xs text-gray-500">Carregando esportes…</div>
              )}

              {facets.map((s) => {
                const openSport = expandedSport === s.sport;
                const activeSport = sport === s.sport;
                return (
                  <div key={s.sport}>
                    <div className={`flex items-center gap-1 rounded-lg pr-1 transition ${activeSport ? 'bg-teal-500/15' : 'hover:bg-white/10'}`}>
                      <button
                        onClick={() => selectSport(s.sport)}
                        className={`flex items-center gap-2 flex-1 min-w-0 text-left px-2.5 py-2 text-sm ${activeSport ? 'text-teal-200' : 'text-gray-200'}`}
                      >
                        {sportIcon(s.sport)}
                        <span className="truncate">{cap(s.sport)}</span>
                        <span className="ml-auto text-[11px] text-gray-500 tabular-nums shrink-0">{s.count}</span>
                      </button>
                      {s.countries.length > 0 && (
                        <button onClick={() => toggleExpand(s.sport)} className="grid place-items-center h-6 w-6 rounded-md text-gray-400 hover:text-white hover:bg-white/10 shrink-0" title={openSport ? 'Recolher' : 'Expandir'}>
                          <ChevronDown size={14} className={`transition ${openSport ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Países do esporte */}
                    {openSport && s.countries.map((c) => {
                      const cKey = ckOf(c);
                      const ckeyFull = `${s.sport}|${cKey}`;
                      const openCountry = expandedCountry === ckeyFull;
                      const activeCountry = activeSport && countryKey === cKey;
                      const label = c.country || (c.countryKey ? c.countryKey : 'Sem país');
                      return (
                        <div key={cKey} className="mt-0.5 ml-3 pl-2 border-l border-white/10">
                          <div className={`flex items-center gap-1 rounded-lg pr-1 transition ${activeCountry && !leagueId ? 'bg-teal-500/15' : 'hover:bg-white/10'}`}>
                            <button
                              onClick={() => selectCountry(s.sport, cKey)}
                              className={`flex items-center gap-2 flex-1 min-w-0 text-left px-2.5 py-1.5 text-[13px] ${activeCountry ? 'text-teal-200' : 'text-gray-300'}`}
                            >
                              <span className="truncate">{label}</span>
                              <span className="ml-auto text-[11px] text-gray-500 tabular-nums shrink-0">{c.count}</span>
                            </button>
                            {c.leagues.length > 0 && (
                              <button onClick={() => toggleExpandCountry(ckeyFull)} className="grid place-items-center h-5 w-5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 shrink-0" title={openCountry ? 'Recolher' : 'Expandir'}>
                                <ChevronDown size={13} className={`transition ${openCountry ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>

                          {/* Ligas do país */}
                          {openCountry && (
                            <div className="mt-0.5 ml-3 pl-2 border-l border-white/10 space-y-0.5">
                              {c.leagues.map((l) => {
                                const lkey = l.leagueId || `raw:${l.league}`;
                                const activeLeague = activeCountry && !!l.leagueId && leagueId === l.leagueId;
                                return (
                                  <button
                                    key={lkey}
                                    onClick={() => l.leagueId && selectLeague(s.sport, cKey, l.leagueId)}
                                    disabled={!l.leagueId}
                                    title={!l.leagueId ? 'Liga ainda não mapeada (cure em Ligas & Aliases)' : undefined}
                                    className={`flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-[13px] transition disabled:opacity-50 disabled:cursor-default ${activeLeague ? 'bg-teal-500/15 text-teal-200' : 'text-gray-300 hover:bg-white/10'}`}
                                  >
                                    <span className="truncate">{l.league}</span>
                                    <span className="ml-auto text-[11px] text-gray-500 tabular-nums shrink-0">{l.count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
      {/* Toolbar: busca + botão Filtros (popover) */}
      <div className="mb-4 flex items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por time, liga..."
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Botão Filtros + popover */}
        <div className="shrink-0">
          <button
            onClick={(e) => { if (!filtersOpen) placeFilters(e.currentTarget); setFiltersOpen((v) => !v); }}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
              filtersOpen || activeFilters > 0
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-200'
                : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            }`}
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-teal-500 text-[10px] font-bold text-slate-900">
                {activeFilters}
              </span>
            )}
            <ChevronDown size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>

          {filtersOpen && filtersPos && (
            <>
              {/* Click-away */}
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div
                ref={filtersMenuRef}
                style={{ position: 'fixed', top: filtersPos.top, left: filtersPos.left, width: filtersPos.width }}
                className="z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Filtros</span>
                  {activeFilters > 0 && (
                    <button onClick={clearFilters} className="text-xs text-rose-300 hover:text-rose-200">Limpar tudo</button>
                  )}
                </div>

                <div className="block text-xs text-gray-400">
                  Casa
                  <Select
                    className="mt-1"
                    value={bookmaker}
                    onChange={setBookmaker}
                    options={[{ value: '', label: 'Todas as casas' }, ...BOOKMAKERS.map((b) => ({ value: b, label: b }))]}
                  />
                </div>

                <div className="block text-xs text-gray-400">
                  Esporte
                  <Select
                    className="mt-1"
                    value={sport}
                    onChange={(v) => { setSport(v); setCountryKey(''); setLeagueId(''); }}
                    options={
                      facets.length
                        ? [{ value: '', label: 'Todos os esportes' }, ...facets.map((f) => ({ value: f.sport, label: cap(f.sport) }))]
                        : SPORTS.map((s) => ({ value: s.value, label: s.label }))
                    }
                  />
                </div>

                {(() => {
                  const sportFacet = facets.find((f) => f.sport === sport);
                  const countries = sportFacet?.countries || [];
                  const curCountry = countries.find((c) => ckOf(c) === countryKey);
                  return (
                    <>
                      <div className="block text-xs text-gray-400">
                        País
                        <Select
                          className="mt-1"
                          value={countryKey}
                          onChange={(v) => { setCountryKey(v); setLeagueId(''); }}
                          options={[
                            { value: '', label: 'Todos os países' },
                            ...countries.map((c) => ({ value: ckOf(c), label: `${c.country || c.countryKey || 'Sem país'} (${c.count})` }))
                          ]}
                        />
                      </div>
                      <div className="block text-xs text-gray-400">
                        Liga
                        <Select
                          className="mt-1"
                          value={leagueId}
                          onChange={setLeagueId}
                          options={[
                            { value: '', label: 'Todas as ligas' },
                            ...(curCountry?.leagues || []).filter((l) => l.leagueId).map((l) => ({ value: l.leagueId as string, label: `${l.league} (${l.count})` }))
                          ]}
                        />
                      </div>
                    </>
                  );
                })()}

                <div className="block text-xs text-gray-400">
                  Ordenar por data
                  <Select
                    className="mt-1"
                    value={sort}
                    onChange={(v) => setSort(v as 'asc' | 'desc')}
                    options={[{ value: 'asc', label: 'Mais antigos primeiro' }, { value: 'desc', label: 'Mais recentes primeiro' }]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 bg-rose-500/10 ring-rose-500/30 text-rose-200">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Lista compacta (desktop + mobile) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-14 text-center text-gray-400">Carregando...</div>
        ) : events.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Trophy className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">{hasFilters ? 'Nenhum evento para os filtros aplicados.' : 'Nenhum evento encontrado.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {events.map((ev) => {
              const parts = formatDateParts(ev.eventDate);
              return (
                <li
                  key={ev.key}
                  onClick={() => goDetail(ev)}
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-white/[0.04] transition cursor-pointer"
                >
                  {/* Data */}
                  <div className="shrink-0 w-[52px] text-center">
                    <div className="text-[11px] text-gray-400 leading-tight">{parts.day}</div>
                    <div className="text-sm font-semibold text-teal-300 tabular-nums leading-tight">{parts.time}</div>
                  </div>

                  <div className="h-9 w-px bg-white/10 shrink-0" />

                  {/* Times */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${teamDot(ev.home)}`} />
                      <span className="text-sm font-semibold text-white truncate">{ev.home}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${teamDot(ev.away)}`} />
                      <span className="text-sm font-semibold text-white truncate">{ev.away}</span>
                    </div>
                    {/* Meta (só mobile) */}
                    <div className="md:hidden mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 min-w-0">
                      <HousesCount houses={ev.houses} />
                      <span className="truncate">{ev.league || '—'}</span>
                    </div>
                  </div>

                  {/* Liga + país (desktop) */}
                  <div className="hidden md:block w-44 shrink-0 min-w-0">
                    <div className="text-xs text-gray-300 truncate">{ev.league || '—'}</div>
                    {ev.country && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 truncate">
                        <MapPin size={10} className="shrink-0" /> {ev.country}
                      </div>
                    )}
                  </div>

                  {/* Casas (desktop) — largura fixa p/ o badge (1 casa / 11 casas) não
                      empurrar e desalinhar a coluna do campeonato entre as linhas. */}
                  <div className="hidden md:flex w-[92px] shrink-0 justify-end"><HousesCount houses={ev.houses} /></div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); goDetail(ev); }}
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-sm rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-200 transition"
                      title="Ver detalhes e odds"
                    >
                      <BarChart3 size={14} /> <span className="hidden sm:inline">Comparar</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span className="text-xs text-gray-400">
            {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}–
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} de {pagination.totalItems.toLocaleString('pt-BR')}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!pagination.hasPrevPage}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`min-w-[36px] px-2 py-1.5 rounded-lg text-sm font-medium transition ${
                  p === pagination.currentPage
                    ? 'bg-teal-500 text-slate-900'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!pagination.hasNextPage}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
        </div>{/* /conteúdo principal */}
      </div>{/* /corpo flex */}

    </div>
  );
}
