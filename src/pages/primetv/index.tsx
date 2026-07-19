import { useMemo, useState, useCallback } from 'react';
import Head from 'next/head';
import { MonitorPlay, RefreshCcw, Search, Volume2, PlayCircle, Signal, EyeOff, Eye, Ban } from 'lucide-react';
import { usePrimeTv } from '@/hooks/usePrimeTv';
import { useUserContext } from '@/context/UserContext';
import { formatEventDateParts } from '@/utils/eventTime';
import { apiGateway } from '@/gateways/api.gateway';
import { PrimeTvAdminEvent, PrimeTvEvent } from '@/interfaces/primetv.interface';

const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50 transition';

/** Bandeira (emoji) a partir do código ISO-2. Vazio se não for ISO-2 válido. */
const flagEmoji = (cc?: string | null): string => {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
};

/** Iniciais de um time p/ o avatar de fallback. */
const initials = (name: string): string =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

/** Avatar do time: tenta a imagem; no erro cai em iniciais (sem imagem quebrada). */
const TeamAvatar = ({ name, url }: { name: string; url: string | null }) => {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <span className="grid place-items-center h-7 w-7 rounded-full bg-white/10 text-[10px] font-bold text-gray-300 ring-1 ring-white/10 shrink-0">
        {initials(name)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setBroken(true)} className="h-7 w-7 rounded-full object-contain bg-white/5 ring-1 ring-white/10 shrink-0" />;
};

/** Abre o player numa janela pequena separada (popup), do tamanho certo. */
const openPlayer = (id: string) => {
  const w = 980;
  const h = 620;
  const left = typeof window !== 'undefined' ? window.screenX + Math.max(0, (window.outerWidth - w) / 2) : 0;
  const top = typeof window !== 'undefined' ? window.screenY + Math.max(0, (window.outerHeight - h) / 2) : 0;
  window.open(
    `/tv/${encodeURIComponent(id)}`,
    `primetv_${id}`,
    `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`,
  );
};

const asAdmin = (e: PrimeTvEvent): PrimeTvAdminEvent | null =>
  'override' in e ? (e as PrimeTvAdminEvent) : null;

export default function PrimeTvPage() {
  const { user } = useUserContext();
  const isAdmin = user?.role === 'admin';

  const [autoUpdate, setAutoUpdate] = useState(true);
  const [showHidden, setShowHidden] = useState(false); // admin: usa endpoint admin p/ ver ocultos

  const mode = isAdmin && showHidden ? 'admin' : 'public';
  const { events, competitions, liveTotal, loading, error, refetch } = usePrimeTv(mode, autoUpdate);

  const [search, setSearch] = useState('');
  const [comp, setComp] = useState(''); // competitionKey selecionada ('' = Todos)
  const [statusFilter, setStatusFilter] = useState<'' | 'live' | 'upcoming'>('');
  const [audioOnly, setAudioOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Ação admin (ocultar/reexibir/remover) → refetch.
  const runOverride = useCallback(
    async (id: string, patch: { hidden?: boolean; removed?: boolean }) => {
      setBusyId(id);
      try {
        await apiGateway.setPrimeTvOverride(id, patch);
        await refetch();
      } catch {
        /* silencioso: o refetch reflete o estado real */
      } finally {
        setBusyId(null);
      }
    },
    [refetch],
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (comp && e.competitionKey !== comp) return false;
      if (statusFilter && e.status !== statusFilter) return false;
      if (audioOnly && !e.hasAudio) return false;
      if (q && !`${e.title} ${e.competition} ${e.country || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, comp, statusFilter, audioOnly, search]);

  const total = events.length;

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <Head><title>PrimeTV — ArbPrime</title></Head>

      {/* Cabeçalho */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-red-500/30 to-red-500/5 ring-1 ring-red-500/30">
            <MonitorPlay className="text-red-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">PrimeTV</h1>
            <p className="text-sm text-gray-400">Transmissões ao vivo e agendadas dos jogos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white tabular-nums flex items-center gap-2 justify-end">
              {liveTotal > 0 && <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />}
              {liveTotal}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">ao vivo agora</div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className={`grid place-items-center h-9 w-9 rounded-lg border transition ${showHidden ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
              title={showHidden ? 'Mostrando ocultos (admin)' : 'Mostrar ocultos (admin)'}
              aria-label="Mostrar ocultos"
            >
              {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <button
            onClick={() => setAutoUpdate((v) => !v)}
            className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-red-500/15 border-red-500/40 text-red-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
            title={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}
            aria-label="Auto-update"
          >
            <RefreshCcw size={16} className={autoUpdate && loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Abas de categoria (Todos | Competições) — rolagem horizontal */}
      <div className="mb-3 -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          <CategoryTab active={comp === ''} onClick={() => setComp('')} label="Todos" count={total} live={liveTotal} />
          {competitions.map((c) => (
            <CategoryTab
              key={c.key}
              active={comp === c.key}
              onClick={() => setComp(c.key)}
              label={`${flagEmoji(c.countryCode)} ${c.name}`.trim()}
              count={c.count}
              live={c.liveCount}
            />
          ))}
        </div>
      </div>

      {/* Toolbar: busca + status + áudio */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jogo, competição, país..." className={`${fieldBase} w-full pl-9`} />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
          {([['', 'Todos'], ['live', 'Ao vivo'], ['upcoming', 'Agendados']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${statusFilter === v ? 'bg-red-500/20 text-red-200' : 'text-gray-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAudioOnly((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${audioOnly ? 'bg-red-500/15 border-red-500/40 text-red-200' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
        >
          <Volume2 size={15} /> <span className="hidden sm:inline">Com áudio</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{error}</div>
      )}

      {/* Lista */}
      {loading && !events.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <RefreshCcw className="animate-spin" size={18} /> Carregando transmissões...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-white/5 ring-1 ring-white/10 mb-3"><MonitorPlay className="text-gray-500" size={22} /></div>
          <p className="text-sm text-gray-400">Nenhuma transmissão com os filtros atuais.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 overflow-hidden">
          {items.map((e) => (
            <EventRow key={e.id} event={e} isAdmin={isAdmin} busy={busyId === e.id} onWatch={() => openPlayer(e.id)} onOverride={runOverride} />
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------

const CategoryTab = ({ active, onClick, label, count, live }: { active: boolean; onClick: () => void; label: string; count: number; live: number }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-lg border text-sm transition shrink-0
      ${active ? 'bg-red-500/15 border-red-500/40 text-red-100' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
  >
    {live > 0 && <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
    <span className="max-w-[180px] truncate">{label}</span>
    <span className={`grid place-items-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${active ? 'bg-red-500/30 text-red-100' : 'bg-white/10 text-gray-400'}`}>{count}</span>
  </button>
);

const EventRow = ({
  event,
  isAdmin,
  busy,
  onWatch,
  onOverride,
}: {
  event: PrimeTvEvent;
  isAdmin: boolean;
  busy: boolean;
  onWatch: () => void;
  onOverride: (id: string, patch: { hidden?: boolean; removed?: boolean }) => void;
}) => {
  const parts = formatEventDateParts(event.startTime);
  const adm = asAdmin(event);
  const hidden = !!(adm?.override?.hidden || adm?.override?.removed);

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 transition ${hidden ? 'opacity-50 bg-amber-500/[0.04]' : 'hover:bg-white/[0.03]'}`}>
      {/* horário + estado — coluna fixa à esquerda (hora em cima, estado embaixo) */}
      <div className="w-16 shrink-0 text-center leading-tight">
        <div className="text-base text-white tabular-nums">{parts.time}</div>
        {event.isLive ? (
          <div className="text-[11px] font-semibold text-red-400">Ao Vivo</div>
        ) : (
          <div className="text-[11px] text-gray-500">Previsto</div>
        )}
      </div>

      {/* confronto + competição */}
      <div className="flex-1 min-w-0">
        {event.isVersus && event.home.name && event.away.name ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <TeamAvatar name={event.home.name} url={event.home.iconUrl} />
            <span className="text-sm text-white truncate">{event.home.name}</span>
            <span className="text-[11px] text-gray-600 px-0.5 shrink-0">×</span>
            <TeamAvatar name={event.away.name} url={event.away.iconUrl} />
            <span className="text-sm text-white truncate">{event.away.name}</span>
          </div>
        ) : (
          <div className="text-sm text-white font-medium truncate">{event.title}</div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400 min-w-0">
          <span className="shrink-0">{flagEmoji(event.countryCode)}</span>
          <span className="truncate">{event.competition}</span>
        </div>
      </div>

      {/* badges (some no mobile) */}
      <div className="hidden md:flex items-center gap-3 text-[11px] text-gray-400 shrink-0">
        {event.hasAudio && (
          <span className="inline-flex items-center gap-1 text-red-300" title="Com áudio/narração"><Volume2 size={12} /> áudio</span>
        )}
        {event.channels > 0 && (
          <span className="inline-flex items-center gap-1" title="Canais disponíveis"><Signal size={12} /> {event.channels}</span>
        )}
      </div>

      {/* ações */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isAdmin && (
          hidden ? (
            <button
              onClick={() => onOverride(event.id, { hidden: false, removed: false })}
              disabled={busy}
              className="grid place-items-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-emerald-300 hover:border-emerald-500/40 transition disabled:opacity-50"
              title="Reexibir"
            >
              <Eye size={15} />
            </button>
          ) : (
            <>
              <button
                onClick={() => onOverride(event.id, { hidden: true })}
                disabled={busy}
                className="hidden sm:grid place-items-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-amber-300 hover:border-amber-500/40 transition disabled:opacity-50"
                title="Ocultar"
              >
                <EyeOff size={15} />
              </button>
              <button
                onClick={() => onOverride(event.id, { removed: true })}
                disabled={busy}
                className="hidden sm:grid place-items-center h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-rose-300 hover:border-rose-500/40 transition disabled:opacity-50"
                title="Remover"
              >
                <Ban size={15} />
              </button>
            </>
          )
        )}
        {/* Assistir só faz sentido AO VIVO (não dá pra assistir um jogo que ainda não começou). */}
        {event.isLive && (
          <button
            onClick={onWatch}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition"
          >
            <PlayCircle size={16} /> <span className="hidden sm:inline">Assistir</span>
          </button>
        )}
      </div>
    </div>
  );
};
