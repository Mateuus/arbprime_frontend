import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Search, RefreshCcw, ChevronLeft, ChevronRight, ChevronDown, Trophy,
  X, BarChart3, MapPin, Filter, Store
} from 'lucide-react';
import { apiGateway, GroupedEvent, ExternalEventsParams } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
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
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
  const [league, setLeague] = useState('');
  // Aba: 'upcoming' = próximos (padrão) | 'past' = já aconteceram.
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const limit = 20;

  // Debounce da busca (400ms).
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset de página ao mudar filtros (ajuste durante render — padrão React).
  const filterKey = `${search}|${bookmaker}|${sport}|${league}|${tab}|${sort}`;
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
        ...(league && { league }),
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
  }, [currentPage, search, bookmaker, sport, league, tab, sort]);

  // Ao trocar de aba, ajusta a ordenação padrão (próximos: mais cedo; encerrados: mais recentes).
  const switchTab = (next: 'upcoming' | 'past') => {
    setTab(next);
    setSort(next === 'past' ? 'desc' : 'asc');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setBookmaker('');
    setSport('');
    setLeague('');
    setSort(tab === 'past' ? 'desc' : 'asc');
  };

  // Abre a página de detalhes do evento (grupo). Usa a 1ª casa como representante.
  const goDetail = (ev: GroupedEvent) => {
    const h = ev.houses[0];
    if (!h) return;
    router.push(`/events/event/${encodeURIComponent(h.bookmaker)}/${encodeURIComponent(h.eventId)}`);
  };

  const hasFilters = Boolean(search || bookmaker || sport || league);
  // Quantos filtros (fora a busca/aba) estão ativos — mostrado no badge do botão.
  const defaultSort = tab === 'past' ? 'desc' : 'asc';
  const activeFilters = [bookmaker, sport, league, sort !== defaultSort].filter(Boolean).length;

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
        <div className="relative shrink-0">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
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

          {filtersOpen && (
            <>
              {/* Click-away */}
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute right-0 mt-2 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl space-y-3">
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
                    onChange={setSport}
                    options={SPORTS.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </div>

                <label className="block text-xs text-gray-400">
                  Liga
                  <input
                    value={league}
                    onChange={(e) => setLeague(e.target.value)}
                    placeholder="Filtrar por liga..."
                    className={`${inputClass} mt-1`}
                  />
                </label>

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

                  {/* Casas (desktop) */}
                  <div className="hidden md:block shrink-0"><HousesCount houses={ev.houses} /></div>

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

    </div>
  );
}
