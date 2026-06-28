import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
  Activity, RefreshCcw, Loader2, AlertTriangle, Search, CheckCircle2, Clock,
  WifiOff, ArrowDownWideNarrow, ServerCog
} from 'lucide-react';
import { apiGateway, CrawlerStatusResponseDTO, CrawlerStatusDTO, CrawlerHealth } from '@/gateways/api.gateway';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const POLL_MS = 12000;

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

// Duração do ciclo: ms → "84ms" / "4.3s" / "1m 14s".
const fmtDuration = (ms: number): string => {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return `${m}m ${rest}s`;
};

// Idade do último report (segundos) → "agora" / "há 12s" / "há 3 min" / "há 1h 5m".
const fmtAge = (sec: number | null): string => {
  if (sec == null) return 'sem report';
  if (sec < 5) return 'agora mesmo';
  if (sec < 60) return `há ${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) {
    const s = sec % 60;
    return s ? `há ${m}m ${s}s` : `há ${m}min`;
  }
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `há ${h}h ${mm}m` : `há ${h}h`;
};

const fmtClock = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const fmtNumber = (n: number): string => n.toLocaleString('pt-BR');

// ---------------------------------------------------------------------------
// Saúde / categorização (visual)
// ---------------------------------------------------------------------------

const healthFromAge = (sec: number | null, staleSeconds: number, offlineSeconds: number): CrawlerHealth => {
  if (sec == null) return 'offline';
  if (sec > offlineSeconds) return 'offline';
  if (sec > staleSeconds) return 'stale';
  return 'online';
};

const HEALTH_META: Record<CrawlerHealth, { label: string; dot: string; ring: string; text: string; chip: string }> = {
  online: { label: 'Online', dot: 'bg-emerald-400', ring: 'ring-emerald-500/30', text: 'text-emerald-300', chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  stale: { label: 'Atrasado', dot: 'bg-amber-400', ring: 'ring-amber-500/30', text: 'text-amber-300', chip: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  offline: { label: 'Offline', dot: 'bg-rose-500', ring: 'ring-rose-500/30', text: 'text-rose-300', chip: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' },
};

// Cor da contagem de eventos (categorização rápida: 0 = problema; quanto maior, mais "saudável").
const eventsTone = (n: number): string => {
  if (n <= 0) return 'text-rose-300';
  if (n < 50) return 'text-gray-200';
  if (n < 200) return 'text-teal-300';
  return 'text-emerald-300';
};

// Cor da duração (ciclos muito longos chamam atenção).
const durationTone = (ms: number): string => {
  if (ms <= 0) return 'text-gray-500';
  if (ms < 5000) return 'text-gray-300';
  if (ms < 15000) return 'text-gray-200';
  if (ms < 30000) return 'text-amber-300';
  return 'text-rose-300';
};

type SortKey = 'recent' | 'events' | 'duration' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Mais recente' },
  { key: 'events', label: 'Mais eventos' },
  { key: 'duration', label: 'Maior duração' },
  { key: 'name', label: 'Nome (A–Z)' },
];

// Crawler com a saúde já recalculada "ao vivo" no cliente.
interface LiveCrawler extends CrawlerStatusDTO {
  liveAge: number | null;
  liveHealth: CrawlerHealth;
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const SummaryCard = ({ icon, label, value, tone, hint }: { icon: ReactNode; label: string; value: string; tone: string; hint?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
    <div className="flex items-center justify-between">
      <span className="text-xs sm:text-sm text-gray-400">{label}</span>
      <span className={tone}>{icon}</span>
    </div>
    <div className={`mt-2 text-2xl font-extrabold ${tone}`}>{value}</div>
    {hint && <div className="mt-1 text-[11px] text-gray-500">{hint}</div>}
  </div>
);

const Logo = ({ c }: { c: LiveCrawler }) => {
  const [broken, setBroken] = useState(false);
  if (c.logoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.logoUrl} alt={c.name} className="h-9 w-9 rounded-lg object-contain bg-white/5 ring-1 ring-white/10" onError={() => setBroken(true)} />;
  }
  return (
    <div
      className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white ring-1 ring-white/10"
      style={{ backgroundColor: c.color || 'rgba(20,184,166,0.25)' }}
    >
      {(c.name || c.bookmaker).charAt(0).toUpperCase()}
    </div>
  );
};

const CrawlerRow = ({ c }: { c: LiveCrawler }) => {
  const h = HEALTH_META[c.liveHealth];
  const problem = c.liveHealth !== 'online';
  return (
    <div className={`flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors ${problem ? 'bg-rose-500/[0.03]' : ''}`}>
      {/* Saúde */}
      <span className="relative flex h-2.5 w-2.5 shrink-0" title={h.label}>
        {c.liveHealth === 'online' && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${h.dot}`} />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${h.dot}`} />
      </span>

      {/* Casa */}
      <Logo c={c} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{c.name}</span>
          <span className="hidden sm:inline rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400 ring-1 ring-white/10 capitalize">{c.sport || '—'}</span>
          {!c.registered && <span className="hidden md:inline rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-500 ring-1 ring-white/10" title="Casa ainda não cadastrada no painel">não cadastrada</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-mono">{c.bookmaker}</span>
          <span>·</span>
          <span>{c.status}</span>
        </div>
      </div>

      {/* Eventos */}
      <div className="hidden sm:block w-20 text-right">
        <div className={`text-base font-bold tabular-nums ${eventsTone(c.events)}`}>{fmtNumber(c.events)}</div>
        <div className="text-[10px] text-gray-500">eventos</div>
      </div>

      {/* Duração */}
      <div className="hidden md:block w-20 text-right">
        <div className={`text-sm font-semibold tabular-nums ${durationTone(c.durationMs)}`}>{fmtDuration(c.durationMs)}</div>
        <div className="text-[10px] text-gray-500">duração</div>
      </div>

      {/* Último report */}
      <div className="w-24 sm:w-32 text-right">
        <div className={`text-sm font-medium tabular-nums ${problem ? h.text : 'text-gray-200'}`}>{fmtAge(c.liveAge)}</div>
        <div className="text-[10px] text-gray-500 sm:hidden">{fmtNumber(c.events)} ev · {fmtDuration(c.durationMs)}</div>
        <div className="hidden sm:block text-[10px] text-gray-500">{fmtClock(c.date)}</div>
      </div>

      {/* Badge de saúde */}
      <span className={`hidden lg:inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${h.chip}`}>{h.label}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const StatusPage = () => {
  const [data, setData] = useState<CrawlerStatusResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(0); // tick para relógio "ao vivo"
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [search, setSearch] = useState('');
  const [sport, setSport] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  // Offset entre o relógio do servidor e o do cliente (no momento do fetch),
  // para calcular a idade "ao vivo" sem sofrer com desvio de relógio do cliente.
  const clockOffset = useRef(0);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await apiGateway.getCrawlerStatus();
      if (res.data?.result === 1) {
        const payload: CrawlerStatusResponseDTO = res.data.data;
        clockOffset.current = new Date(payload.serverTime).getTime() - Date.now();
        setData(payload);
        setErr(null);
      } else {
        setErr(res.data?.message || 'Erro ao carregar status.');
      }
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Erro ao carregar status dos coletores.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
  }, [load]);

  // Polling.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  // Tick de 1s para os contadores relativos e recálculo de saúde ao vivo.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const thresholds = data?.thresholds;

  // Recalcula idade + saúde com o relógio do servidor estimado (cliente + offset).
  const liveCrawlers: LiveCrawler[] = useMemo(() => {
    if (!data) return [];
    const serverNow = Date.now() + clockOffset.current;
    const stale = thresholds?.staleSeconds ?? 300;
    const offline = thresholds?.offlineSeconds ?? 900;
    return data.crawlers.map((c) => {
      const liveAge = c.date ? Math.max(0, Math.round((serverNow - new Date(c.date).getTime()) / 1000)) : null;
      return { ...c, liveAge, liveHealth: healthFromAge(liveAge, stale, offline) };
    });
    // `now` entra na dependência só para forçar o recálculo a cada tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, thresholds, now]);

  const sports = data?.summary.sports ?? [];

  // Filtro + ordenação (sobre a saúde ao vivo).
  const visible: LiveCrawler[] = useMemo(() => {
    let list = liveCrawlers;
    if (sport !== 'all') list = list.filter((c) => c.sport === sport);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.bookmaker.toLowerCase().includes(q));
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'events': return b.events - a.events;
        case 'duration': return b.durationMs - a.durationMs;
        case 'name': return a.name.localeCompare(b.name, 'pt-BR');
        case 'recent':
        default: {
          const ta = a.date ? new Date(a.date).getTime() : -Infinity;
          const tb = b.date ? new Date(b.date).getTime() : -Infinity;
          return tb - ta;
        }
      }
    });
    return sorted;
  }, [liveCrawlers, sport, search, sort]);

  // Resumo ao vivo (recontado a partir da saúde recalculada no cliente).
  const live = useMemo(() => {
    const online = liveCrawlers.filter((c) => c.liveHealth === 'online').length;
    const staleN = liveCrawlers.filter((c) => c.liveHealth === 'stale').length;
    const offline = liveCrawlers.filter((c) => c.liveHealth === 'offline').length;
    const problems = liveCrawlers
      .filter((c) => c.liveHealth !== 'online')
      .sort((a, b) => (b.liveAge ?? Infinity) - (a.liveAge ?? Infinity));
    return { online, stale: staleN, offline, problems };
  }, [liveCrawlers]);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Activity className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Status dos Coletores</h1>
            <p className="text-sm text-gray-400">Saúde em tempo real dos crawlers e eventos buscados por casa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="relative flex h-2 w-2">
                {autoRefresh && <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60 animate-ping" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${autoRefresh ? 'bg-teal-400' : 'bg-gray-600'}`} />
              </span>
              atualizado {fmtClock(data.serverTime)}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`h-9 rounded-lg px-3 text-xs font-medium border transition ${autoRefresh ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
            title="Atualização automática a cada 12s"
          >
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button onClick={() => load(true)} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar agora">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {err && (
        <div className="mb-4 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ring-1 bg-rose-500/10 ring-rose-500/30 text-rose-200">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-3" /> Carregando status...
        </div>
      ) : data ? (
        <>
          {/* Alerta de coletores com problema */}
          {live.problems.length > 0 && (
            <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertTriangle size={18} />
                <span className="font-semibold">
                  {live.problems.length} {live.problems.length === 1 ? 'coletor sem reportar' : 'coletores sem reportar'} normalmente
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {live.problems.map((c) => (
                  <span key={c.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ${HEALTH_META[c.liveHealth].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_META[c.liveHealth].dot}`} />
                    {c.name} <span className="opacity-70">· {fmtAge(c.liveAge)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cards de resumo */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
            <SummaryCard icon={<CheckCircle2 size={18} />} label="Online" value={String(live.online)} tone="text-emerald-300" hint={`de ${data.summary.total} coletores`} />
            <SummaryCard icon={<Clock size={18} />} label="Atrasados" value={String(live.stale)} tone="text-amber-300" hint={`> ${Math.round((thresholds?.staleSeconds ?? 300) / 60)} min sem report`} />
            <SummaryCard icon={<WifiOff size={18} />} label="Offline" value={String(live.offline)} tone="text-rose-300" hint={`> ${Math.round((thresholds?.offlineSeconds ?? 900) / 60)} min sem report`} />
            <SummaryCard icon={<ServerCog size={18} />} label="Eventos buscados" value={fmtNumber(data.summary.totalEvents)} tone="text-teal-300" hint="último ciclo, somado" />
            <SummaryCard icon={<Activity size={18} />} label="Última atividade" value={fmtClock(data.summary.lastUpdate)} tone="text-white" hint="report mais recente" />
          </div>

          {/* Controles */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {sports.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
                <button onClick={() => setSport('all')} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${sport === 'all' ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:text-gray-200'}`}>Todos</button>
                {sports.map((s) => (
                  <button key={s} onClick={() => setSport(s)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${sport === s ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:text-gray-200'}`}>{s}</button>
                ))}
              </div>
            )}

            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar casa..."
                className="w-full rounded-xl bg-white/5 border border-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-teal-500/40"
              />
            </div>

            <div className="relative">
              <ArrowDownWideNarrow size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="appearance-none rounded-xl bg-white/5 border border-white/10 py-2 pl-9 pr-8 text-sm text-gray-200 outline-none focus:border-teal-500/40 cursor-pointer"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key} className="bg-brand-dark">{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Lista */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Cabeçalho de colunas (desktop) */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              <span className="w-2.5" />
              <span className="w-9" />
              <span className="flex-1">Casa</span>
              <span className="w-20 text-right">Eventos</span>
              <span className="hidden md:block w-20 text-right">Duração</span>
              <span className="w-24 sm:w-32 text-right">Último report</span>
              <span className="hidden lg:inline-block w-[60px]" />
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400">Nenhum coletor encontrado.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {visible.map((c) => <CrawlerRow key={c.key} c={c} />)}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Online — reportou há menos de {Math.round((thresholds?.staleSeconds ?? 300) / 60)} min</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Atrasado — sem report entre {Math.round((thresholds?.staleSeconds ?? 300) / 60)} e {Math.round((thresholds?.offlineSeconds ?? 900) / 60)} min</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Offline — sem report há mais de {Math.round((thresholds?.offlineSeconds ?? 900) / 60)} min</span>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default StatusPage;
