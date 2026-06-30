'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calculator, Trophy, Calendar, Clock, Zap, Rocket, Search, RefreshCcw, ShieldAlert,
  Sigma, TrendingUp, ChevronDown, Shield, AlertTriangle, Percent,
} from 'lucide-react';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import { Select } from '@/components/ui/Select';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { apiGateway, GroupedEvent, EventGroupDetail } from '@/gateways/api.gateway';
import { DuasVidas, DuasVidasData, DuasVidasBooster } from '@/interfaces/duasvidas.interface';
import { SurebetOdd } from '@/interfaces/arbitragem.interface';
import { formatEventDateTime } from '@/utils/eventTime';
import {
  dvMetrics, favoriteOf, hedgeStakes, apparentTone, evTone, lossTone, valueTone,
} from '@/utils/duasVidas';

const STAKE_KEY = 'duasvidas:bankroll';
const fmtBRL = (v: number) => Number.isFinite(v) ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ —';
const fmtPct = (n: number | null | undefined, dp = 2) =>
  n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(dp)}%`;
const num = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;
const impl = (o: number) => (o > 0 ? (1 / o) * 100 : 0); // odd → probabilidade implícita %

const oddInputCls =
  'w-[58px] rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 text-center text-sm font-bold tabular-nums text-white focus:border-fuchsia-500/50 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40';

const PaBadge = () => (
  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-500/15 px-1 py-px text-[8px] font-bold text-amber-300 ring-1 ring-amber-500/30">
    <Zap size={7} className="fill-amber-300" /> PA
  </span>
);

interface LiveBooster {
  bookmaker: string; eventId: string; side: 'home' | 'away'; price: number; pFair: number;
  fairOdd: number; edge: number; home: string; away: string; league: string | null; date: string;
  link: string; market: string; rawMarket: string; rawSelection: string; zebraOdd?: number; custom?: boolean;
}
const fromBooster = (b: DuasVidasBooster): LiveBooster => ({
  bookmaker: b.bookmaker, eventId: b.eventId, side: b.side, price: b.price, pFair: b.pFair,
  fairOdd: b.fairOdd, edge: b.edge, home: b.home, away: b.away, league: b.league, date: b.date,
  link: b.link, market: b.market, rawMarket: b.rawMarket, rawSelection: b.rawSelection,
});

type House = { bookmaker: string; eventId: string; link?: string; price: number };

/**
 * Calculadora Duas Vidas (completa). Odds EDITÁVEIS (aceita "." e ","), troca de casa PA por
 * perna de cobertura, arredondamento de stakes, múltipla quebrada por seleção (zebra + favorito-2
 * com odd própria + badge da casa), painel de probabilidade (odd→%), janela de hedge e Lançar no
 * Analytix. Tudo recalculado de verdade; as probabilidades JUSTAS (p2/pg) vêm da Pinnacle e não
 * mudam quando o usuário edita a odd OFERECIDA (muda só a margem/EV/valor).
 */
export function DuasVidasCalcModal({ event, sb, onClose, defaultStake, notify }: {
  event: DuasVidasData; sb: DuasVidas; onClose: () => void; defaultStake?: number; notify?: (text: string) => void;
}) {
  const parlay = useMemo(() => sb.surebet.find((l) => l.isParlay)!, [sb]);
  const favLeg = useMemo(() => sb.surebet.find((l) => !l.isParlay && (l.option || '').toLowerCase() !== 'draw')!, [sb]);
  const drawLeg = useMemo(() => sb.surebet.find((l) => (l.option || '').toLowerCase() === 'draw')!, [sb]);
  const baseZebraOdd = parlay.zebraPrice ?? (parlay.price / (parlay.booster?.price || 1));

  const [stakeStr, setStakeStr] = useState(() => String(defaultStake && defaultStake > 0 ? defaultStake : 1000));
  const [boosterIdx, setBoosterIdx] = useState(-1);
  const [custom, setCustom] = useState<LiveBooster | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hedgeOpen, setHedgeOpen] = useState(false);
  const [probsOpen, setProbsOpen] = useState(false);
  const [betDraft, setBetDraft] = useState<RecordBetDraft | null>(null);
  const [roundEnabled, setRoundEnabled] = useState(false);
  const [roundStepStr, setRoundStepStr] = useState('1');

  // Casa escolhida das pernas de cobertura (troca de PA em outras casas).
  const [favSlug, setFavSlug] = useState(favLeg.bookmaker);
  const [drawSlug, setDrawSlug] = useState(drawLeg.bookmaker);
  // Odds editáveis (favorito / empate / zebra / favorito-2).
  const [oddStr, setOddStr] = useState({
    fav: String(favLeg.price), draw: String(drawLeg.price),
    zebra: String(baseZebraOdd), booster: String(parlay.booster?.price ?? ''),
  });

  // Picker do 2º jogo
  const [pSearch, setPSearch] = useState('');
  const [pResults, setPResults] = useState<GroupedEvent[]>([]);
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState<string | null>(null);
  // Hedge
  const [hHome, setHHome] = useState('');
  const [hDraw, setHDraw] = useState('');

  useEffect(() => { try { const s = localStorage.getItem(STAKE_KEY); if (s) setStakeStr(s); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(STAKE_KEY, stakeStr); } catch { /* ignore */ } }, [stakeStr]);

  // Booster ativo + odd da zebra e casa que vão com ele (a múltipla é um bilhete só).
  const active = useMemo(() => {
    if (custom) return { b: custom, zebraOdd: custom.zebraOdd ?? baseZebraOdd, house: custom.bookmaker };
    const o = boosterIdx >= 0 ? sb.boosterOptions[boosterIdx] : null;
    if (o) return { b: fromBooster(o), zebraOdd: o.zebraPrice ?? baseZebraOdd, house: o.bookmaker };
    return { b: fromBooster(parlay.booster!), zebraOdd: baseZebraOdd, house: parlay.bookmaker };
  }, [custom, boosterIdx, sb.boosterOptions, parlay, baseZebraOdd]);
  const booster = active.b;
  const boosterHouse = active.house;

  // Trocou de 2º jogo → reseta as odds da múltipla (não na atualização do WS).
  useEffect(() => {
    setOddStr((o) => ({ ...o, zebra: String(active.zebraOdd), booster: String(active.b.price) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boosterIdx, custom?.eventId]);

  // Casas (PA) por perna de cobertura: a própria + as outras (otherOdds), dedup, por preço.
  const housesFor = (leg: typeof favLeg): House[] => {
    const own: House = { bookmaker: leg.bookmaker, eventId: leg.eventId, link: leg.link, price: leg.price };
    const map = new Map<string, House>();
    [own, ...(leg.otherOdds || [])].forEach((h) => {
      const k = (h.bookmaker || '').toLowerCase();
      if (!map.has(k)) map.set(k, { bookmaker: h.bookmaker, eventId: h.eventId, link: ('link' in h ? (h as House).link : leg.link), price: h.price });
    });
    return Array.from(map.values()).sort((a, b) => b.price - a.price);
  };
  const favHouses = useMemo(() => housesFor(favLeg), [favLeg]);
  const drawHouses = useMemo(() => housesFor(drawLeg), [drawLeg]);
  const favChosen = favHouses.find((h) => h.bookmaker.toLowerCase() === favSlug.toLowerCase()) || favHouses[0];
  const drawChosen = drawHouses.find((h) => h.bookmaker.toLowerCase() === drawSlug.toLowerCase()) || drawHouses[0];
  const pickHouse = (which: 'fav' | 'draw', slug: string) => {
    const list = which === 'fav' ? favHouses : drawHouses;
    const h = list.find((x) => x.bookmaker.toLowerCase() === slug.toLowerCase());
    if (which === 'fav') { setFavSlug(slug); if (h) setOddStr((o) => ({ ...o, fav: String(h.price) })); }
    else { setDrawSlug(slug); if (h) setOddStr((o) => ({ ...o, draw: String(h.price) })); }
  };

  // Odds correntes (editadas) + métricas honestas.
  const favOdd = num(oddStr.fav), drawOdd = num(oddStr.draw), zebraOdd = num(oddStr.zebra), boosterOdd = num(oddStr.booster);
  const parlayOdd = zebraOdd * boosterOdd;
  const total = Math.max(0, num(stakeStr));
  const metrics = useMemo(
    () => dvMetrics({ coverFavOdd: favOdd, drawOdd, zebraOdd, boosterOdd, p2: sb.p2, pg: booster.pFair }),
    [favOdd, drawOdd, zebraOdd, boosterOdd, sb.p2, booster.pFair],
  );

  // Stakes ∝ 1/odd + arredondamento opcional.
  const step = num(roundStepStr);
  // Stakes ∝ 1/odd mantendo SEMPRE 3 posições (odd vazia/0 → stake 0, sem quebrar índices).
  const invs = [favOdd, drawOdd, parlayOdd].map((o) => (o > 0 ? 1 / o : 0));
  const invSum = invs.reduce((a, b) => a + b, 0) || 1;
  const rawStakes = invs.map((i) => (total * i) / invSum);
  const stakes = (roundEnabled && step > 0) ? rawStakes.map((s) => Math.round(s / step) * step) : rawStakes;
  const [sFav, sDraw, sParlay] = stakes;
  const totalStaked = stakes.reduce((a, b) => a + b, 0);
  const retFav = sFav * favOdd, retDraw = sDraw * drawOdd, retParlay = sParlay * parlayOdd;

  const zebraName = sb.zebraSide === 'home' ? event.home : event.away;
  const favName = sb.zebraSide === 'home' ? event.away : event.home;
  const boosterName = booster.side === 'home' ? booster.home : booster.away;
  const bDateLabel = formatEventDateTime(booster.date);
  const boosterStartsFirst = useMemo(() => {
    const tb = new Date(booster.date).getTime(), tm = new Date(event.date).getTime();
    return Number.isFinite(tb) && Number.isFinite(tm) && tb < tm;
  }, [booster.date, event.date]);

  const scenarios = [
    { key: 'fav', label: `${favName} vence`, net: retFav - totalStaked, good: true },
    { key: 'draw', label: 'Empate', net: retDraw - totalStaked, good: true },
    { key: 'hit', label: 'Múltipla bate', sub: `${zebraName} + ${boosterName}`, net: retParlay - totalStaked, good: true },
    { key: 'miss', label: 'Múltipla falha', sub: `${zebraName} vence, ${boosterName} não`, net: -totalStaked, good: false },
  ];

  // Live legs (odd + casa correntes) p/ OpenInHouse e draft.
  const favLegLive: SurebetOdd = { ...favLeg, bookmaker: favChosen.bookmaker, eventId: favChosen.eventId, link: favChosen.link, price: favOdd };
  const drawLegLive: SurebetOdd = { ...drawLeg, bookmaker: drawChosen.bookmaker, eventId: drawChosen.eventId, link: drawChosen.link, price: drawOdd };
  const boosterEventLeg: SurebetOdd = {
    option: booster.side, price: boosterOdd, bookmaker: boosterHouse, eventId: booster.eventId,
    market: booster.market, rawMarket: booster.rawMarket, rawSelection: booster.rawSelection,
    link: booster.link, pa: true, historyPrice: [], otherOdds: [],
  };
  const boosterEvent = {
    id: booster.eventId, sport: event.sport, league: booster.league || '', home: booster.home,
    away: booster.away, date: booster.date, surebets: [], update_at: '', create_at: '',
  } as DuasVidasData;

  // Picker do 2º jogo
  useEffect(() => {
    if (!pickerOpen) return;
    const q = pSearch.trim();
    if (q.length < 2) { setPResults([]); return; }
    let active2 = true; setPLoading(true);
    const t = setTimeout(() => {
      apiGateway.getGroupedEvents({ search: q, sport: 'futebol', upcomingOnly: true, limit: 20 })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => { if (active2) setPResults(r?.data?.data?.events ?? []); })
        .catch(() => { if (active2) setPResults([]); })
        .finally(() => { if (active2) setPLoading(false); });
    }, 350);
    return () => { active2 = false; clearTimeout(t); };
  }, [pSearch, pickerOpen]);

  const pickEvent = async (g: GroupedEvent) => {
    setPError(null);
    if (g.houses.some((h) => h.eventId === parlay.eventId && h.bookmaker === boosterHouse)) { setPError('Escolha um jogo DIFERENTE do principal.'); return; }
    const houseEntry = g.houses.find((h) => h.bookmaker.toLowerCase() === boosterHouse.toLowerCase());
    if (!houseEntry) { setPError(`A casa da zebra (${boosterHouse}) não tem esse jogo — a múltipla não é possível aqui.`); return; }
    try {
      setPLoading(true);
      const r = await apiGateway.getEventGroup(houseEntry.bookmaker, houseEntry.eventId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (r as any)?.data?.data as EventGroupDetail | undefined;
      const mw = detail?.markets?.find((m) => m.marketId === 'match-winner:1' || m.marketId.startsWith('match-winner:'));
      if (!mw) { setPError('Esse jogo não tem o mercado 1X2 nessa casa.'); return; }
      const priceAt = (sel: string) => {
        const s = mw.selections.find((x) => x.selection.toLowerCase() === sel);
        const p = s?.prices.find((x) => x.bookmaker.toLowerCase() === boosterHouse.toLowerCase());
        return p ? { price: p.price, pa: !!p.pa } : null;
      };
      const h = priceAt('home'), d = priceAt('draw'), a = priceAt('away');
      if (!h || !d || !a) { setPError('Faltam odds 1X2 dessa casa p/ avaliar o favorito.'); return; }
      const fav = favoriteOf(h.price, d.price, a.price);
      const favPrice = fav.side === 'home' ? h : a;
      setCustom({
        bookmaker: boosterHouse, zebraOdd: active.zebraOdd, eventId: houseEntry.eventId, side: fav.side,
        price: favPrice.price, pFair: fav.prob, fairOdd: fav.prob > 0 ? 1 / fav.prob : 0,
        edge: (favPrice.price * fav.prob - 1) * 100, home: g.home, away: g.away, league: g.league,
        date: g.eventDate || '', link: houseEntry.link || '', market: mw.marketId,
        rawMarket: mw.marketName || 'Resultado Final', rawSelection: fav.side, custom: true,
      });
      setBoosterIdx(-1); setPickerOpen(false);
      if (!favPrice.pa) notify?.('Atenção: esse favorito não está marcado como PA nessa casa.');
    } catch { setPError('Não consegui carregar as odds desse jogo.'); } finally { setPLoading(false); }
  };

  const hedge = hedgeStakes(totalStaked, num(hHome), num(hDraw));

  const makeDraft = (): RecordBetDraft => ({
    betType: 'arb', source: 'calculator', eventId: event.id, home: event.home, away: event.away,
    sport: event.sport, league: event.league, eventStart: event.date, surebetKey: sb.id,
    totalStake: totalStaked, expectedProfitPct: metrics.apparentMargin, expectedProfit: totalStaked * (metrics.apparentMargin / 100),
    legs: [
      { bookmakerSlug: favChosen.bookmaker, houseEventId: favChosen.eventId, market: favLeg.market, rawMarket: favLeg.rawMarket || null, selection: favName, handicap: null, side: 'back' as const, odd: favOdd, stake: sFav, commissionPct: null },
      { bookmakerSlug: drawChosen.bookmaker, houseEventId: drawChosen.eventId, market: drawLeg.market, rawMarket: drawLeg.rawMarket || null, selection: 'Empate', handicap: null, side: 'back' as const, odd: drawOdd, stake: sDraw, commissionPct: null },
      { bookmakerSlug: boosterHouse, houseEventId: parlay.eventId, market: 'duas-vidas:1', rawMarket: 'Múltipla (Duas Vidas)', selection: `${zebraName} × ${boosterName}`, handicap: null, side: 'back' as const, odd: parlayOdd, stake: sParlay, commissionPct: null },
    ],
  });

  const houseSelect = (which: 'fav' | 'draw', houses: House[], chosen: House) => (
    houses.length > 1 ? (
      <Select
        value={chosen.bookmaker}
        onChange={(v) => pickHouse(which, v)}
        buttonClassName="!py-1 !px-2 !text-[12px]"
        options={houses.map((h) => ({
          value: h.bookmaker,
          label: h.bookmaker,
          node: (
            <span className="flex w-full items-center gap-2">
              <BookmakerTag slug={h.bookmaker} size={15} nameClassName="text-[12px]" />
              <span className={`ml-auto shrink-0 text-sm font-bold tabular-nums ${h.price === houses[0].price ? 'text-emerald-300' : 'text-gray-200'}`}>{h.price.toFixed(2)}</span>
            </span>
          ),
        }))}
      />
    ) : <BookmakerTag slug={chosen.bookmaker} size={15} nameClassName="text-[12px]" />
  );

  const body = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar"><X size={18} /></button>

        {/* Cabeçalho */}
        <div className="mb-3 flex items-center gap-2 pr-8">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-fuchsia-500/5 text-fuchsia-300 ring-1 ring-fuchsia-500/30"><Calculator size={18} /></span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-white">{event.home} <span className="text-sm font-normal text-gray-500">×</span> {event.away}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
              {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={11} className="shrink-0 text-fuchsia-400/60" /> <span className="truncate">{event.league}</span></span>}
              {formatEventDateTime(event.date) && <span className="inline-flex shrink-0 items-center gap-1"><Calendar size={11} /> {formatEventDateTime(event.date)}</span>}
            </div>
          </div>
        </div>

        {/* Painel de honestidade */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tooltip label="Margem APARENTE: trata a múltipla como perna única. É o gancho.">
            <div className={`w-full rounded-lg px-2 py-1.5 text-center ring-1 ${apparentTone(metrics.apparentMargin)}`}><div className="text-[9px] uppercase tracking-wider opacity-80">Aparente</div><div className="text-sm font-bold tabular-nums">{fmtPct(metrics.apparentMargin)}</div></div>
          </Tooltip>
          <Tooltip label="EV REAL = aparente − prob. de perda. O honesto (pior caso; o PA só melhora).">
            <div className="w-full rounded-lg bg-black/30 px-2 py-1.5 text-center ring-1 ring-white/10"><div className="text-[9px] uppercase tracking-wider text-gray-500"><Sigma size={9} className="inline" /> EV real</div><div className={`text-sm font-bold tabular-nums ${evTone(metrics.trueEV)}`}>{fmtPct(metrics.trueEV)}</div></div>
          </Tooltip>
          <Tooltip label="Probabilidade do galho de perda: zebra vence, favorito-2 falha.">
            <div className="w-full rounded-lg bg-black/30 px-2 py-1.5 text-center ring-1 ring-white/10"><div className="text-[9px] uppercase tracking-wider text-gray-500"><ShieldAlert size={9} className="inline" /> Perde</div><div className={`text-sm font-bold tabular-nums ${lossTone(metrics.pLoss)}`}>{metrics.pLoss.toFixed(1)}%</div></div>
          </Tooltip>
          <Tooltip label="Odd JUSTA da múltipla vs a oferecida. Valor = oferecida acima da justa.">
            <div className="w-full rounded-lg bg-black/30 px-2 py-1.5 text-center ring-1 ring-white/10"><div className="text-[9px] uppercase tracking-wider text-gray-500">Justa / valor</div><div className="text-sm font-bold tabular-nums text-gray-200">{metrics.parlayFairOdd != null ? metrics.parlayFairOdd.toFixed(2) : '—'}<span className={`ml-1 text-[11px] ${valueTone(metrics.parlayEdge)}`}>{fmtPct(metrics.parlayEdge, 1)}</span></div></div>
          </Tooltip>
        </div>

        {/* Stake total + arredondar */}
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Stake total (R$) <span className="normal-case text-gray-500">· dividido entre as 3 pernas</span></span>
          <div className="mt-1 flex items-center gap-2">
            <input value={stakeStr} onChange={(e) => setStakeStr(e.target.value)} inputMode="decimal" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-bold tabular-nums text-white placeholder-gray-500 focus:border-fuchsia-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" placeholder="1000" />
            <div className="flex shrink-0 gap-1">{[100, 500, 1000].map((v) => (<button key={v} onClick={() => setStakeStr(String(v))} className="rounded-lg bg-white/5 px-2.5 py-2 text-xs font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">{v}</button>))}</div>
          </div>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRoundEnabled((v) => !v)} aria-pressed={roundEnabled} className={`inline-flex select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition ${roundEnabled ? 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}>
            <span className={`relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors ${roundEnabled ? 'bg-fuchsia-500' : 'bg-white/20'}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200 ${roundEnabled ? 'left-[14px]' : 'left-0.5'}`} /></span>
            Arredondar
          </button>
          {roundEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">múltiplo de R$</span>
              <input value={roundStepStr} onChange={(e) => setRoundStepStr(e.target.value)} inputMode="decimal" className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums text-white focus:border-fuchsia-500/50 focus:outline-none" />
              {['1', '5', '10'].map((s) => (<button key={s} onClick={() => setRoundStepStr(s)} className={`rounded-md px-2 py-1 text-[11px] ring-1 transition ${roundStepStr === s ? 'bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>{s}</button>))}
            </div>
          )}
        </div>

        {/* Pernas */}
        <div className="mt-3 space-y-2">
          {/* Cobertura: favorito */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.05] p-2.5 ring-1 ring-emerald-500/15">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">1ª</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[12px] font-semibold text-white">{favName} {favLeg.pa && <PaBadge />}</div>
              {houseSelect('fav', favHouses, favChosen)}
            </div>
            <input value={oddStr.fav} onChange={(e) => setOddStr((o) => ({ ...o, fav: e.target.value }))} inputMode="decimal" className={oddInputCls} aria-label="Odd favorito" />
            <div className="w-[84px] shrink-0 text-right"><div className="text-sm font-bold tabular-nums text-emerald-200">{fmtBRL(sFav)}</div><div className="text-[9px] tabular-nums text-gray-500">retorno {fmtBRL(retFav)}</div></div>
            <OpenInHouse leg={favLegLive} event={event} notify={notify} iconSize={14} />
          </div>
          {/* Cobertura: empate */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.05] p-2.5 ring-1 ring-emerald-500/15">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">2ª</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white">Empate</div>
              {houseSelect('draw', drawHouses, drawChosen)}
            </div>
            <input value={oddStr.draw} onChange={(e) => setOddStr((o) => ({ ...o, draw: e.target.value }))} inputMode="decimal" className={oddInputCls} aria-label="Odd empate" />
            <div className="w-[84px] shrink-0 text-right"><div className="text-sm font-bold tabular-nums text-emerald-200">{fmtBRL(sDraw)}</div><div className="text-[9px] tabular-nums text-gray-500">retorno {fmtBRL(retDraw)}</div></div>
            <OpenInHouse leg={drawLegLive} event={event} notify={notify} iconSize={14} />
          </div>
          {/* Múltipla (quebrada por seleção) */}
          <div className="rounded-lg bg-fuchsia-500/[0.07] p-2.5 ring-1 ring-fuchsia-500/25">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-fuchsia-200"><Zap size={13} className="fill-fuchsia-300/40" /> Múltipla <span className="text-[9px] font-normal text-fuchsia-300/70">um bilhete · {boosterHouse}</span></span>
              <div className="text-right"><div className="text-sm font-bold tabular-nums text-fuchsia-200">{fmtBRL(sParlay)}</div><div className="text-[9px] tabular-nums text-gray-500">retorno {fmtBRL(retParlay)}</div></div>
            </div>
            {/* zebra */}
            <div className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1.5 ring-1 ring-white/5">
              <BookmakerTag slug={boosterHouse} size={14} nameClassName="text-[10px]" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">{zebraName} <span className="text-[9px] font-normal text-fuchsia-300/70">zebra</span></span>
              <input value={oddStr.zebra} onChange={(e) => setOddStr((o) => ({ ...o, zebra: e.target.value }))} inputMode="decimal" className={oddInputCls} aria-label="Odd zebra" />
            </div>
            {/* favorito-2 */}
            <div className="mt-1 flex items-center gap-2 rounded-md bg-black/20 px-2 py-1.5 ring-1 ring-white/5">
              <BookmakerTag slug={boosterHouse} size={14} nameClassName="text-[10px]" className="shrink-0" />
              <span className="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] font-semibold text-white">{boosterName} <span className="text-[9px] font-normal text-fuchsia-300/70">favorito-2</span> <PaBadge /></span>
              <input value={oddStr.booster} onChange={(e) => setOddStr((o) => ({ ...o, booster: e.target.value }))} inputMode="decimal" className={oddInputCls} aria-label="Odd favorito-2" />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] tabular-nums text-fuchsia-300/80">{(zebraOdd || 0).toFixed(2)} × {(boosterOdd || 0).toFixed(2)} = <strong className="text-fuchsia-200">{(parlayOdd || 0).toFixed(2)}</strong></span>
              <OpenInHouse leg={{ ...parlay, price: parlayOdd } as SurebetOdd} event={event} notify={notify} iconSize={14} />
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/5"><span className="text-gray-400">Total apostado</span><span className="font-bold tabular-nums text-white">{fmtBRL(totalStaked)}</span></div>

        {/* 2º jogo */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200"><Zap size={12} className="fill-fuchsia-300/40" /> 2º jogo (turbina a zebra)</span>
            <button onClick={() => { setPickerOpen((v) => !v); setPError(null); }} className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-500/15 px-2 py-1 text-[11px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/30 transition hover:bg-fuchsia-500/25"><Search size={12} /> Buscar outro</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 rounded-lg bg-black/20 px-2 py-1.5 ring-1 ring-white/5">
              <div className="truncate text-[12px] font-semibold text-white">{boosterName} <span className="text-[9px] font-normal text-gray-500">favorito · {booster.home} × {booster.away}{booster.custom ? ' · custom' : ''}</span></div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-gray-400">
                <BookmakerTag slug={boosterHouse} size={11} nameClassName="text-[9px]" />
                {bDateLabel && <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {bDateLabel}{boosterStartsFirst && <span className="ml-0.5 rounded bg-sky-500/15 px-1 text-sky-300 ring-1 ring-sky-500/30">antes</span>}</span>}
                <span>justa <span className="tabular-nums text-gray-200">{booster.fairOdd.toFixed(2)}</span></span>
                <span>valor <span className={`tabular-nums font-bold ${valueTone(metrics.boosterEdge)}`}>{fmtPct(metrics.boosterEdge, 1)}</span></span>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10"><OpenInHouse leg={boosterEventLeg} event={boosterEvent} notify={notify} iconSize={14} title="Abrir o 2º jogo na casa" /></span>
          </div>
          {sb.boosterOptions.length > 0 && !custom && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button onClick={() => setBoosterIdx(-1)} className={`rounded-md px-2 py-1 text-[10px] font-semibold ring-1 transition ${boosterIdx === -1 ? 'bg-fuchsia-500/25 text-fuchsia-100 ring-fuchsia-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>melhor</button>
              {sb.boosterOptions.map((b, i) => (<button key={`${b.bookmaker}:${b.eventId}`} onClick={() => setBoosterIdx(i)} className={`rounded-md px-2 py-1 text-[10px] font-semibold ring-1 tabular-nums transition ${boosterIdx === i ? 'bg-fuchsia-500/25 text-fuchsia-100 ring-fuchsia-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>{(b.side === 'home' ? b.home : b.away).split(' ')[0]} {b.price.toFixed(2)}</button>))}
            </div>
          )}
          {custom && <button onClick={() => setCustom(null)} className="mt-1.5 text-[10px] text-fuchsia-300/80 hover:text-fuchsia-200">← voltar p/ sugestão do robô</button>}
          {pickerOpen && (
            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2">
              <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" /><input autoFocus value={pSearch} onChange={(e) => setPSearch(e.target.value)} placeholder="Buscar 2º jogo (time, liga)…" className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-sm text-white placeholder-gray-500 focus:border-fuchsia-500/50 focus:outline-none" /></div>
              <p className="mt-1 text-[9px] text-gray-500">O favorito é pego na <strong className="text-gray-400">mesma casa da zebra ({boosterHouse})</strong> — único jeito da múltipla existir num bilhete.</p>
              {pError && <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-rose-300"><AlertTriangle size={11} /> {pError}</p>}
              {pLoading && <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500"><RefreshCcw size={11} className="animate-spin" /> buscando…</p>}
              <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
                {pResults.map((g) => {
                  const hasHouse = g.houses.some((h) => h.bookmaker.toLowerCase() === boosterHouse.toLowerCase());
                  return (<button key={g.key} onClick={() => pickEvent(g)} disabled={!hasHouse} className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11px] ring-1 transition ${hasHouse ? 'bg-white/5 ring-white/10 hover:bg-fuchsia-500/15' : 'cursor-not-allowed bg-black/20 text-gray-600 ring-white/5'}`}><span className="min-w-0"><span className="block truncate font-semibold text-white">{g.home} × {g.away}</span><span className="block truncate text-[9px] text-gray-500">{g.league} · {formatEventDateTime(g.eventDate || '')}</span></span>{hasHouse ? <span className="shrink-0 text-[9px] font-semibold text-fuchsia-300">usar →</span> : <span className="shrink-0 text-[9px] text-gray-600">s/ {boosterHouse}</span>}</button>);
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cenários */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {scenarios.map((s) => (
            <div key={s.key} className={`rounded-xl border p-2.5 ${s.good ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-rose-500/30 bg-rose-500/[0.08]'}`}>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400">{s.good ? <TrendingUp size={11} className="text-emerald-400/80" /> : <ShieldAlert size={11} className="text-rose-400/80" />} {s.label}</div>
              {s.sub && <div className="truncate text-[9px] text-gray-500">{s.sub}</div>}
              <div className={`mt-0.5 text-base font-bold tabular-nums ${s.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{s.net >= 0 ? '+' : ''}{fmtBRL(s.net)}</div>
            </div>
          ))}
        </div>

        {/* Probabilidades (odd → %) */}
        <button onClick={() => setProbsOpen((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/10 transition hover:bg-white/[0.06]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-200"><Percent size={13} className="text-fuchsia-300" /> Probabilidades</span>
          <ChevronDown size={14} className={`text-gray-400 transition ${probsOpen ? 'rotate-180' : ''}`} />
        </button>
        {probsOpen && (
          <div className="mt-1.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Implícita (da odd oferecida)</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-4">
              {[{ l: favName, v: impl(favOdd) }, { l: 'Empate', v: impl(drawOdd) }, { l: 'Zebra', v: impl(zebraOdd) }, { l: 'Favorito-2', v: impl(boosterOdd) }].map((x, i) => (
                <div key={i} className="rounded-md bg-white/5 px-2 py-1 text-center ring-1 ring-white/10"><div className="truncate text-[9px] text-gray-500">{x.l}</div><div className="font-bold tabular-nums text-gray-200">{x.v.toFixed(1)}%</div></div>
              ))}
            </div>
            <div className="mb-1 mt-2.5 text-[10px] uppercase tracking-wider text-gray-500">Justa (Pinnacle/consenso) — o que importa</div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-center ring-1 ring-emerald-500/25"><div className="text-[9px] text-gray-400">Cobertura ganha</div><div className="font-bold tabular-nums text-emerald-300">{((1 - sb.p2) * 100).toFixed(1)}%</div></div>
              <div className="rounded-md bg-fuchsia-500/10 px-2 py-1 text-center ring-1 ring-fuchsia-500/25"><div className="text-[9px] text-gray-400">Múltipla bate</div><div className="font-bold tabular-nums text-fuchsia-300">{(sb.p2 * booster.pFair * 100).toFixed(1)}%</div></div>
              <div className="rounded-md bg-rose-500/10 px-2 py-1 text-center ring-1 ring-rose-500/25"><div className="text-[9px] text-gray-400">Perde tudo</div><div className="font-bold tabular-nums text-rose-300">{(sb.p2 * (1 - booster.pFair) * 100).toFixed(1)}%</div></div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-gray-500">Implícita = 1/odd (com a margem da casa embutida). A <strong className="text-gray-300">justa</strong> tira a margem via Pinnacle — é a probabilidade real. O <strong className="text-amber-300/80">PA</strong> do favorito-2 baixa a "perde tudo" na prática (trava se abrir 2-0).</p>
          </div>
        )}

        {/* Hedge */}
        <button onClick={() => setHedgeOpen((v) => !v)} className="mt-2 flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/10 transition hover:bg-white/[0.06]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-200"><Shield size={13} className="text-sky-300" /> Janela de hedge {boosterStartsFirst && <span className="rounded bg-sky-500/15 px-1 text-[9px] text-sky-300 ring-1 ring-sky-500/30">2º jogo começa antes</span>}</span>
          <ChevronDown size={14} className={`text-gray-400 transition ${hedgeOpen ? 'rotate-180' : ''}`} />
        </button>
        {hedgeOpen && (
          <div className="mt-1.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
            <p className="text-[10px] leading-relaxed text-gray-400">Se o 2º jogo começa antes e o favorito-2 está perdendo, recupere o total apostando no principal <strong className="text-sky-300">ao vivo</strong>: <code className="text-gray-300">h = total / odd</code>. Informe as odds ao vivo:</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px] text-gray-400">Odd ao vivo {favName}<input value={hHome} onChange={(e) => setHHome(e.target.value)} inputMode="decimal" placeholder="ex. 1,45" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm tabular-nums text-white focus:border-sky-500/50 focus:outline-none" /></label>
              <label className="text-[10px] text-gray-400">Odd ao vivo Empate<input value={hDraw} onChange={(e) => setHDraw(e.target.value)} inputMode="decimal" placeholder="ex. 3,20" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm tabular-nums text-white focus:border-sky-500/50 focus:outline-none" /></label>
            </div>
            {(num(hHome) > 1 && num(hDraw) > 1) && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10"><div className="text-[9px] uppercase text-gray-500">{favName}</div><div className="font-bold tabular-nums text-sky-200">{fmtBRL(hedge.h1)}</div></div>
                <div className="rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10"><div className="text-[9px] uppercase text-gray-500">Empate</div><div className="font-bold tabular-nums text-sky-200">{fmtBRL(hedge.hX)}</div></div>
                <div className={`rounded-lg px-2 py-1.5 ring-1 ${hedge.recovers ? 'bg-emerald-500/10 ring-emerald-500/25' : 'bg-amber-500/10 ring-amber-500/25'}`}><div className="text-[9px] uppercase text-gray-500">Resultado</div><div className={`font-bold tabular-nums ${hedge.recovers ? 'text-emerald-300' : 'text-amber-300'}`}>{hedge.net >= 0 ? '+' : ''}{fmtBRL(hedge.net)}</div></div>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setBetDraft(makeDraft())} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-fuchsia-500 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-400"><Rocket size={15} /> Lançar no Analytix</button>
          <button onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">Fechar</button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {body}
      {betDraft && <RecordBetModal draft={betDraft} onClose={() => setBetDraft(null)} onSaved={() => { setBetDraft(null); notify?.('Aposta lançada no Analytix!'); onClose(); }} />}
    </>,
    document.body,
  );
}

export default DuasVidasCalcModal;
