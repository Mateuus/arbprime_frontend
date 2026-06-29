'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Trophy, Calendar, TrendingUp, TrendingDown, Sigma, RefreshCcw, Rocket } from 'lucide-react';
import { Middle, MiddleData } from '@/interfaces/middle.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { Select } from '@/components/ui/Select';
import { MiddleGapLine } from '@/components/middles/MiddleGapLine';
import { SideBadge } from '@/components/middles/SideBadge';
import { useBookmakers } from '@/hooks/useBookmakers';
import { useMiddleHouses } from '@/utils/middleHouses';
import { commissionAdjustedMetrics, evaluateMiddleLegs, balancedStakes, effOdd } from '@/utils/middleMath';
import {
  fmtBRL, fmtSigned, fmtDateTime, evKind, mioloText,
  middleMarketLabel, legSelectionLabel, toSurebetLeg, toSurebetEvent,
} from '@/utils/middle';

const BANKROLL_KEY = 'middles:bankroll';

/**
 * Calculadora de stake do MIDDLE. Digite a banca → valor de cada perna em R$,
 * lucro-se-acerta, perda-se-erra e EV. Reflete a COMISSÃO da casa (exchange),
 * permite ARREDONDAR as stakes, e deixa TROCAR a casa de cada perna (busca a
 * mesma seleção em outras casas via grupo do evento) — adotando a odd/comissão
 * daquela casa e rebalanceando as stakes (∝ 1/odd). Tudo recalculado de verdade.
 */
export function MiddleCalcModal({ event, m, onClose, notify }: {
  event: MiddleData;
  m: Middle;
  onClose: () => void;
  notify?: (text: string) => void;
}) {
  const { getBookmaker } = useBookmakers();
  const [bankrollStr, setBankrollStr] = useState('1000');
  const [roundEnabled, setRoundEnabled] = useState(false);
  const [roundStep, setRoundStep] = useState('1');
  // Troca de casa por perna (índice → slug escolhido). Vazio = casa do robô.
  const [houseOverride, setHouseOverride] = useState<Record<number, string>>({});
  // "Lançar aposta" no Analytix (RecordBetModal).
  const [betDraft, setBetDraft] = useState<RecordBetDraft | null>(null);

  // Outras casas com a mesma seleção (sob demanda; o modal só monta quando aberto).
  const { legInfo, loading: housesLoading } = useMiddleHouses(m.legs, true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(BANKROLL_KEY);
      if (saved) setBankrollStr(saved);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(BANKROLL_KEY, bankrollStr); } catch { /* ignore */ }
  }, [bankrollStr]);

  const bankroll = Math.max(0, parseFloat(bankrollStr.replace(',', '.')) || 0);
  const surebetEvent = useMemo(() => toSurebetEvent(event), [event]);

  const commPct = (slug: string) => getBookmaker(slug)?.commissionPct ?? 0;
  const commFrac = (slug: string) => (getBookmaker(slug)?.commissionPct ?? 0) / 100;
  const commSig = m.legs.map((l) => getBookmaker(l.bookmaker)?.commissionPct ?? 0).join(',');

  const adj = useMemo(
    () => commissionAdjustedMetrics(m, commPct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, commSig],
  );

  const calc = useMemo(() => {
    const selfHouse = (l: Middle['legs'][number]) => ({ bookmaker: l.bookmaker, eventId: l.eventId, price: l.price, size: l.size ?? null, used: true });
    const perLeg = m.legs.map((l, i) => {
      const opts = legInfo[i]?.houses?.length ? legInfo[i].houses : [selfHouse(l)];
      const chosenSlug = (houseOverride[i] || l.bookmaker).toLowerCase();
      const chosen = opts.find((h) => h.bookmaker.toLowerCase() === chosenSlug) || opts[0];
      return { leg: l, opts, chosen };
    });

    const rawStakes = balancedStakes(perLeg.map((p) => p.chosen.price), bankroll);
    const step = parseFloat(roundStep.replace(',', '.')) || 0;
    const rounding = roundEnabled && step > 0;
    const stakes = rounding ? rawStakes.map((s) => Math.round(s / step) * step) : rawStakes;
    const totalStaked = stakes.reduce((a, b) => a + b, 0);
    const anyOverride = perLeg.some((p) => p.chosen.bookmaker.toLowerCase() !== p.leg.bookmaker.toLowerCase());

    const scaled = { ev: (bankroll * adj.ev) / 100, profitIfHit: (bankroll * adj.profitIfHit) / 100, lossIfMiss: (bankroll * adj.lossIfMiss) / 100 };
    // Trocou casa ou arredondou → recalcula de verdade com as odds/stakes reais.
    const money = (anyOverride || rounding)
      ? (evaluateMiddleLegs(m, perLeg.map((p, i) => ({ odd: p.chosen.price, frac: commFrac(p.chosen.bookmaker), stake: stakes[i], side: p.leg.side, line: p.leg.line }))) ?? scaled)
      : scaled;

    return { perLeg, stakes, totalStaked, rounding, anyOverride, ...money };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankroll, m, roundEnabled, roundStep, adj, commSig, legInfo, houseOverride]);

  const dateLabel = fmtDateTime(event.date);
  const market = middleMarketLabel(m);
  const displayEvPct = bankroll > 0 ? (calc.ev / bankroll) * 100 : adj.ev;
  const evK = evKind(displayEvPct);
  const anyComm = calc.perLeg.some((p) => (getBookmaker(p.chosen.bookmaker)?.commissionPct ?? 0) > 0);
  const pctOf = (v: number) => (bankroll > 0 ? `${fmtSigned((v / bankroll) * 100, 1)}% do stake` : '—');

  // Monta a aposta para o Analytix a partir do estado ATUAL da calculadora
  // (casas escolhidas, stakes, odds e comissões). 2 pernas → betType 'arb'.
  const makeDraft = (): RecordBetDraft => ({
    betType: 'arb',
    source: 'calculator',
    eventId: event.id,
    home: event.home,
    away: event.away,
    sport: event.sport,
    league: event.league,
    eventStart: event.date,
    surebetKey: m.id,
    totalStake: calc.totalStaked,
    expectedProfitPct: displayEvPct,
    expectedProfit: calc.ev,
    legs: calc.perLeg.map((p, i) => ({
      bookmakerSlug: p.chosen.bookmaker,
      houseEventId: p.chosen.eventId,
      market: p.leg.market,
      rawMarket: p.leg.rawMarket || null,
      selection: legSelectionLabel(p.leg, event.home, event.away),
      handicap: String(p.leg.line),
      side: 'back' as const,
      odd: p.chosen.price,
      stake: calc.stakes[i],
      commissionPct: getBookmaker(p.chosen.bookmaker)?.commissionPct ?? null,
    })),
  });

  const body = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar">
          <X size={18} />
        </button>

        {/* Cabeçalho */}
        <div className="mb-3 flex items-center gap-2 pr-8">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-indigo-500/5 text-indigo-300 ring-1 ring-indigo-500/30">
            <Calculator size={18} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold leading-tight text-white">
              {event.home} <span className="text-sm font-normal text-gray-500">×</span> {event.away}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
              {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={11} className="shrink-0 text-indigo-400/60" /> <span className="truncate">{event.league}</span></span>}
              {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Calendar size={11} /> {dateLabel}</span>}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gray-500">{market}</div>
          </div>
        </div>

        {/* Reta do miolo */}
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <MiddleGapLine m={m} home={event.home} away={event.away} />
          <div className="mt-2 text-center text-[11px] text-gray-400">
            Ganha as <strong className="text-white">duas pernas</strong>: <strong className="text-emerald-300">{mioloText(m, event.home, event.away)}</strong>
          </div>
        </div>

        {/* Stake total da operação (dividido entre as duas pernas) */}
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Stake total (R$) <span className="normal-case text-gray-500">· soma das duas pernas</span></span>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={bankrollStr}
              onChange={(e) => setBankrollStr(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-bold tabular-nums text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              placeholder="1000"
            />
            <div className="flex shrink-0 gap-1">
              {[100, 500, 1000].map((v) => (
                <button key={v} onClick={() => setBankrollStr(String(v))} className="rounded-lg bg-white/5 px-2.5 py-2 text-xs font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">
                  {v}
                </button>
              ))}
            </div>
          </div>
        </label>

        {/* Arredondamento das stakes */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRoundEnabled((v) => !v)}
            aria-pressed={roundEnabled}
            className={`inline-flex select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition ${roundEnabled ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            <span className={`relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors ${roundEnabled ? 'bg-indigo-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200 ${roundEnabled ? 'left-[14px]' : 'left-0.5'}`} />
            </span>
            Arredondar stakes
          </button>
          {roundEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">múltiplo de R$</span>
              <input
                value={roundStep}
                onChange={(e) => setRoundStep(e.target.value)}
                inputMode="decimal"
                className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums text-white focus:border-indigo-500/50 focus:outline-none"
              />
              {['1', '5', '10'].map((s) => (
                <button key={s} onClick={() => setRoundStep(s)} className={`rounded-md px-2 py-1 text-[11px] ring-1 transition ${roundStep === s ? 'bg-indigo-500/20 text-indigo-200 ring-indigo-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>{s}</button>
              ))}
            </div>
          )}
        </div>

        {housesLoading && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-gray-500"><RefreshCcw size={11} className="animate-spin" /> buscando a mesma seleção em outras casas…</div>
        )}

        {/* Pernas com stake em R$ + troca de casa */}
        <div className="mt-3 space-y-2">
          {calc.perLeg.map(({ leg, opts, chosen }, i) => {
            const stake = calc.stakes[i];
            const frac = commFrac(chosen.bookmaker);
            const ret = stake * effOdd(chosen.price, frac);
            const pct = calc.totalStaked > 0 ? (stake / calc.totalStaked) * 100 : leg.stakePct;
            const best = opts.length ? opts[0].price : chosen.price;
            const effLegObj = { ...leg, bookmaker: chosen.bookmaker, eventId: chosen.eventId, price: chosen.price, link: chosen.used ? leg.link : undefined, size: stake };
            return (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
                <SideBadge side={leg.side} selection={legSelectionLabel(leg, event.home, event.away)} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {opts.length > 1 ? (
                      <div className="min-w-0 flex-1">
                        <Select
                          value={chosen.bookmaker}
                          onChange={(v) => setHouseOverride((p) => ({ ...p, [i]: v }))}
                          buttonClassName="!py-1 !px-2 !text-[12px]"
                          options={opts.map((h) => ({
                            value: h.bookmaker,
                            label: getBookmaker(h.bookmaker)?.name || h.bookmaker,
                            node: (
                              <span className="flex w-full items-center gap-2">
                                <BookmakerTag slug={h.bookmaker} size={15} nameClassName="text-[12px]" />
                                {h.used && <span className="shrink-0 text-[9px] uppercase text-indigo-300/80">atual</span>}
                                <span className={`ml-auto shrink-0 text-sm font-bold tabular-nums ${h.price === best ? 'text-emerald-300' : 'text-gray-200'}`}>{h.price.toFixed(2)}</span>
                              </span>
                            ),
                          }))}
                        />
                      </div>
                    ) : (
                      <BookmakerTag slug={chosen.bookmaker} size={15} nameClassName="text-[12px]" />
                    )}
                    <CommissionBadge pct={getBookmaker(chosen.bookmaker)?.commissionPct} className="!px-1 !py-0 !text-[9px]" />
                  </div>
                  <div className="truncate text-[11px] text-gray-400">{legSelectionLabel(leg, event.home, event.away)}</div>
                </div>
                <div className="w-11 shrink-0 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-500">Odd</div>
                  <div className={`text-sm font-bold tabular-nums ${chosen.price === best && opts.length > 1 ? 'text-emerald-300' : 'text-white'}`}>{chosen.price.toFixed(2)}</div>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <div className="truncate text-[9px] uppercase tracking-wider text-gray-500">Apostar ({pct.toFixed(0)}%)</div>
                  <div className="text-sm font-bold tabular-nums text-indigo-200">{fmtBRL(stake)}</div>
                  <Tooltip label={<>Retorno se esta perna vencer: <strong className="text-white">odd × stake</strong>{frac > 0 && <> (já líquido da comissão)</>}. Inclui a stake de volta.</>} className="w-full justify-end">
                    <div className="cursor-help text-[9px] tabular-nums text-gray-500">retorno <span className="font-bold text-gray-100">{fmtBRL(ret)}</span></div>
                  </Tooltip>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10">
                  <OpenInHouse leg={toSurebetLeg(effLegObj)} event={surebetEvent} notify={notify} iconSize={14} title="Apostar na casa" />
                </span>
              </div>
            );
          })}
        </div>

        {/* Total apostado */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/5">
          <span className="text-gray-400">Total apostado</span>
          <span className="font-bold tabular-nums text-white">{fmtBRL(calc.totalStaked)}</span>
        </div>

        {/* Cenários em R$ */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5 text-center">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400/80"><TrendingUp size={11} /> Acerta</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-300">{fmtSigned(calc.profitIfHit, 2)}</div>
            <div className="text-[9px] text-gray-500">{pctOf(calc.profitIfHit)}</div>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-2.5 text-center">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-400/80"><TrendingDown size={11} /> Erra</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-rose-300">{fmtSigned(calc.lossIfMiss, 2)}</div>
            <div className="text-[9px] text-gray-500">{pctOf(calc.lossIfMiss)}</div>
          </div>
          <Tooltip label={<><strong className="text-white">Valor esperado</strong>: a média ponderada (por Poisson) de todos os desfechos. <strong className="text-amber-300">~0 = free middle</strong> (não custa nada na média).</>}>
            <div className={`w-full rounded-xl border p-2.5 text-center ${evK === 'negative' ? 'border-rose-500/25 bg-rose-500/[0.05]' : evK === 'free' ? 'border-amber-500/25 bg-amber-500/[0.05]' : 'border-emerald-500/25 bg-emerald-500/[0.05]'}`}>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-400"><Sigma size={11} /> EV médio</div>
              <div className={`mt-0.5 text-base font-bold tabular-nums ${evK === 'negative' ? 'text-rose-300' : evK === 'free' ? 'text-amber-300' : 'text-emerald-300'}`}>{fmtSigned(calc.ev, 2)}</div>
              <div className="text-[9px] text-gray-500">{pctOf(calc.ev)}</div>
            </div>
          </Tooltip>
        </div>

        {calc.anyOverride && (
          <p className="mt-2 text-center text-[10px] text-indigo-300/80">Casa trocada — odds, stakes e resultado recalculados.</p>
        )}
        {anyComm && (
          <p className="mt-1 text-center text-[10px] text-amber-300/80">Resultados já líquidos da comissão da casa (exchange — incide sobre o lucro).</p>
        )}

        <p className="mt-2 text-center text-[10px] leading-relaxed text-gray-500">
          O middle <strong className="text-gray-400">não é lucro garantido</strong>: é alta variância. Acerte o miolo e leva os dois lados; erre e a perda é limitada.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setBetDraft(makeDraft())} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-teal-400">
            <Rocket size={15} /> Lançar no Analytix
          </button>
          <button onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {body}
      {betDraft && (
        <RecordBetModal
          draft={betDraft}
          onClose={() => setBetDraft(null)}
          onSaved={() => { setBetDraft(null); notify?.('Aposta lançada no Analytix!'); onClose(); }}
        />
      )}
    </>,
    document.body,
  );
}

export default MiddleCalcModal;
