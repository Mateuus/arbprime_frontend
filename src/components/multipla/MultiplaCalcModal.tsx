'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calculator, Layers, TrendingUp, ShieldCheck, Rocket, Ticket } from 'lucide-react';
import { MultiArbData } from '@/interfaces/multipla.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBookmakers } from '@/hooks/useBookmakers';
import { balancedStakes, effOdd } from '@/utils/middleMath';
import {
  fmtBRL, fmtDateTime, coverLabel, multiKey,
  legSelectionLabel, gameOfLeg, toSurebetLeg, toSurebetEvent,
} from '@/utils/multipla';

const STAKE_KEY = 'multipla:stake';

/**
 * Calculadora de stake da MÚLTIPLA. Digite o stake total → valor de cada BILHETE
 * (acumulada) em R$, o retorno garantido e o lucro. Como é uma arbitragem real,
 * distribui ∝ 1/combinedOdd (todos os bilhetes retornam ~igual) e reflete a
 * COMISSÃO da casa (exchange, incide só sobre o lucro). Permite arredondar as
 * stakes — aí o retorno garantido passa a ser o MENOR retorno entre os bilhetes.
 */
export function MultiplaCalcModal({ data, onClose, notify }: {
  data: MultiArbData;
  onClose: () => void;
  notify?: (text: string) => void;
}) {
  const { getBookmaker } = useBookmakers();
  const [stakeStr, setStakeStr] = useState('1000');
  const [roundEnabled, setRoundEnabled] = useState(false);
  const [roundStep, setRoundStep] = useState('1');
  const [betDraft, setBetDraft] = useState<RecordBetDraft | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const s = localStorage.getItem(STAKE_KEY); if (s) setStakeStr(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STAKE_KEY, stakeStr); } catch { /* ignore */ }
  }, [stakeStr]);

  const total = Math.max(0, parseFloat(stakeStr.replace(',', '.')) || 0);
  const commFrac = (slug: string) => (getBookmaker(slug)?.commissionPct ?? 0) / 100;
  const commSig = data.tickets.map((t) => getBookmaker(t.bookmaker)?.commissionPct ?? 0).join(',');

  const calc = useMemo(() => {
    const odds = data.tickets.map((t) => t.combinedOdd);
    const raw = balancedStakes(odds, total);
    const step = parseFloat(roundStep.replace(',', '.')) || 0;
    const rounding = roundEnabled && step > 0;
    const stakes = rounding ? raw.map((s) => Math.round(s / step) * step) : raw;
    const totalStaked = stakes.reduce((a, b) => a + b, 0);
    // Retorno de cada bilhete = stake × odd efetiva (líquida da comissão da casa).
    const returns = data.tickets.map((t, i) => stakes[i] * effOdd(t.combinedOdd, commFrac(t.bookmaker)));
    const guaranteed = returns.length ? Math.min(...returns) : 0;
    const profit = guaranteed - totalStaked;
    const profitPct = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
    return { stakes, returns, totalStaked, guaranteed, profit, profitPct, rounding };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, data, roundEnabled, roundStep, commSig]);

  const anyComm = data.tickets.some((t) => (getBookmaker(t.bookmaker)?.commissionPct ?? 0) > 0);
  const earliest = data.games.map((g) => g.date).sort()[0] || data.games[0]?.date;

  // Monta a aposta p/ o Analytix: cada BILHETE (acumulada) é uma "perna" do arb
  // (odd = combinada, 1 stake). O conjunto cobre todos os desfechos → betType 'arb'.
  const makeDraft = (): RecordBetDraft => ({
    betType: 'arb',
    source: 'calculator',
    eventId: data.id,
    home: data.games[0] ? `${data.games[0].home} × ${data.games[0].away}` : null,
    away: data.games[1] ? `${data.games[1].home} × ${data.games[1].away}` : null,
    sport: data.sport,
    league: data.games.map((g) => g.league).filter(Boolean).join(' + '),
    eventStart: earliest,
    surebetKey: multiKey(data),
    totalStake: calc.totalStaked,
    expectedProfitPct: calc.profitPct,
    expectedProfit: calc.profit,
    legs: data.tickets.map((t, i) => ({
      bookmakerSlug: t.bookmaker,
      market: 'multipla',
      selection: t.legs.map((leg) => legSelectionLabel(leg, gameOfLeg(data, leg))).join(' + '),
      side: 'back' as const,
      odd: t.combinedOdd,
      stake: calc.stakes[i],
      commissionPct: getBookmaker(t.bookmaker)?.commissionPct ?? null,
    })),
  });

  const body = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar"><X size={18} /></button>

        {/* Cabeçalho */}
        <div className="mb-3 flex items-center gap-2 pr-8">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 text-cyan-300 ring-1 ring-cyan-500/30">
            <Calculator size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-base font-bold leading-tight text-white">
              <Layers size={15} className="text-cyan-300" /> Múltipla · {data.tickets.length} bilhetes
            </div>
            <div className="mt-0.5 text-[11px] text-gray-400">Lucro garantido <strong className="text-cyan-300">{data.profitMargin.toFixed(2)}%</strong></div>
          </div>
        </div>

        {/* Os dois jogos */}
        <div className="mb-3 space-y-1.5">
          {data.games.map((g, i) => (
            <div key={g.groupId} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300 ring-1 ring-cyan-500/30">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{g.home} <span className="text-[11px] text-gray-500">×</span> {g.away}</div>
                <div className="truncate text-[10px] text-gray-400">{g.league}{fmtDateTime(g.date) ? ` · ${fmtDateTime(g.date)}` : ''}</div>
              </div>
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-gray-300 ring-1 ring-white/10">{coverLabel(g.cover)}</span>
            </div>
          ))}
        </div>

        {/* Stake total */}
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Stake total (R$) <span className="normal-case text-gray-500">· dividido entre os bilhetes</span></span>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={stakeStr}
              onChange={(e) => setStakeStr(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-bold tabular-nums text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="1000"
            />
            <div className="flex shrink-0 gap-1">
              {[100, 500, 1000].map((v) => (
                <button key={v} onClick={() => setStakeStr(String(v))} className="rounded-lg bg-white/5 px-2.5 py-2 text-xs font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">{v}</button>
              ))}
            </div>
          </div>
        </label>

        {/* Arredondamento */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRoundEnabled((v) => !v)}
            aria-pressed={roundEnabled}
            className={`inline-flex select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition ${roundEnabled ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
          >
            <span className={`relative inline-block h-4 w-7 shrink-0 rounded-full transition-colors ${roundEnabled ? 'bg-cyan-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200 ${roundEnabled ? 'left-[14px]' : 'left-0.5'}`} />
            </span>
            Arredondar stakes
          </button>
          {roundEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-500">múltiplo de R$</span>
              <input value={roundStep} onChange={(e) => setRoundStep(e.target.value)} inputMode="decimal" className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm tabular-nums text-white focus:border-cyan-500/50 focus:outline-none" />
              {['1', '5', '10'].map((s) => (
                <button key={s} onClick={() => setRoundStep(s)} className={`rounded-md px-2 py-1 text-[11px] ring-1 transition ${roundStep === s ? 'bg-cyan-500/20 text-cyan-200 ring-cyan-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* Bilhetes com stake em R$ */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500"><Ticket size={11} /> Bilhetes</div>
          {data.tickets.map((tk, i) => {
            const stake = calc.stakes[i];
            const ret = calc.returns[i];
            const pct = calc.totalStaked > 0 ? (stake / calc.totalStaked) * 100 : tk.stakePct;
            return (
              <div key={i} className="rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
                <div className="flex items-center gap-2">
                  <BookmakerTag slug={tk.bookmaker} size={16} nameClassName="text-[12px]" tooltip />
                  <CommissionBadge pct={getBookmaker(tk.bookmaker)?.commissionPct} className="!px-1 !py-0 !text-[9px]" />
                  <span className="ml-auto text-[11px] tabular-nums text-gray-400">odd <strong className="text-white">{tk.combinedOdd.toFixed(2)}</strong></span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {tk.legs.map((leg, li) => {
                      const g = gameOfLeg(data, leg);
                      const evt = g ? toSurebetEvent(g, data.sport) : toSurebetEvent(data.games[0], data.sport);
                      return (
                        <div key={li} className="flex items-center gap-1.5">
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/10 text-[9px] font-bold text-gray-300">{(g ? data.games.indexOf(g) : li) + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-gray-200">{legSelectionLabel(leg, g)}</span>
                          <span className="inline-flex shrink-0 items-center rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">
                            <OpenInHouse leg={toSurebetLeg(leg, tk.bookmaker)} event={evt} notify={notify} iconSize={12} title="Abrir o jogo na casa" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-24 shrink-0 text-right">
                    <div className="truncate text-[9px] uppercase tracking-wider text-gray-500">Apostar ({pct.toFixed(0)}%)</div>
                    <div className="text-sm font-bold tabular-nums text-cyan-200">{fmtBRL(stake)}</div>
                    <Tooltip label={<>Retorno se este bilhete vencer: <strong className="text-white">odd × stake</strong>{commFrac(tk.bookmaker) > 0 && <> (já líquido da comissão)</>}.</>} className="w-full justify-end">
                      <div className="cursor-help text-[9px] tabular-nums text-gray-500">retorno <span className="font-bold text-gray-100">{fmtBRL(ret)}</span></div>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total apostado */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] ring-1 ring-white/5">
          <span className="text-gray-400">Total apostado</span>
          <span className="font-bold tabular-nums text-white">{fmtBRL(calc.totalStaked)}</span>
        </div>

        {/* Resultado garantido */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] p-2.5 text-center">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-cyan-400/80"><ShieldCheck size={11} /> Retorno garantido</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-cyan-200">{fmtBRL(calc.guaranteed)}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-2.5 text-center">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400/80"><TrendingUp size={11} /> Lucro</div>
            <div className="mt-0.5 text-base font-bold tabular-nums text-emerald-300">{fmtBRL(calc.profit)}</div>
            <div className="text-[9px] text-gray-500">{calc.profitPct.toFixed(2)}%</div>
          </div>
        </div>

        {calc.rounding && (
          <p className="mt-2 text-center text-[10px] text-cyan-300/80">Stakes arredondadas — o retorno garantido é o menor entre os bilhetes.</p>
        )}
        {anyComm && (
          <p className="mt-1 text-center text-[10px] text-amber-300/80">Resultados já líquidos da comissão da casa (exchange — incide sobre o lucro).</p>
        )}
        <p className="mt-2 text-center text-[10px] leading-relaxed text-gray-500">
          Aposte <strong className="text-gray-400">todos os bilhetes</strong>: juntos cobrem todos os desfechos dos dois jogos — dê no que der, um bilhete vence.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setBetDraft(makeDraft())} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-teal-400">
            <Rocket size={15} /> Lançar no Analytix
          </button>
          <button onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">Fechar</button>
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

export default MultiplaCalcModal;
