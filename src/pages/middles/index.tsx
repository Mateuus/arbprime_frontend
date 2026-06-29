import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Split, RefreshCcw, Search, Zap, Filter, ChevronDown, ChevronRight, HelpCircle, LayoutGrid, List, Trophy, Clock, EyeOff, Settings } from 'lucide-react';
import { useMiddles } from '@/hooks/useMiddles';
import { useUserContext } from '@/context/UserContext';
import { useHiddenSet } from '@/hooks/useHiddenSet';
import { apiGateway } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { MiddleCard } from '@/components/middles/MiddleCard';
import { MiddleCalcModal } from '@/components/middles/MiddleCalcModal';
import { MiddleEventModal } from '@/components/middles/MiddleEventModal';
import HiddenItemsModal from '@/components/arbbets/HiddenItemsModal';
import { MiddleData, Middle } from '@/interfaces/middle.interface';
import { FilterDTO } from '@/interfaces';
import { marketLabel } from '@/utils/surebet';
import { fmtDateTime, fmtSigned, evTone, toHiddenLeg } from '@/utils/middle';
import { detectExtension } from '@/utils/arbExtension';
import { InfoTopicModal } from '@/components/info/infoTopics';

const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition';
const inputClass = `w-full ${fieldBase}`;

// Piso do EV (emissor usa evMinPct = -0.5 p/ incluir free middles). Slider parte daqui.
const EV_FLOOR = -0.5;

// Item plano: um middle + o grupo (jogo) a que pertence.
interface FlatMiddle { event: MiddleData; m: Middle }

export default function MiddlesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();

  const [autoUpdate, setAutoUpdate] = useState(true);
  useEffect(() => { void detectExtension(); }, []);
  const { data, loading } = useMiddles('prematch', autoUpdate, isAuthenticated);

  const [search, setSearch] = useState('');
  // Filtro salvo do usuário (ABFilter) — o MESMO preset das surebets/arbbets. O
  // usuário escolhe; aplicamos as CASAS do preset aos middles (não reinventa a roda).
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string }[]>([]);
  const [activeFilterId, setActiveFilterId] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterDTO | null>(null);
  const [league, setLeague] = useState('');
  const [marketId, setMarketId] = useState('');
  const [evMin, setEvMin] = useState(EV_FLOOR);
  const [pGapMin, setPGapMin] = useState(0);
  const [gapFullOnly, setGapFullOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'ev' | 'pgap' | 'time'>('ev');
  const [viewMode, setViewMode] = useState<'middle' | 'event'>('middle');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Calculadora de stake + modal "Por evento" (guarda só o id p/ ficar vivo no refresh).
  const [calc, setCalc] = useState<{ event: MiddleData; m: Middle } | null>(null);
  const [eventModalId, setEventModalId] = useState<string | null>(null);

  // Ocultação pessoal (reaproveita o useHiddenSet das surebets — mesmas chaves).
  const hidden = useHiddenSet();
  const [hiddenOpen, setHiddenOpen] = useState(false);

  // Toast simples de feedback.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Carrega a lista de filtros salvos e auto-seleciona (lembra a escolha; senão o 1º).
  useEffect(() => {
    apiGateway.getUserFilters()
      .then((r) => {
        if (r.data?.result !== 1 || !Array.isArray(r.data.data)) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: { id: string; name: string }[] = r.data.data.map((f: any) => ({ id: String(f.id), name: f.name }));
        setSavedFilters(list);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('middles:filter') : null;
        if (stored === null) { if (list.length) setActiveFilterId(list[0].id); } // 1ª vez → primeiro filtro
        else if (stored && list.some((f) => f.id === stored)) setActiveFilterId(stored); // lembra a escolha
        // stored === '' → usuário escolheu "Sem filtro", respeita
      })
      .catch(() => {});
  }, []);
  const selectFilter = (idv: string) => {
    setActiveFilterId(idv);
    if (typeof window !== 'undefined') localStorage.setItem('middles:filter', idv);
  };
  // Carrega a config do filtro ativo — usamos as CASAS dele p/ filtrar os middles.
  useEffect(() => {
    if (!activeFilterId) { setActiveFilter(null); return; }
    let active = true;
    apiGateway.getFilterById(activeFilterId)
      .then((r) => { if (active && r.data?.result === 1) setActiveFilter(r.data.data as FilterDTO); })
      .catch(() => {});
    return () => { active = false; };
  }, [activeFilterId]);

  // Mercados e campeonatos presentes nos dados (para os selects de filtro).
  const markets = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of data) for (const md of g.middles) if (!m.has(md.market)) m.set(md.market, marketLabel(md.market));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [data]);
  const leagues = useMemo(
    () => Array.from(new Set(data.map((g) => g.league).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [data],
  );

  // Lista plana filtrada + ordenada.
  const items = useMemo<FlatMiddle[]>(() => {
    const q = search.trim().toLowerCase();
    const flat: FlatMiddle[] = [];
    for (const g of data) {
      if (league && g.league !== league) continue;
      if (q && !`${g.home} ${g.away} ${g.league}`.toLowerCase().includes(q)) continue;
      for (const m of g.middles) {
        // Ocultação pessoal: some o middle se o usuário ocultou o evento, a casa ou a seleção.
        if (!hidden.isSurebetVisible(g.id, m.legs.map(toHiddenLeg))) continue;
        // Filtro salvo (preset do usuário): só mostra se TODAS as pernas usam
        // casas do preset — casa fora do preset não aparece. (igual arbbets)
        if (activeFilter?.bookmakers?.length && !m.legs.every((l) => activeFilter.bookmakers.includes(l.bookmaker))) continue;
        if (marketId && m.market !== marketId) continue;
        if (m.ev < evMin) continue;
        if (m.pGap < pGapMin) continue;
        if (gapFullOnly && !m.gapFull) continue;
        flat.push({ event: g, m });
      }
    }
    flat.sort((a, b) => {
      if (sortMode === 'pgap') return (b.m.pGap || 0) - (a.m.pGap || 0);
      if (sortMode === 'time') {
        const ta = new Date(a.event.date).getTime();
        const tb = new Date(b.event.date).getTime();
        const da = Number.isFinite(ta) ? ta : Infinity;
        const db = Number.isFinite(tb) ? tb : Infinity;
        if (da !== db) return da - db;
        return (b.m.ev || 0) - (a.m.ev || 0);
      }
      return (b.m.ev || 0) - (a.m.ev || 0);
    });
    return flat;
  }, [data, search, activeFilter, league, marketId, evMin, pGapMin, gapFullOnly, sortMode, hidden.isSurebetVisible]);

  // Agrupado por evento (modo "Por evento"): preserva a ordem do `items` (já
  // ordenado), então os eventos aparecem na ordem do seu melhor middle.
  const groups = useMemo(() => {
    const map = new Map<string, { event: MiddleData; list: Middle[] }>();
    for (const { event, m } of items) {
      let g = map.get(event.id);
      if (!g) { g = { event, list: [] }; map.set(event.id, g); }
      g.list.push(m);
    }
    return Array.from(map.values());
  }, [items]);

  // Grupo aberto no modal "Por evento" (derivado dos groups vivos pelo id).
  const activeEventGroup = useMemo(
    () => (eventModalId ? groups.find((g) => g.event.id === eventModalId) ?? null : null),
    [eventModalId, groups],
  );

  const total = useMemo(() => data.reduce((acc, g) => acc + g.middles.length, 0), [data]);
  const activeFilters =
    (league ? 1 : 0) + (marketId ? 1 : 0) + (gapFullOnly ? 1 : 0) + (evMin > EV_FLOOR ? 1 : 0) + (pGapMin > 0 ? 1 : 0);

  const openCalc = useCallback((event: MiddleData, m: Middle) => setCalc({ event, m }), []);

  // Proteção: página exclusiva para logados (conteúdo gated, igual surebets).
  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {authLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Verificando acesso...</div>
          ) : (
            <>
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/30 mb-4"><Split className="text-indigo-300" size={24} /></div>
              <h2 className="text-lg font-bold text-white">Entre para ver os middles</h2>
              <p className="text-sm text-gray-400 mt-1 mb-5">As apostas de intervalo (middles) são exclusivas para usuários logados.</p>
              <button
                onClick={() => router.push({ pathname: '/middles', query: { ...router.query, modal: 'auth', page: 'login' } }, undefined, { shallow: true })}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition"
              >
                Fazer login
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-500/5 ring-1 ring-indigo-500/30">
            <Split className="text-indigo-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Middles</h1>
            <p className="text-sm text-gray-400">Apostas de intervalo: caia no miolo e leve os dois lados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white tabular-nums">{total}</div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">middles</div>
          </div>
          <Tooltip label="Itens ocultados (reexibir)">
            <button
              onClick={() => setHiddenOpen(true)}
              className="relative grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-indigo-200 hover:border-indigo-500/40 transition"
              aria-label="Itens ocultados"
            >
              <EyeOff size={16} />
              {hidden.count > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">{hidden.count}</span>}
            </button>
          </Tooltip>
          <Tooltip label="O que é um middle?">
            <button
              onClick={() => setInfoOpen(true)}
              className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-indigo-200 hover:border-indigo-500/40 transition"
              aria-label="O que é um middle?"
            >
              <HelpCircle size={16} />
            </button>
          </Tooltip>
          <Tooltip label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}>
            <button
              onClick={() => setAutoUpdate((v) => !v)}
              className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
              aria-label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}
            >
              <RefreshCcw size={16} className={autoUpdate && loading ? 'animate-spin' : ''} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Toolbar: busca + ordenação + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar evento, liga..." className={`${inputClass} pl-9`} />
        </div>
        {/* Filtro salvo do usuário — mesmo preset (casas) das surebets/arbbets */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Select
            className="w-40"
            value={activeFilterId}
            onChange={selectFilter}
            options={[{ value: '', label: 'Sem filtro salvo' }, ...savedFilters.map((f) => ({ value: f.id, label: f.name }))]}
          />
          <button
            onClick={() => router.push({ pathname: router.pathname, query: { ...router.query, modal: 'user', page: 'abfilter' } }, undefined, { shallow: true })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-indigo-300"
            title="Gerenciar filtros salvos"
          >
            <Settings size={15} />
          </button>
        </div>
        {/* Listar por middle (lista plana) ou por evento (agrupado) */}
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => setViewMode('middle')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'middle' ? 'bg-indigo-500/20 text-indigo-200' : 'text-gray-400 hover:text-gray-200'}`}
            aria-label="Listar por middle"
          >
            <LayoutGrid size={14} /> <span className="hidden sm:inline">Por middle</span>
          </button>
          <button
            onClick={() => setViewMode('event')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${viewMode === 'event' ? 'bg-indigo-500/20 text-indigo-200' : 'text-gray-400 hover:text-gray-200'}`}
            aria-label="Listar por evento"
          >
            <List size={14} /> <span className="hidden sm:inline">Por evento</span>
          </button>
        </div>
        <Select
          className="w-44"
          value={sortMode}
          onChange={(v) => setSortMode(v as 'ev' | 'pgap' | 'time')}
          options={[
            { value: 'ev', label: 'Maior EV' },
            { value: 'pgap', label: 'Maior % de acerto' },
            { value: 'time', label: 'Horário (mais perto)' },
          ]}
        />
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
            filtersOpen || activeFilters > 0 ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
          }`}
        >
          <Filter size={15} />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white">{activeFilters}</span>
          )}
          <ChevronDown size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Painel de filtros */}
      {filtersOpen && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className="text-[11px] text-gray-400">Campeonato
            <Select className="mt-1" value={league} onChange={setLeague}
              options={[{ value: '', label: 'Todos' }, ...leagues.map((l) => ({ value: l, label: l }))]} />
          </label>
          <label className="text-[11px] text-gray-400">Mercado
            <Select className="mt-1" value={marketId} onChange={setMarketId}
              options={[{ value: '', label: 'Todos' }, ...markets.map((m) => ({ value: m.id, label: m.name }))]} />
          </label>
          <label className="text-[11px] text-gray-400">
            EV mínimo <span className="font-semibold text-indigo-200 tabular-nums">{evMin <= EV_FLOOR ? 'todos' : `≥ ${evMin.toFixed(2)}%`}</span>
            <input type="range" min={EV_FLOOR} max={3} step={0.05} value={evMin} onChange={(e) => setEvMin(parseFloat(e.target.value))} className="mt-2 w-full accent-indigo-500" />
          </label>
          <label className="text-[11px] text-gray-400">
            % de acerto (pGap) mínimo <span className="font-semibold text-indigo-200 tabular-nums">≥ {pGapMin}%</span>
            <input type="range" min={0} max={50} step={1} value={pGapMin} onChange={(e) => setPGapMin(parseInt(e.target.value, 10))} className="mt-2 w-full accent-indigo-500" />
          </label>
          <label className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 text-[12px] text-gray-300">
            <input type="checkbox" checked={gapFullOnly} onChange={(e) => setGapFullOnly(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            Só miolo cheio (gapFull) — esconde os soft/asiáticos de meia-vitória
          </label>

          <div className="sm:col-span-2 lg:col-span-4 flex items-start gap-2 rounded-lg bg-white/[0.03] p-2 text-[11px] text-gray-400 ring-1 ring-white/5">
            <Settings size={13} className="mt-0.5 shrink-0 text-indigo-400/60" />
            <span>As <strong className="text-gray-300">casas</strong> vêm do seu <strong className="text-gray-300">filtro salvo</strong> (seletor no topo). Edite as casas do preset na engrenagem ⚙ — vale para Surebets e Middles.</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading && !data.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <RefreshCcw className="animate-spin" size={18} /> Carregando middles...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-white/5 ring-1 ring-white/10 mb-3"><Zap className="text-gray-500" size={22} /></div>
          <p className="text-sm text-gray-400">Nenhum middle com os filtros atuais. Eles aparecem e somem conforme as odds andam.</p>
        </div>
      ) : viewMode === 'event' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ event, list }) => {
            const bestEv = Math.max(...list.map((x) => x.ev));
            const bestPGap = Math.max(...list.map((x) => x.pGap));
            const dateLabel = fmtDateTime(event.date);
            return (
              <button
                key={event.id}
                onClick={() => setEventModalId(event.id)}
                className="animate-card-in flex w-full flex-col rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left shadow-lg shadow-black/20 transition hover:border-indigo-500/40 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold leading-tight text-white">
                      {event.home} <span className="text-xs font-normal text-gray-500">×</span> {event.away}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                      {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={10} className="shrink-0 text-indigo-400/60" /> <span className="truncate">{event.league}</span></span>}
                      {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Clock size={10} /> {dateLabel}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] uppercase tracking-wider text-gray-500">Melhor EV</div>
                    <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ring-1 ${evTone(bestEv)}`}>{fmtSigned(bestEv)}%</span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-indigo-500/30">{list.length} middle{list.length > 1 ? 's' : ''}</span>
                    <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-gray-300 ring-1 ring-white/10">acerto até {bestPGap.toFixed(0)}%</span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-indigo-300">Ver <ChevronRight size={13} /></span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map(({ event, m }) => (
            <MiddleCard key={m.id} event={event} m={m} onCalc={openCalc} notify={notify} onHide={hidden.hide} isHidden={hidden.isHidden} />
          ))}
        </div>
      )}

      {infoOpen && <InfoTopicModal topicKey="middle" onClose={() => setInfoOpen(false)} />}

      {activeEventGroup && (
        <MiddleEventModal
          event={activeEventGroup.event}
          list={activeEventGroup.list}
          onCalc={openCalc}
          notify={notify}
          onClose={() => setEventModalId(null)}
          onHide={hidden.hide}
          isHidden={hidden.isHidden}
        />
      )}

      {calc && <MiddleCalcModal event={calc.event} m={calc.m} onClose={() => setCalc(null)} notify={notify} />}

      {hiddenOpen && (
        <HiddenItemsModal items={hidden.items} onUnhide={hidden.unhide} onClearAll={hidden.clearAll} onClose={() => setHiddenOpen(false)} />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] rounded-lg bg-black/90 px-4 py-2 text-sm text-white ring-1 ring-white/10 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
