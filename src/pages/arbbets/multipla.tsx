import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Layers, RefreshCcw, Search, Zap, Filter, ChevronDown, Settings } from 'lucide-react';
import { useMultiplas } from '@/hooks/useMultiplas';
import { useMultiplaAlerts } from '@/hooks/useMultiplaAlerts';
import { useNotifications, AlertItem } from '@/hooks/useNotifications';
import { NotificationBell } from '@/components/arbbets/NotificationBell';
import { useWatchSet } from '@/hooks/useWatchSet';
import { useUserContext } from '@/context/UserContext';
import { apiGateway } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { MultiplaCard } from '@/components/multipla/MultiplaCard';
import { MultiplaCalcModal } from '@/components/multipla/MultiplaCalcModal';
import { MultiArbData } from '@/interfaces/multipla.interface';
import { FilterDTO } from '@/interfaces';
import { multiKey } from '@/utils/multipla';
import { detectExtension } from '@/utils/arbExtension';

const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition';
const inputClass = `w-full ${fieldBase}`;

// Render-only: cap de itens montados (perf mobile — igual arbbets). O restante
// entra via "Carregar mais". O snapshot inteiro ainda alimenta alertas/contagem.
const PAGE_SIZE = 60;

export default function MultiplaPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();

  const [autoUpdate, setAutoUpdate] = useState(true);
  useEffect(() => { void detectExtension(); }, []);
  const { data, loading } = useMultiplas('prematch', autoUpdate, isAuthenticated);

  const [search, setSearch] = useState('');
  const [league, setLeague] = useState('');
  const [profitMin, setProfitMin] = useState(0);
  const [sortMode, setSortMode] = useState<'profit' | 'time'>('profit');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Filtro salvo do usuário (ABFilter) — o MESMO preset das surebets/arbbets/middles.
  // Usamos as CASAS do preset: a múltipla só aparece se TODOS os bilhetes usarem
  // casas do preset (uma casa fora → o usuário não consegue montar a arbitragem).
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string }[]>([]);
  const [activeFilterId, setActiveFilterId] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterDTO | null>(null);

  const [calc, setCalc] = useState<MultiArbData | null>(null);

  // Toast simples de feedback.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Seguir + notificações (mesmo motor das surebets).
  const watch = useWatchSet('multipla:watch');
  const openAlertFromNotification = useCallback((a: AlertItem) => {
    const found = data.find((d) => multiKey(d) === a.surebetKey);
    if (found) setCalc(found);
  }, [data]);
  const notif = useNotifications(openAlertFromNotification);

  // Carrega a lista de filtros salvos e auto-seleciona (lembra a escolha; senão o 1º).
  useEffect(() => {
    apiGateway.getUserFilters()
      .then((r) => {
        if (r.data?.result !== 1 || !Array.isArray(r.data.data)) return;
        const list: { id: string; name: string }[] = r.data.data.map((f: { id: string | number; name: string }) => ({ id: String(f.id), name: f.name }));
        setSavedFilters(list);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('multipla:filter') : null;
        if (stored === null) { if (list.length) setActiveFilterId(list[0].id); } // 1ª vez → primeiro filtro
        else if (stored && list.some((f) => f.id === stored)) setActiveFilterId(stored); // lembra a escolha
        // stored === '' → usuário escolheu "Sem filtro", respeita
      })
      .catch(() => {});
  }, []);
  const selectFilter = (idv: string) => {
    setActiveFilterId(idv);
    if (typeof window !== 'undefined') localStorage.setItem('multipla:filter', idv);
  };
  // Carrega a config do filtro ativo — usamos as CASAS dele p/ filtrar as múltiplas.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!activeFilterId) { setActiveFilter(null); return; }
    let active = true;
    apiGateway.getFilterById(activeFilterId)
      .then((r) => { if (active && r.data?.result === 1) setActiveFilter(r.data.data as FilterDTO); })
      .catch(() => {});
    return () => { active = false; };
  }, [activeFilterId]);

  // Campeonatos presentes (nos dois jogos de cada par).
  const leagues = useMemo(() => {
    const s = new Set<string>();
    for (const d of data) for (const g of d.games) if (g.league) s.add(g.league);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  // Lista filtrada + ordenada.
  const items = useMemo<MultiArbData[]>(() => {
    const q = search.trim().toLowerCase();
    const list = data.filter((d) => {
      if (d.profitMargin < profitMin) return false;
      if (league && !d.games.some((g) => g.league === league)) return false;
      // Filtro salvo (preset do usuário): só mostra se TODOS os bilhetes usam
      // casas do preset — uma casa fora quebra a execução da arbitragem. (igual arbbets)
      if (activeFilter?.bookmakers?.length && !d.tickets.every((t) => activeFilter.bookmakers.includes(t.bookmaker))) return false;
      if (q) {
        const hay = d.games.map((g) => `${g.home} ${g.away} ${g.league}`).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (sortMode === 'time') {
        const ta = Math.min(...a.games.map((g) => new Date(g.date).getTime()).filter(Number.isFinite));
        const tb = Math.min(...b.games.map((g) => new Date(g.date).getTime()).filter(Number.isFinite));
        return (Number.isFinite(ta) ? ta : Infinity) - (Number.isFinite(tb) ? tb : Infinity);
      }
      return b.profitMargin - a.profitMargin;
    });
    return list;
  }, [data, search, league, profitMin, sortMode, activeFilter]);

  // Reset da paginação quando os filtros mudam a lista.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, league, profitMin, sortMode, activeFilterId]);

  const visible = items.slice(0, visibleCount);
  const visibleKeys = useMemo(() => new Set(items.map(multiKey)), [items]);

  const { newKeys } = useMultiplaAlerts(data, visibleKeys, {
    type: 'prematch',
    settings: notif.settings,
    watched: watch.set,
    notify: notif.notify,
  });
  const watchCount = watch.set.size;

  const total = data.length;
  const activeFilters = (league ? 1 : 0) + (profitMin > 0 ? 1 : 0);

  // Proteção: página exclusiva para logados.
  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {authLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Verificando acesso...</div>
          ) : (
            <>
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30 mb-4"><Layers className="text-cyan-300" size={24} /></div>
              <h2 className="text-lg font-bold text-white">Entre para ver as múltiplas</h2>
              <p className="text-sm text-gray-400 mt-1 mb-5">As múltiplas (arbitragem de acumulada) são exclusivas para usuários logados.</p>
              <button
                onClick={() => router.push({ pathname: '/arbbets/multipla', query: { ...router.query, modal: 'auth', page: 'login' } }, undefined, { shallow: true })}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold transition"
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
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 ring-1 ring-cyan-500/30">
            <Layers className="text-cyan-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Múltiplas</h1>
            <p className="text-sm text-gray-400">Arbitragem de acumulada: cubra dois jogos e trave o lucro</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white tabular-nums">{total}</div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">múltiplas</div>
          </div>
          <NotificationBell notif={notif} watchCount={watchCount} onOpenAlert={openAlertFromNotification} />
          <Tooltip label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}>
            <button
              onClick={() => setAutoUpdate((v) => !v)}
              className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
              aria-label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}
            >
              <RefreshCcw size={16} className={autoUpdate && loading ? 'animate-spin' : ''} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar time, liga..." className={`${inputClass} pl-9`} />
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
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-cyan-300"
            title="Gerenciar filtros salvos"
          >
            <Settings size={15} />
          </button>
        </div>
        <Select
          className="w-44"
          value={sortMode}
          onChange={(v) => setSortMode(v as 'profit' | 'time')}
          options={[
            { value: 'profit', label: 'Maior lucro' },
            { value: 'time', label: 'Horário (mais perto)' },
          ]}
        />
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
            filtersOpen || activeFilters > 0 ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
          }`}
        >
          <Filter size={15} />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-cyan-500 text-[10px] font-bold text-slate-900">{activeFilters}</span>
          )}
          <ChevronDown size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Painel de filtros */}
      {filtersOpen && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className="text-[11px] text-gray-400">Campeonato
            <Select className="mt-1" value={league} onChange={setLeague}
              options={[{ value: '', label: 'Todos' }, ...leagues.map((l) => ({ value: l, label: l }))]} />
          </label>
          <label className="text-[11px] text-gray-400 sm:col-span-2">
            Lucro mínimo <span className="font-semibold text-cyan-200 tabular-nums">{profitMin <= 0 ? 'todos' : `≥ ${profitMin.toFixed(2)}%`}</span>
            <input type="range" min={0} max={5} step={0.05} value={profitMin} onChange={(e) => setProfitMin(parseFloat(e.target.value))} className="mt-2 w-full accent-cyan-500" />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-2 rounded-lg bg-white/[0.03] p-2 text-[11px] text-gray-400 ring-1 ring-white/5">
            <Settings size={13} className="mt-0.5 shrink-0 text-cyan-400/60" />
            <span>As <strong className="text-gray-300">casas</strong> vêm do seu <strong className="text-gray-300">filtro salvo</strong> (seletor no topo). A múltipla só aparece se <strong className="text-gray-300">todos os bilhetes</strong> usarem casas do preset — edite as casas na engrenagem ⚙.</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading && !data.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <RefreshCcw className="animate-spin" size={18} /> Carregando múltiplas...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-white/5 ring-1 ring-white/10 mb-3"><Zap className="text-gray-500" size={22} /></div>
          <p className="text-sm text-gray-400">Nenhuma múltipla com os filtros atuais. Elas aparecem e somem conforme as odds andam.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visible.map((d) => {
              const key = multiKey(d);
              return (
                <MultiplaCard
                  key={d.id}
                  data={d}
                  onCalc={setCalc}
                  notify={notify}
                  watched={watch.has(key)}
                  onToggleWatch={() => watch.toggle(key)}
                  isNew={newKeys.has(key)}
                  led={newKeys.has(key) && notif.settings.ledEffect}
                />
              );
            })}
          </div>
          {visibleCount < items.length && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
              >
                Carregar mais
              </button>
              <span className="text-[11px] text-gray-500">Mostrando {visible.length} de {items.length}</span>
            </div>
          )}
        </>
      )}

      {calc && <MultiplaCalcModal data={calc} onClose={() => setCalc(null)} notify={notify} />}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] rounded-lg bg-black/90 px-4 py-2 text-sm text-white ring-1 ring-white/10 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
