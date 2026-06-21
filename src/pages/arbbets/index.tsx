import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  Calculator, RefreshCcw, Search, ExternalLink, X, Zap, Trophy, TrendingUp, Clock, Layers, HelpCircle, Filter, ChevronDown, Settings
} from 'lucide-react';
import { useSurebets } from '@/hooks/useSurebets';
import { useBookmakers } from '@/hooks/useBookmakers';
import { apiGateway } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { BookmakerTag, BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { SurebetData, Surebet, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { FilterDTO } from '@/interfaces';
import { marketLabel, marketCategory, optionLabel, profitTone } from '@/utils/surebet';
import { explainMarket } from '@/utils/marketExplain';

// Base SEM largura (para campos de largura fixa, evita conflito com w-full).
const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';
const inputClass = `w-full ${fieldBase}`;

const CATEGORIES = [
  { value: 'all', label: 'Todos os mercados' },
  { value: 'resultado', label: 'Resultado' },
  { value: 'gols', label: 'Gols' },
  { value: 'handicap', label: 'Handicap' },
  { value: 'escanteios', label: 'Escanteios' },
  { value: 'cartoes', label: 'Cartões' }
];

const fmtDate = (s: string): string => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Idade do surebet a partir do create_at.
const ageOf = (s: string): string => {
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
};

// Surebet compacta: header (mercado + ajuda + lucro + calculadora) e uma LINHA por perna.
// Direção da última movimentação da odd (do historyPrice embutido): 1 subiu, -1 caiu, 0 igual/sem dado.
const oddDir = (leg: SurebetOdd): 1 | -1 | 0 => {
  const h = leg.historyPrice;
  if (!h || h.length < 2) return 0;
  const s = [...h].sort((a, b) => a.timestamp - b.timestamp);
  const last = Number(s[s.length - 1].price), prev = Number(s[s.length - 2].price);
  return last > prev ? 1 : last < prev ? -1 : 0;
};

const SurebetCompact = ({ event, sb, onCalc, onExplain, onOdd }: {
  event: SurebetData; sb: Surebet; onCalc: () => void; onExplain: () => void; onOdd: (leg: SurebetOdd) => void;
}) => {
  const multiMarket = new Set(sb.surebet.map((l) => l.market)).size > 1;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] text-teal-300/90 truncate">{sb.marketTypes.map(marketLabel).join(' · ')}</span>
          <Tooltip label="Como funciona este mercado?" className="shrink-0">
            <button onClick={onExplain} className="text-gray-500 hover:text-teal-300 transition">
              <HelpCircle size={12} />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ring-1 ${profitTone(sb.profitMargin)}`}>
            {sb.profitMargin.toFixed(2)}%
          </span>
          <Tooltip label="Calculadora">
            <button onClick={onCalc} className="grid place-items-center h-5 w-5 rounded text-teal-300 hover:bg-teal-500/20 transition">
              <Calculator size={13} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {sb.surebet.map((leg, i) => {
          const dir = oddDir(leg);
          return (
          <div key={i} className="flex items-center gap-2 px-2.5 py-1 text-xs">
            <span className="w-[92px] shrink-0"><BookmakerTag slug={leg.bookmaker} size={13} nameClassName="text-[11px]" /></span>
            <span className="flex-1 min-w-0 truncate text-gray-300">
              {multiMarket && <span className="text-gray-500">{marketLabel(leg.market)} · </span>}
              {optionLabel(leg.option, event.home, event.away)}
            </span>
            {dir !== 0 && (
              <span className={`shrink-0 text-[10px] leading-none ${dir > 0 ? 'text-emerald-400' : 'text-rose-400'}`} title={dir > 0 ? 'Odd subiu' : 'Odd caiu'}>
                {dir > 0 ? '▲' : '▼'}
              </span>
            )}
            <Tooltip label="Ver esta odd em outras casas e o histórico" className="shrink-0">
              <button
                onClick={() => onOdd(leg)}
                className={`font-bold tabular-nums px-1.5 py-0.5 rounded hover:bg-teal-500/15 hover:underline decoration-dotted transition ${dir > 0 ? 'text-emerald-300' : dir < 0 ? 'text-rose-300' : 'text-teal-300'}`}
              >
                {Number(leg.price).toFixed(2)}
              </button>
            </Tooltip>
            {leg.link && (
              <a href={leg.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-teal-300 shrink-0" title="Abrir na casa">
                <ExternalLink size={11} />
              </a>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default function ArbBetsPage() {
  const router = useRouter();
  const type = (router.query.type === 'live' ? 'live' : 'prematch') as 'prematch' | 'live';
  const setType = (t: 'prematch' | 'live') => router.replace({ pathname: '/arbbets', query: { type: t } }, undefined, { shallow: true });

  const [autoUpdate, setAutoUpdate] = useState(true);
  const { data, loading } = useSurebets(type, autoUpdate);

  const [view, setView] = useState<'surebets' | 'events'>('surebets');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [category, setCategory] = useState('all');
  const [bookmaker, setBookmaker] = useState('');
  const [profitMin, setProfitMin] = useState('0');
  const [sortMode, setSortMode] = useState<'profit' | 'time'>('profit');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Filtros salvos do usuário (ABFilter).
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string }[]>([]);
  const [activeFilterId, setActiveFilterId] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterDTO | null>(null);
  const [calc, setCalc] = useState<{ event: SurebetData; sb: Surebet } | null>(null);
  // Modal com todas as surebets de um evento (aberto pelo +N).
  const [eventModal, setEventModal] = useState<{ event: SurebetData; surebets: Surebet[] } | null>(null);
  // Modal de explicação do mercado (aberto pelo [?]).
  const [explain, setExplain] = useState<{ marketIds: string[]; home: string; away: string } | null>(null);
  const openExplain = (event: SurebetData, sb: Surebet) => setExplain({ marketIds: sb.marketTypes, home: event.home, away: event.away });
  // Modal de uma odd: outras casas + histórico (aberto ao clicar na odd).
  const [oddModal, setOddModal] = useState<{ event: SurebetData; leg: SurebetOdd } | null>(null);

  const sports = useMemo(() => Array.from(new Set(data.map((e) => e.sport).filter(Boolean))), [data]);
  const houses = useMemo(
    () => Array.from(new Set(data.flatMap((e) => e.surebets.flatMap((sb) => sb.surebet.map((l) => l.bookmaker))))).sort(),
    [data]
  );

  // Carrega a lista de filtros salvos e auto-seleciona (lembra a escolha; senão, o 1º).
  useEffect(() => {
    apiGateway.getUserFilters()
      .then((r) => {
        if (r.data?.result !== 1 || !Array.isArray(r.data.data)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: { id: string; name: string }[] = r.data.data.map((f: any) => ({ id: String(f.id), name: f.name }));
        setSavedFilters(list);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('arbbets:filter') : null;
        if (stored === null) { if (list.length) setActiveFilterId(list[0].id); }   // 1ª vez → primeiro filtro
        else if (stored && list.some((f) => f.id === stored)) setActiveFilterId(stored); // lembra a escolha
        // stored === '' → usuário escolheu "Sem filtro", respeita
      })
      .catch(() => {});
  }, []);

  // Seleciona um filtro e persiste a escolha.
  const selectFilter = (idv: string) => {
    setActiveFilterId(idv);
    if (typeof window !== 'undefined') localStorage.setItem('arbbets:filter', idv);
  };

  // Carrega a config do filtro ativo e REFLETE nos filtros rápidos (lucro/esporte/casa).
  useEffect(() => {
    if (!activeFilterId) { setActiveFilter(null); return; }
    let active = true;
    apiGateway.getFilterById(activeFilterId)
      .then((r) => {
        if (!active || r.data?.result !== 1) return;
        const f = r.data.data as FilterDTO;
        setActiveFilter(f);
        setProfitMin(String(f.profitMin ?? 0));
        setSport(f.sports?.length === 1 ? f.sports[0] : '');
        setBookmaker(f.bookmakers?.length === 1 ? f.bookmakers[0] : '');
      })
      .catch(() => {});
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilterId]);

  // Aplica filtros rápidos (esporte/busca/lucro/mercado/casa) + o filtro salvo ativo.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = parseFloat(profitMin) || 0;
    const f = activeFilter;
    return data
      .filter((e) => (!sport || (e.sport || '').toLowerCase() === sport.toLowerCase()))
      .filter((e) => (!f?.sports?.length || f.sports.map((s) => s.toLowerCase()).includes((e.sport || '').toLowerCase())))
      .filter((e) => (!q || `${e.home} ${e.away} ${e.league}`.toLowerCase().includes(q)))
      .map((e) => ({
        event: e,
        surebets: e.surebets.filter((sb) => {
          if (sb.profitMargin < min) return false;
          if (category !== 'all' && !sb.marketTypes.some((m) => marketCategory(m) === category)) return false;
          if (bookmaker && !sb.surebet.some((l) => l.bookmaker === bookmaker)) return false;
          if (f) {
            if (f.profitMin != null && sb.profitMargin < f.profitMin) return false;
            if (f.profitMax && f.profitMax > 0 && sb.profitMargin > f.profitMax) return false;
            if (f.bookmakers?.length && !sb.surebet.every((l) => f.bookmakers.includes(l.bookmaker))) return false;
            if (f.oddsMin != null && f.oddsMin !== 0 && sb.surebet.some((l) => l.price < f.oddsMin)) return false;
            if (f.oddsMax && f.oddsMax > 0 && sb.surebet.some((l) => l.price > f.oddsMax)) return false;
            if ((f.ageMin && f.ageMin > 0) || (f.ageMax && f.ageMax > 0)) {
              const age = (Date.now() - new Date(sb.create_at).getTime()) / 1000;
              if (f.ageMin && f.ageMin > 0 && age < f.ageMin) return false;
              if (f.ageMax && f.ageMax > 0 && age > f.ageMax) return false;
            }
          }
          return true;
        })
      }))
      .filter((x) => x.surebets.length > 0);
  }, [data, sport, search, profitMin, category, bookmaker, activeFilter]);

  // Visão "por surebet": achata e ordena por lucro OU por tempo (mais recente).
  const flat = useMemo(
    () => filtered.flatMap((x) => x.surebets.map((sb) => ({ event: x.event, sb }))).sort((a, b) =>
      sortMode === 'time'
        ? new Date(b.sb.create_at).getTime() - new Date(a.sb.create_at).getTime()
        : b.sb.profitMargin - a.sb.profitMargin
    ),
    [filtered, sortMode]
  );

  const totalSurebets = flat.length;
  const activeFilters = [sport, category !== 'all', bookmaker, (parseFloat(profitMin) || 0) > 0].filter(Boolean).length;
  const clearFilters = () => { setSport(''); setCategory('all'); setBookmaker(''); setProfitMin('0'); };

  // Opções de casa com logo + nome na cor (BookmakerTag) no Select.
  const { bookmakers, getBookmaker } = useBookmakers();
  const bookmakerOptions = useMemo(() => [
    { value: '', label: 'Todas as casas' },
    ...houses.map((slug) => {
      const b = getBookmaker(slug);
      return {
        value: slug,
        label: b?.name || slug,
        color: b?.color || undefined,
        icon: <BookmakerLogo name={b?.name || slug} slug={slug} logoUrl={b?.logoUrl} color={b?.color} size={16} />
      };
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [houses, bookmakers]);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Zap className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ArbBets</h1>
            <p className="text-sm text-gray-400">Surebets entre as casas monitoradas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white tabular-nums">{totalSurebets}</div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">surebets</div>
          </div>
          <button
            onClick={() => setAutoUpdate((v) => !v)}
            className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-teal-500/15 border-teal-500/40 text-teal-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
            title={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}
          >
            <RefreshCcw size={16} className={autoUpdate && loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Abas tipo (prematch/live) + visão */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {([['prematch', 'Pré-jogo'], ['live', 'Ao vivo']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${type === v ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {([['surebets', 'Por surebet'], ['events', 'Por evento']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${view === v ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: busca + filtro salvo + botão Filtros (popover) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar evento, liga..." className={`${inputClass} pl-9`} />
        </div>

        {/* Filtro salvo do usuário */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Select
            className="w-44"
            value={activeFilterId}
            onChange={selectFilter}
            options={[{ value: '', label: 'Sem filtro salvo' }, ...savedFilters.map((f) => ({ value: f.id, label: f.name }))]}
          />
          <button
            onClick={() => router.push({ pathname: '/arbbets', query: { ...router.query, modal: 'user', page: 'abfilter' } }, undefined, { shallow: true })}
            className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-teal-300 transition"
            title="Gerenciar filtros"
          >
            <Settings size={15} />
          </button>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
              filtersOpen || activeFilters > 0 ? 'bg-teal-500/15 border-teal-500/40 text-teal-200' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            }`}
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilters > 0 && (
              <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-teal-500 text-[10px] font-bold text-slate-900">{activeFilters}</span>
            )}
            <ChevronDown size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>

          {filtersOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
              <div className="absolute right-0 mt-2 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Filtros</span>
                  {activeFilters > 0 && (
                    <button onClick={clearFilters} className="text-xs text-rose-300 hover:text-rose-200">Limpar tudo</button>
                  )}
                </div>

                <div className="block text-xs text-gray-400">
                  Lucro mínimo (%)
                  <input value={profitMin} onChange={(e) => setProfitMin(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
                </div>
                <div className="block text-xs text-gray-400">
                  Mercado
                  <Select className="mt-1" value={category} onChange={setCategory} options={CATEGORIES} />
                </div>
                <div className="block text-xs text-gray-400">
                  Esporte
                  <Select className="mt-1" value={sport} onChange={setSport}
                    options={[{ value: '', label: 'Todos os esportes' }, ...sports.map((s) => ({ value: s, label: s }))]} />
                </div>
                <div className="block text-xs text-gray-400">
                  Casa
                  <Select className="mt-1" value={bookmaker} onChange={setBookmaker} options={bookmakerOptions} />
                </div>
                <div className="block text-xs text-gray-400">
                  Ordenar por
                  <Select
                    className="mt-1"
                    value={sortMode}
                    onChange={(v) => setSortMode(v as 'profit' | 'time')}
                    options={[{ value: 'profit', label: 'Maior lucro' }, { value: 'time', label: 'Mais recentes (tempo)' }]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCcw className="animate-spin mr-2" size={20} /> Carregando surebets...
        </div>
      ) : totalSurebets === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-20 text-center">
          <Trophy className="mx-auto text-gray-600 mb-3" size={32} />
          <p className="text-gray-400">Nenhuma surebet {type === 'live' ? 'ao vivo' : 'pré-jogo'} para os filtros aplicados.</p>
        </div>
      ) : view === 'surebets' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
          {flat.map(({ event, sb }, i) => (
            <div key={`${event.id}-${i}`} className="rounded-xl border border-white/10 bg-white/5 p-2">
              <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{event.home} <span className="text-gray-500 font-normal">x</span> {event.away}</div>
                  <div className="text-[10px] text-gray-500 truncate">{event.league || event.sport}</div>
                </div>
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5 shrink-0"><Clock size={9} /> {ageOf(sb.create_at)} · {fmtDate(event.date)}</span>
              </div>
              <SurebetCompact event={event} sb={sb} onCalc={() => setCalc({ event, sb })} onExplain={() => openExplain(event, sb)} onOdd={(leg) => setOddModal({ event, leg })} />
            </div>
          ))}
        </div>
      ) : (
        // Por evento: lista compacta mostrando só a MELHOR surebet; +N abre modal com todas.
        // TODO: respeitar o plano da conta (não-pago: só surebets >= 1%). Desativado por enquanto.
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {filtered
            .map(({ event, surebets }) => {
              const ordered = [...surebets].sort((a, b) => b.profitMargin - a.profitMargin);
              const newest = Math.max(...surebets.map((sb) => new Date(sb.create_at).getTime()));
              return { event, ordered, best: ordered[0], newest };
            })
            .sort((a, b) => (sortMode === 'time' ? b.newest - a.newest : b.best.profitMargin - a.best.profitMargin))
            .map(({ event, ordered, best }) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{event.home} <span className="text-gray-500 font-normal">x</span> {event.away}</div>
                    <div className="text-[10px] text-gray-500 truncate">{event.league || event.sport} · {fmtDate(event.date)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ${profitTone(best.profitMargin)}`}>
                      <TrendingUp size={12} /> {best.profitMargin.toFixed(2)}%
                    </span>
                    {ordered.length > 1 && (
                      <button
                        onClick={() => setEventModal({ event, surebets: ordered })}
                        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 text-gray-300 ring-1 ring-white/10 transition"
                        title={`Ver as ${ordered.length} surebets deste evento`}
                      >
                        <Layers size={12} /> +{ordered.length - 1}
                      </button>
                    )}
                  </div>
                </div>
                <SurebetCompact event={event} sb={best} onCalc={() => setCalc({ event, sb: best })} onExplain={() => openExplain(event, best)} onOdd={(leg) => setOddModal({ event, leg })} />
              </div>
            ))}
        </div>
      )}

      {calc && <CalcModal event={calc.event} sb={calc.sb} onClose={() => setCalc(null)} defaultStake={activeFilter?.stake} />}
      {eventModal && (
        <EventModal
          event={eventModal.event}
          surebets={eventModal.surebets}
          onClose={() => setEventModal(null)}
          onCalc={(sb) => { setEventModal(null); setCalc({ event: eventModal.event, sb }); }}
          onExplain={(sb) => openExplain(eventModal.event, sb)}
          onOdd={(leg) => setOddModal({ event: eventModal.event, leg })}
        />
      )}
      {explain && <ExplainModal marketIds={explain.marketIds} home={explain.home} away={explain.away} onClose={() => setExplain(null)} />}
      {oddModal && <OddModal event={oddModal.event} leg={oddModal.leg} onClose={() => setOddModal(null)} />}
    </div>
  );
}

// Paleta de fallback para as linhas (quando a casa não tem cor cadastrada).
const LINE_PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#a3e635'];

interface HistRow { recordedAt: string; price: number | string; selection: string; handicap: string }
type SeriesPoint = { t: number; price: number };

// Das linhas cruas (uma casa/mercado), escolhe a série da seleção cujo PREÇO ATUAL
// bate com a odd alvo (robusto à diferença de rótulo entre surebet e odds_history).
function pickSeries(rows: HistRow[], target: number): SeriesPoint[] {
  if (!rows.length) return [];
  const groups = new Map<string, SeriesPoint[]>();
  for (const r of rows) {
    const k = `${r.selection}|${r.handicap || ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push({ t: new Date(r.recordedAt).getTime(), price: Number(r.price) });
  }
  let bestK = '', bestDiff = Infinity;
  for (const [k, arr] of groups) {
    arr.sort((a, b) => a.t - b.t);
    const latest = arr[arr.length - 1].price;
    const d = Math.abs(latest - target);
    if (d < bestDiff) { bestDiff = d; bestK = k; }
  }
  return groups.get(bestK) || [];
}

interface ChartSeries { label: string; name: string; color: string; points: SeriesPoint[] }

// Gráfico de linhas: cada linha = uma casa de aposta (odd ao longo do tempo).
function MultiLineChart({ series, focus }: { series: ChartSeries[]; focus?: string }) {
  const [hover, setHover] = useState<{ x: number; y: number; name: string; price: number; color: string; t: number } | null>(null);
  const all = series.flatMap((s) => s.points);
  if (all.length < 1) return null;
  const W = 600, H = 190, padL = 40, padR = 12, padT = 12, padB = 22;
  const ts = all.map((p) => p.t), ps = all.map((p) => p.price);
  let tmin = Math.min(...ts), tmax = Math.max(...ts);
  const sameTime = tmin === tmax; // só ponto atual (sem movimentação)
  if (sameTime) tmax = tmin + 1;
  let pmin = Math.min(...ps), pmax = Math.max(...ps); if (pmin === pmax) { pmin -= 0.1; pmax += 0.1; }
  const pd = (pmax - pmin) * 0.12; pmin -= pd; pmax += pd;
  const x = (t: number) => sameTime ? padL + (W - padL - padR) / 2 : padL + ((t - tmin) / (tmax - tmin)) * (W - padL - padR);
  const y = (p: number) => padT + (1 - (p - pmin) / (pmax - pmin)) * (H - padT - padB);
  const grid = [0, 0.5, 1].map((f) => ({ y: padT + f * (H - padT - padB), val: pmax - f * (pmax - pmin) }));
  // Curva suave (Catmull-Rom → Bézier) passando pelos pontos.
  const smoothPath = (pts: SeriesPoint[]) => {
    const c = pts.map((p) => ({ x: x(p.t), y: y(p.price) }));
    if (c.length < 2) return '';
    let d = `M ${c[0].x.toFixed(1)} ${c[0].y.toFixed(1)}`;
    for (let i = 0; i < c.length - 1; i++) {
      const p0 = c[i - 1] || c[i], p1 = c[i], p2 = c[i + 1], p3 = c[i + 2] || c[i + 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };
  const fmtX = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="rgba(255,255,255,0.06)" />
          <text x={padL - 4} y={g.y + 3} textAnchor="end" fontSize="9" fill="#6b7280">{g.val.toFixed(2)}</text>
        </g>
      ))}
      {series.map((s) => s.points.length >= 2 && (
        <path key={s.label} d={smoothPath(s.points)} fill="none" stroke={s.color} strokeWidth={focus && focus !== s.label ? 1 : 2.2}
          strokeOpacity={focus && focus !== s.label ? 0.35 : 1} strokeLinejoin="round" />
      ))}
      {series.map((s) => s.points.map((p, i) => {
        const cx = x(p.t), cy = y(p.price);
        const dim = !!focus && focus !== s.label;
        return (
          <g key={`${s.label}-${i}`}>
            <circle cx={cx} cy={cy} r={2.5} fill={s.color} fillOpacity={dim ? 0.4 : 1} />
            {/* área de hover maior + tooltip com o nome da casa */}
            <circle cx={cx} cy={cy} r={9} fill="transparent" style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover({ x: cx, y: cy, name: s.name, price: p.price, color: s.color, t: p.t })}
              onMouseLeave={() => setHover(null)} />
          </g>
        );
      }))}
      <text x={padL} y={H - 6} fontSize="9" fill="#6b7280">{fmtX(tmin)}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="#6b7280">{fmtX(tmax)}</text>
      {hover && (() => {
        const bw = Math.max(92, hover.name.length * 6.2 + 22);
        const bh = 44;
        const bx = Math.min(Math.max(hover.x - bw / 2, padL), W - padR - bw);
        const by = Math.max(hover.y - bh - 8, 2);
        return (
          <g pointerEvents="none">
            <rect x={bx} y={by} width={bw} height={bh} rx={5} fill="#0b1220" stroke="rgba(255,255,255,0.15)" />
            <circle cx={bx + 9} cy={by + 12} r={3} fill={hover.color} />
            <text x={bx + 17} y={by + 15} fontSize="10" fontWeight="700" fill="#e5e7eb">{hover.name}</text>
            <text x={bx + 9} y={by + 28} fontSize="11" fontWeight="700" fill="#5eead4" className="tabular-nums">{hover.price.toFixed(2)}</text>
            <text x={bx + 9} y={by + 39} fontSize="8" fill="#6b7280">{fmtX(hover.t)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

// ---- Modal de uma odd: outras casas com a mesma seleção + histórico (backend) ----
function OddModal({ event, leg, onClose }: { event: SurebetData; leg: SurebetOdd; onClose: () => void }) {
  const { getBookmaker } = useBookmakers();

  // Casas com esta seleção: a da surebet + alternativas, deduplicadas por casa.
  const houses = useMemo(() => {
    const m = new Map<string, { bookmaker: string; price: number; eventId: string; used: boolean }>();
    m.set(leg.bookmaker.toLowerCase(), { bookmaker: leg.bookmaker, price: leg.price, eventId: leg.eventId, used: true });
    for (const o of leg.otherOdds || []) {
      const k = (o.bookmaker || '').toLowerCase();
      if (!m.has(k)) m.set(k, { bookmaker: o.bookmaker, price: o.price, eventId: o.eventId, used: false });
    }
    return Array.from(m.values()).sort((a, b) => b.price - a.price);
  }, [leg]);
  const best = houses.length ? houses[0].price : 0;

  const colorFor = (slug: string, idx: number) => getBookmaker(slug)?.color || LINE_PALETTE[idx % LINE_PALETTE.length];

  const [histByHouse, setHistByHouse] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<string>(leg.bookmaker);

  // Busca o histórico (odds_history) de cada casa pelo backend.
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const out: Record<string, SeriesPoint[]> = {};
      await Promise.all(houses.map(async (h) => {
        try {
          const res = await apiGateway.getExternalEventHistory(h.bookmaker, h.eventId, { marketId: leg.market, limit: 300 });
          const rows: HistRow[] = res.data?.result === 1 ? (res.data.data || []) : [];
          const picked = pickSeries(rows, h.price);
          // Sem histórico no banco → ao menos o ponto atual (a odd de agora).
          out[h.bookmaker] = picked.length ? picked : [{ t: Date.now(), price: h.price }];
        } catch { out[h.bookmaker] = []; }
      }));
      if (active) { setHistByHouse(out); setLoading(false); }
    })();
    return () => { active = false; };
  }, [houses, leg.market]);

  const series: ChartSeries[] = houses.map((h, i) => ({
    label: h.bookmaker,
    name: getBookmaker(h.bookmaker)?.name || h.bookmaker,
    color: colorFor(h.bookmaker, i),
    points: histByHouse[h.bookmaker] || []
  }));
  const hasAnyHist = series.some((s) => s.points.length >= 1);
  const focusSeries = series.find((s) => s.label === focus);
  const fmtT = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <div className="mb-4 pr-8">
          <div className="text-xs text-teal-300/80">{marketLabel(leg.market)}</div>
          <h2 className="text-base font-bold text-white">{optionLabel(leg.option, event.home, event.away)}</h2>
          <p className="text-[11px] text-gray-500">{event.home} x {event.away}</p>
        </div>

        {/* Gráfico multi-linha (uma linha por casa) */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-xs"><RefreshCcw className="animate-spin mr-2" size={16} /> Carregando histórico...</div>
          ) : hasAnyHist ? (
            <MultiLineChart series={series} focus={focus} />
          ) : (
            <div className="py-8 text-center text-xs text-gray-500">Sem histórico de movimentação para esta seleção.</div>
          )}
        </div>

        {/* Casas com esta seleção (clique para focar a linha) */}
        <div className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">Esta seleção em outras casas {loading && '(carregando histórico…)'}</div>
        <div className="space-y-1">
          {houses.map((h, i) => {
            const isFocus = focus === h.bookmaker;
            return (
              <button
                key={`${h.bookmaker}-${i}`}
                onClick={() => setFocus(h.bookmaker)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ring-1 transition text-left ${isFocus ? 'bg-teal-500/10 ring-teal-500/40' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorFor(h.bookmaker, i) }} />
                  <BookmakerTag slug={h.bookmaker} size={15} />
                  {h.used && <span className="text-[9px] uppercase text-teal-300/80">na surebet</span>}
                </div>
                <span className={`text-sm font-bold tabular-nums ${h.price === best ? 'text-emerald-300' : 'text-gray-200'}`}>{Number(h.price).toFixed(2)}</span>
              </button>
            );
          })}
        </div>

        {/* Histórico detalhado da casa focada */}
        {!loading && focusSeries && focusSeries.points.length >= 2 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Mudanças — {focus}</div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {[...focusSeries.points].reverse().map((p, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? p.price - prev.price : 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded bg-black/20 px-2.5 py-1 text-[11px]">
                    <span className="text-gray-500">{fmtT(p.t)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-gray-200">{p.price.toFixed(2)}</span>
                      {prev && <span className={`tabular-nums ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-gray-600'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '–'}{d !== 0 ? Math.abs(d).toFixed(2) : ''}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Modal com TODAS as surebets de um evento ----
function EventModal({ event, surebets, onClose, onCalc, onExplain, onOdd }: {
  event: SurebetData; surebets: Surebet[]; onClose: () => void; onCalc: (sb: Surebet) => void; onExplain: (sb: Surebet) => void; onOdd: (leg: SurebetOdd) => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-brand-dark border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <div className="mb-4 pr-8">
          <h2 className="text-base font-bold text-white truncate">{event.home} <span className="text-gray-500 font-normal">x</span> {event.away}</h2>
          <p className="text-xs text-gray-400">{event.league || event.sport} · {fmtDate(event.date)} · {surebets.length} surebets</p>
        </div>
        <div className="space-y-2">
          {surebets.map((sb, i) => <SurebetCompact key={i} event={event} sb={sb} onCalc={() => onCalc(sb)} onExplain={() => onExplain(sb)} onOdd={onOdd} />)}
        </div>
      </div>
    </div>
  );
}

// ---- Modal de explicação do mercado (se molda conforme o mercado) ----
function ExplainModal({ marketIds, home, away, onClose }: {
  marketIds: string[]; home: string; away: string; onClose: () => void;
}) {
  const uniq = Array.from(new Set(marketIds));
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-brand-dark border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <div className="flex items-center gap-2 mb-4 pr-8 text-teal-300"><HelpCircle size={18} /><span className="text-xs uppercase tracking-wider">Como funciona o mercado</span></div>

        <div className="space-y-5">
          {uniq.map((mid) => {
            const ex = explainMarket(mid, home, away);
            return (
              <div key={mid}>
                <h2 className="text-base font-bold text-white">{ex.title}</h2>
                <p className="text-sm text-gray-400 mt-1">{ex.summary}</p>

                {ex.rows.length > 0 && (
                  <div className="mt-3 rounded-xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-gray-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Seleção</th>
                          <th className="px-3 py-2 font-medium">Condição</th>
                          <th className="px-3 py-2 font-medium hidden sm:table-cell">Exemplos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {ex.rows.map((r, i) => (
                          <tr key={i} className="align-top">
                            <td className="px-3 py-2 font-semibold text-gray-100 whitespace-nowrap">{r.selection}</td>
                            <td className="px-3 py-2 text-gray-300">{r.condition}</td>
                            <td className="px-3 py-2 text-gray-500 hidden sm:table-cell whitespace-nowrap">{r.examples || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 flex items-start gap-2 rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30 px-3 py-2 text-xs text-teal-200">
                  <TrendingUp size={14} className="shrink-0 mt-0.5" />
                  <span>{ex.coverage}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Divisão equilibrada (retornos iguais): stake proporcional a 1/odd.
function balancedStakes(odds: number[], base: number): number[] {
  const inv = odds.map((o) => (o > 0 ? 1 / o : 0));
  const sum = inv.reduce((a, b) => a + b, 0) || 1;
  return inv.map((i) => (base * i) / sum);
}

// ---- Calculadora (total, odd, comissão e stake por casa — tudo editável) ----
const num = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;
const fmt = (n: number) => n.toFixed(2);
// Odd efetiva com comissão (modelo de exchange: comissão incide sobre o lucro).
const effOdd = (odd: number, commFrac: number) => (odd > 0 ? 1 + (odd - 1) * (1 - commFrac) : 0);

function CalcModal({ event, sb, onClose, defaultStake }: { event: SurebetData; sb: Surebet; onClose: () => void; defaultStake?: number }) {
  const { getBookmaker } = useBookmakers();
  const base0 = defaultStake && defaultStake > 0 ? defaultStake : 1000;
  const [oddsStr, setOddsStr] = useState<string[]>(sb.surebet.map((l) => String(l.price)));
  const [stakesStr, setStakesStr] = useState<string[]>([]);
  const [totalStr, setTotalStr] = useState(String(base0));
  const [showComm, setShowComm] = useState(false);
  const [commStr, setCommStr] = useState<string[]>(sb.surebet.map(() => '0'));
  const [roundEnabled, setRoundEnabled] = useState(false);
  const [roundStr, setRoundStr] = useState('1');
  // Casa escolhida por perna (permite trocar a casa daquela seleção).
  const [houseStr, setHouseStr] = useState<string[]>(sb.surebet.map((l) => l.bookmaker));

  // Inicializa/reseta ao trocar de surebet.
  useEffect(() => {
    const odds = sb.surebet.map((l) => Number(l.price) || 0);
    setOddsStr(sb.surebet.map((l) => String(l.price)));
    setStakesStr(balancedStakes(odds, base0).map(fmt));
    setCommStr(sb.surebet.map(() => '0'));
    setHouseStr(sb.surebet.map((l) => l.bookmaker));
    setTotalStr(String(base0));
  }, [sb, base0]);

  // Casas que oferecem a mesma seleção da perna (a própria + otherOdds), deduplicadas.
  const housesForLeg = (i: number) => {
    const leg = sb.surebet[i];
    const m = new Map<string, { bookmaker: string; price: number }>();
    m.set(leg.bookmaker.toLowerCase(), { bookmaker: leg.bookmaker, price: leg.price });
    for (const o of leg.otherOdds || []) {
      const k = (o.bookmaker || '').toLowerCase();
      if (!m.has(k)) m.set(k, { bookmaker: o.bookmaker, price: o.price });
    }
    return Array.from(m.values()).sort((a, b) => b.price - a.price);
  };

  const odds = oddsStr.map(num);
  const comm = commStr.map((c) => (showComm ? num(c) / 100 : 0));
  const eOdds = odds.map((o, i) => effOdd(o, comm[i] || 0));
  const stakes = stakesStr.map(num);
  const returns = stakes.map((s, i) => s * (eOdds[i] || 0));
  const total = stakes.reduce((a, b) => a + b, 0);
  const guaranteed = returns.length ? Math.min(...returns) : 0;
  const bestReturn = returns.length ? Math.max(...returns) : 0;
  const profit = guaranteed - total;
  const profitPct = total ? (profit / total) * 100 : 0;
  const isSure = profit > 0;
  const hasComm = showComm && comm.some((c) => c > 0);
  const step = num(roundStr);
  const applyRound = (arr: number[]) => (roundEnabled && step > 0 ? arr.map((s) => Math.round(s / step) * step) : arr);

  // IMPORTANTE: as stakes são distribuídas pelas ODDS BRUTAS (a comissão NÃO mexe
  // na distribuição). A comissão só reduz o RETORNO da casa que vencer. Assim os
  // retornos ficam diferentes: a ponta com comissão rende menos; a outra, o cheio.

  // Edita o TOTAL → redistribui pelas odds brutas.
  const setTotal = (v: string) => {
    setTotalStr(v);
    setStakesStr(applyRound(balancedStakes(odds, num(v))).map(fmt));
  };
  // Edita o STAKE de uma casa → ancora nela; as outras rebalanceiam pelas odds brutas.
  const setStake = (i: number, v: string) => {
    const val = num(v);
    if (val <= 0) { setStakesStr((p) => p.map((s, j) => (j === i ? v : s))); return; }
    const r = val * (odds[i] || 0);
    const next = odds.map((o, j) => (j === i ? v : o > 0 ? fmt(r / o) : '0'));
    setStakesStr(next);
    setTotalStr(fmt(next.reduce((a, s) => a + num(s), 0)));
  };
  // Edita a ODD → recalcula stakes (odds brutas) mantendo o total.
  const setOdd = (i: number, v: string) => {
    const nextOdds = oddsStr.map((o, j) => (j === i ? v : o));
    setOddsStr(nextOdds);
    setStakesStr(applyRound(balancedStakes(nextOdds.map(num), total)).map(fmt));
  };
  // Troca a CASA da perna → adota a odd daquela casa (e recalcula).
  const setHouse = (i: number, slug: string) => {
    setHouseStr((p) => p.map((s, j) => (j === i ? slug : s)));
    const h = housesForLeg(i).find((x) => x.bookmaker === slug);
    if (h) setOdd(i, String(h.price));
  };
  // Edita a COMISSÃO → só muda o retorno daquela casa (não mexe nas stakes).
  const setComm = (i: number, v: string) => {
    setCommStr((p) => p.map((c, j) => (j === i ? v : c)));
  };
  // Liga/desliga arredondamento → redistribui pelas odds brutas.
  const redistribute = (roundOn: boolean) => {
    const arr = balancedStakes(odds, total);
    const r = roundOn && step > 0 ? arr.map((s) => Math.round(s / step) * step) : arr;
    setStakesStr(r.map(fmt));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-3xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* alça do bottom-sheet (mobile) */}
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <div className="mb-4 pr-8">
          <div className="flex items-center gap-1.5 text-xs text-teal-300/80"><Calculator size={13} /> {sb.marketTypes.map(marketLabel).join(' · ')}</div>
          <h2 className="text-lg font-bold text-white">{event.home} <span className="text-gray-500 font-normal">x</span> {event.away}</h2>
        </div>

        {/* Valor total */}
        <div className="mb-3">
          <label className="block text-xs text-gray-400">
            Valor total a investir (R$)
            <input value={totalStr} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1 text-base`} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs text-gray-300">
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Comissão da casa (exchange) — incide só sobre o lucro da casa que vencer">
            <input type="checkbox" checked={showComm} onChange={(e) => setShowComm(e.target.checked)} className="accent-teal-500" />
            Comissões
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={roundEnabled} onChange={(e) => { setRoundEnabled(e.target.checked); redistribute(e.target.checked); }} className="accent-teal-500" />
            Arredondar até
            <input
              value={roundStr}
              onChange={(e) => { setRoundStr(e.target.value); if (roundEnabled) { const s = num(e.target.value); if (s > 0) setStakesStr(balancedStakes(odds, total).map((x) => fmt(Math.round(x / s) * s))); } }}
              disabled={!roundEnabled}
              className={`${inputClass} w-14 text-center py-1 disabled:opacity-40`}
            />
          </label>
        </div>

        {/* Cabeçalho das colunas (desktop) */}
        <div className="hidden sm:flex items-center gap-2 px-2 mb-1 text-[10px] uppercase tracking-wider text-gray-500">
          <span className="w-[160px]">Casa</span>
          <span className="w-20 text-center">Odd</span>
          {showComm && <span className="w-16 text-center">Com.%</span>}
          <span className="flex-1 text-center">Apostar (R$)</span>
          <span className="w-24 text-right">Retorna</span>
        </div>

        {/* Pernas: UMA LINHA por casa (compacto) */}
        <div className="space-y-1.5">
          {sb.surebet.map((leg, i) => {
            const legProfit = (returns[i] || 0) - total;
            const legHouses = housesForLeg(i);
            const houseOpts = legHouses.map((h) => {
              const b = getBookmaker(h.bookmaker);
              return {
                value: h.bookmaker,
                label: `${b?.name || h.bookmaker} — ${h.price.toFixed(2)}`,
                color: b?.color || undefined,
                icon: <BookmakerLogo name={b?.name || h.bookmaker} slug={h.bookmaker} logoUrl={b?.logoUrl} color={b?.color} size={14} />
              };
            });
            return (
              <div key={i} className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-white/5 ring-1 ring-white/10 px-2 py-1.5">
                <div className="w-[120px] sm:w-[160px] min-w-0 shrink-0">
                  {houseOpts.length > 1
                    ? <Select value={houseStr[i] ?? leg.bookmaker} onChange={(v) => setHouse(i, v)} options={houseOpts} buttonClassName="py-1 px-2 text-xs" />
                    : <BookmakerTag slug={houseStr[i] ?? leg.bookmaker} size={14} nameClassName="text-[11px]" />}
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">{optionLabel(leg.option, event.home, event.away)}</div>
                </div>
                <input value={oddsStr[i] ?? ''} onChange={(e) => setOdd(i, e.target.value)} inputMode="decimal" aria-label="Odd"
                  className={`${fieldBase} w-14 sm:w-20 shrink-0 text-center py-1.5 px-1`} />
                {showComm && (
                  <input value={commStr[i] ?? ''} onChange={(e) => setComm(i, e.target.value)} inputMode="decimal" aria-label="Comissão %"
                    className={`${fieldBase} w-12 sm:w-16 shrink-0 text-center py-1.5 px-1`} />
                )}
                <input value={stakesStr[i] ?? ''} onChange={(e) => setStake(i, e.target.value)} inputMode="decimal" aria-label="Apostar"
                  className={`${fieldBase} w-full flex-1 min-w-0 text-center py-1.5 px-1 font-bold text-teal-200`} />
                <div className="w-[68px] sm:w-24 text-right shrink-0">
                  <div className="text-sm font-bold tabular-nums text-white leading-none">{returns[i]?.toFixed(2) ?? '0.00'}</div>
                  <div className={`text-[10px] tabular-nums ${legProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {legProfit >= 0 ? '+' : ''}{legProfit.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo */}
        <div className={`mt-4 rounded-xl p-3 ring-1 ${isSure ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-rose-500/10 ring-rose-500/30'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Total</div>
              <div className="text-lg font-bold tabular-nums text-white">{total.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Retorno garantido</div>
              <div className="text-lg font-bold tabular-nums text-white">{guaranteed.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Lucro</div>
              <div className={`text-lg font-bold tabular-nums ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{profit >= 0 ? '+' : ''}{profit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400">Lucro %</div>
              <div className={`text-lg font-bold tabular-nums ${profitPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%</div>
            </div>
          </div>
          {!isSure && <div className="mt-2 text-center text-[11px] text-rose-300">Com estas odds (e comissões) não há lucro garantido.</div>}
        </div>

        {/* Explicação da comissão por seleção */}
        {hasComm && (
          <div className="mt-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3 text-[11px] text-gray-400 leading-relaxed">
            A comissão só é cobrada na casa que <b className="text-gray-200">vencer</b> (sobre o lucro). Por isso o retorno
            varia conforme quem ganha:
            {' '}vencendo a ponta com comissão, o lucro é <b className="text-amber-300">+{profit.toFixed(2)}</b> (garantido — pior caso);
            {' '}vencendo a outra, o lucro vai até <b className="text-emerald-300">+{(bestReturn - total).toFixed(2)}</b> (sem comissão).
            {' '}As stakes são distribuídas pelas <b className="text-gray-200">odds brutas</b> — a comissão não altera os valores apostados.
          </div>
        )}
      </div>
    </div>
  );
}
