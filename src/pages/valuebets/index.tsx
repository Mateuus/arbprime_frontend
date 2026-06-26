import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Gem, RefreshCcw, Search, Zap, Filter, ChevronDown, LineChart, HelpCircle } from 'lucide-react';
import { useValuebets } from '@/hooks/useValuebets';
import { InfoTopicModal } from '@/components/info/infoTopics';
import { useUserContext } from '@/context/UserContext';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { ValuebetCard } from '@/components/valuebets/ValuebetCard';
import { ValuebetGroup, ValuebetEmission } from '@/interfaces/valuebet.interface';
import { marketLabel } from '@/utils/surebet';
import { valuebetSelectionLabel, valuebetMarketLabel } from '@/utils/valuebet';
import { detectExtension } from '@/utils/arbExtension';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';

const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';
const inputClass = `w-full ${fieldBase}`;

// Item plano: uma emissão + o grupo (jogo) a que pertence.
interface FlatVB { group: ValuebetGroup; vb: ValuebetEmission }

export default function ValuebetsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();

  const [autoUpdate, setAutoUpdate] = useState(true);
  useEffect(() => { void detectExtension(); }, []);
  const { data, loading } = useValuebets(autoUpdate, isAuthenticated);

  const [search, setSearch] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [marketId, setMarketId] = useState('');
  const [tier, setTier] = useState('');
  const [edgeMin, setEdgeMin] = useState('0');
  const [oddMin, setOddMin] = useState('');
  const [oddMax, setOddMax] = useState('');
  const [vigMax, setVigMax] = useState(''); // juice da casa máximo (%) — evita mercados muito carregados
  const [sortMode, setSortMode] = useState<'edge' | 'confidence' | 'recent'>('edge');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false); // modal "O que é um value bet?"

  // Modal "Lançar aposta" (RecordBetModal) — banca de value bet.
  const [betDraft, setBetDraft] = useState<RecordBetDraft | null>(null);

  // Toast simples de feedback.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Casas e mercados presentes nos dados (para os selects de filtro).
  const houses = useMemo(
    () => Array.from(new Set(data.flatMap((g) => g.valuebets.map((v) => v.bookmaker)))).sort(),
    [data],
  );
  const markets = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of data) for (const v of g.valuebets) if (!m.has(v.market)) m.set(v.market, valuebetMarketLabel(v) || marketLabel(v.market));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [data]);

  // Lista plana filtrada + ordenada.
  const items = useMemo<FlatVB[]>(() => {
    const q = search.trim().toLowerCase();
    const eMin = parseFloat(edgeMin) || 0;
    const oMin = parseFloat(oddMin) || 0;
    const oMax = parseFloat(oddMax) || 0;
    const vMax = parseFloat(vigMax) || 0;
    const tierNum = tier ? parseInt(tier, 10) : 0;

    const flat: FlatVB[] = [];
    for (const g of data) {
      if (q && !`${g.home} ${g.away} ${g.league}`.toLowerCase().includes(q)) continue;
      for (const vb of g.valuebets) {
        if (bookmaker && vb.bookmaker !== bookmaker) continue;
        if (marketId && vb.market !== marketId) continue;
        if (tierNum && vb.tier !== tierNum) continue;
        if (vb.edgePct < eMin) continue;
        if (oMin && vb.odd < oMin) continue;
        if (oMax && vb.odd > oMax) continue;
        // Juice máx: só descarta quando o juice é MEDÍVEL e acima do teto (mantém null=desconhecido).
        if (vMax && vb.houseVig != null && vb.houseVig * 100 > vMax) continue;
        flat.push({ group: g, vb });
      }
    }

    flat.sort((a, b) => {
      if (sortMode === 'confidence') return (b.vb.confidence || 0) - (a.vb.confidence || 0);
      if (sortMode === 'recent') return new Date(b.vb.update_at).getTime() - new Date(a.vb.update_at).getTime();
      return (b.vb.edgePct || 0) - (a.vb.edgePct || 0);
    });
    return flat;
  }, [data, search, bookmaker, marketId, tier, edgeMin, oddMin, oddMax, vigMax, sortMode]);

  const total = useMemo(() => data.reduce((acc, g) => acc + g.valuebets.length, 0), [data]);
  const activeFilters = [bookmaker, marketId, tier].filter(Boolean).length + (parseFloat(edgeMin) > 0 ? 1 : 0) + (oddMin || oddMax ? 1 : 0) + (vigMax ? 1 : 0);

  // Abre o RecordBetModal pré-preenchido com a emissão (aposta única).
  const openBet = useCallback((group: ValuebetGroup, vb: ValuebetEmission) => {
    setBetDraft({
      betType: 'single',
      eventId: vb.eventId,
      home: group.home,
      away: group.away,
      sport: group.sport,
      league: group.league,
      eventStart: group.date,
      surebetKey: vb.id,
      totalStake: 0,
      expectedProfitPct: vb.edgePct,
      source: 'calculator',
      strategy: 'valuebet',
      stakeFraction: vb.stakeFraction ?? null,
      legs: [{
        bookmakerSlug: vb.bookmaker,
        houseEventId: vb.eventId,
        market: vb.market,
        rawMarket: valuebetMarketLabel(vb),
        selection: valuebetSelectionLabel(vb, group.home, group.away),
        handicap: vb.handicap ?? null,
        side: 'back',
        odd: vb.odd,
        stake: 0,
      }],
    });
  }, []);

  // Proteção: página exclusiva para logados.
  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {authLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Verificando acesso...</div>
          ) : (
            <>
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-violet-500/15 ring-1 ring-violet-500/30 mb-4"><Gem className="text-violet-300" size={24} /></div>
              <h2 className="text-lg font-bold text-white">Entre para ver os value bets</h2>
              <p className="text-sm text-gray-400 mt-1 mb-5">As apostas de valor são exclusivas para usuários logados.</p>
              <button
                onClick={() => router.push({ pathname: '/valuebets', query: { ...router.query, modal: 'auth', page: 'login' } }, undefined, { shallow: true })}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-semibold transition"
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
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 ring-1 ring-violet-500/30">
            <Gem className="text-violet-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Value Bets</h1>
            <p className="text-sm text-gray-400">Apostas de valor vs. odd justa (Pinnacle / consenso)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white tabular-nums">{total}</div>
            <div className="text-[11px] uppercase tracking-wider text-gray-400">value bets</div>
          </div>
          <Tooltip label="O que é um value bet?">
            <button
              onClick={() => setInfoOpen(true)}
              className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-violet-200 hover:border-violet-500/40 transition"
              aria-label="O que é um value bet?"
            >
              <HelpCircle size={16} />
            </button>
          </Tooltip>
          <Tooltip label="Desempenho / CLV">
            <button
              onClick={() => router.push('/valuebets/clv')}
              className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-violet-200 hover:border-violet-500/40 transition"
              aria-label="Desempenho / CLV"
            >
              <LineChart size={16} />
            </button>
          </Tooltip>
          <Tooltip label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}>
            <button
              onClick={() => setAutoUpdate((v) => !v)}
              className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-violet-500/15 border-violet-500/40 text-violet-200' : 'bg-white/5 border-white/10 text-gray-400'}`}
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
        <Select
          className="w-44"
          value={sortMode}
          onChange={(v) => setSortMode(v as 'edge' | 'confidence' | 'recent')}
          options={[
            { value: 'edge', label: 'Maior valor (edge)' },
            { value: 'confidence', label: 'Maior confiança' },
            { value: 'recent', label: 'Mais recentes' },
          ]}
        />
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition ${
            filtersOpen || activeFilters > 0 ? 'bg-violet-500/15 border-violet-500/40 text-violet-200' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
          }`}
        >
          <Filter size={15} />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="grid place-items-center h-4 min-w-4 px-1 rounded-full bg-violet-500 text-[10px] font-bold text-white">{activeFilters}</span>
          )}
          <ChevronDown size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Painel de filtros */}
      {filtersOpen && (
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className="text-[11px] text-gray-400">Casa
            <Select className="mt-1" value={bookmaker} onChange={setBookmaker}
              options={[{ value: '', label: 'Todas' }, ...houses.map((h) => ({ value: h, label: h }))]} />
          </label>
          <label className="text-[11px] text-gray-400 col-span-2 sm:col-span-1">Mercado
            <Select className="mt-1" value={marketId} onChange={setMarketId}
              options={[{ value: '', label: 'Todos' }, ...markets.map((m) => ({ value: m.id, label: m.name }))]} />
          </label>
          <label className="text-[11px] text-gray-400">Tier
            <Select className="mt-1" value={tier} onChange={setTier}
              options={[{ value: '', label: 'Todos' }, { value: '1', label: 'T1 · Pinnacle' }, { value: '2', label: 'T2 · sec.' }, { value: '3', label: 'T3 · Consenso' }]} />
          </label>
          <label className="text-[11px] text-gray-400">Valor mín. (%)
            <input value={edgeMin} onChange={(e) => setEdgeMin(e.target.value)} inputMode="decimal" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-[11px] text-gray-400">Odd mín.
            <input value={oddMin} onChange={(e) => setOddMin(e.target.value)} inputMode="decimal" placeholder="1.30" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-[11px] text-gray-400">Odd máx.
            <input value={oddMax} onChange={(e) => setOddMax(e.target.value)} inputMode="decimal" placeholder="5.00" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-[11px] text-gray-400">Juice casa máx (%)
            <input value={vigMax} onChange={(e) => setVigMax(e.target.value)} inputMode="decimal" placeholder="9" className={`${inputClass} mt-1`} />
          </label>
        </div>
      )}

      {/* Lista */}
      {loading && !data.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <RefreshCcw className="animate-spin" size={18} /> Carregando value bets...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-white/5 ring-1 ring-white/10 mb-3"><Zap className="text-gray-500" size={22} /></div>
          <p className="text-sm text-gray-400">Nenhum value bet com os filtros atuais. Eles aparecem e somem conforme as odds andam.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map(({ group, vb }) => (
            <ValuebetCard key={vb.id} group={group} vb={vb} onBet={openBet} notify={notify} />
          ))}
        </div>
      )}

      {infoOpen && <InfoTopicModal topicKey="valuebet" onClose={() => setInfoOpen(false)} />}

      {betDraft && (
        <RecordBetModal draft={betDraft} preferBankrollKind="valuebet" onClose={() => setBetDraft(null)} onSaved={() => { setBetDraft(null); notify('Aposta lançada na banca de Value Bet.'); }} />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] rounded-lg bg-black/90 px-4 py-2 text-sm text-white ring-1 ring-white/10 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
