import { useState, useEffect, useRef } from 'react';
import { BetTicket, BetResult } from '@/services/nodelay/placeBet';
import { formatMoney } from '@/utils/nodelayUi';
import { CheckCircle2, XCircle, Loader2, Timer, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Bilhete de aposta de UMA conta (multi-conta = vários lado a lado). Enquanto
 * dispara, roda um cronômetro; quando responde, mostra o resultado + o tempo em
 * segundos (a resposta vem em ms). Visual espelha o cupom da casa.
 */

export interface SlipView {
  key: string; // única por disparo+conta (vários disparos não colidem)
  accountId: string;
  accountLabel: string;
  ticket: BetTicket;
  stakeRequested: number;
  status: 'placing' | 'done';
  result?: BetResult;
}

export function BetSlipCard({ slip, onConfirmOdds }: { slip: SlipView; onConfirmOdds?: (key: string) => void }) {
  const placing = slip.status === 'placing';
  const ok = slip.result?.ok;
  const needsConfirm = !placing && !ok && !!slip.result?.needsOddsConfirm; // odd mudou → perguntar

  const headCls = placing
    ? 'bg-white/5 text-gray-300'
    : ok
      ? 'bg-emerald-500/20 text-emerald-200'
      : needsConfirm
        ? 'bg-amber-500/20 text-amber-200'
        : 'bg-rose-500/20 text-rose-200';

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-brand-dark shadow-lg">
      {/* Cabeçalho de status */}
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${headCls}`}>
        {placing ? (
          <><Loader2 size={14} className="animate-spin" /> Enviando…</>
        ) : ok ? (
          <><CheckCircle2 size={14} /> Aposta realizada</>
        ) : needsConfirm ? (
          <><TrendingUp size={14} /> Odd mudou</>
        ) : (
          <><XCircle size={14} /> {slip.result?.error || 'Falhou'}</>
        )}
        <span className="ml-auto truncate text-[10px] font-medium opacity-70">{slip.accountLabel}</span>
      </div>

      {/* Odd mudou → mostra de X → Y e pergunta se aposta na nova */}
      {needsConfirm && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs">
          <p className="text-amber-100">
            A odd mudou de <b className="text-amber-300">{slip.result?.oldOdds}</b> para <b className="text-amber-300">{slip.result?.newOdds}</b>. Deseja apostar na nova odd?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onConfirmOdds?.(slip.key)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
            >
              Apostar na nova odd
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5 p-3">
        {/* Simples R$ x,xx + odd */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-400">
            Simples {formatMoney(ok && slip.result ? slip.result.stake : slip.stakeRequested)}
          </span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-white">
            {(ok && slip.result ? slip.result.odds : slip.ticket.odds).toFixed(2)}
          </span>
        </div>

        {/* Seleção + evento */}
        <div className="rounded-lg bg-white/[0.03] p-2.5">
          <div className="text-sm font-semibold text-white">{slip.ticket.selectionName}</div>
          <div className="text-[11px] text-gray-500">{slip.ticket.marketName}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="truncate">{slip.ticket.eventName}</span>
            {slip.ticket.clock && (
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-lime-300">{slip.ticket.clock}</span>
            )}
            {slip.ticket.score && (
              <span className="shrink-0 font-semibold tabular-nums text-gray-300">{slip.ticket.score}</span>
            )}
          </div>
        </div>

        {/* Avisos: odd mudou / parcial */}
        {ok && slip.result?.oddsChanged && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-300">
            <TrendingUp size={11} /> Odd ajustada para {slip.result.odds.toFixed(2)}
          </div>
        )}
        {ok && slip.result?.partial && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-300">
            <AlertTriangle size={11} /> Casa aceitou {formatMoney(slip.result.stake)} (parcial)
          </div>
        )}

        {/* Rodapé: cronômetro / retorno */}
        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
          <Chrono placing={placing} elapsedMs={slip.result?.elapsedMs} />
          {ok && slip.result ? (
            <div className="text-right">
              <div className="text-[10px] text-gray-500">Retorno</div>
              <div className="text-sm font-bold tabular-nums text-emerald-300">
                {formatMoney(slip.result.stake * slip.result.odds)}
              </div>
            </div>
          ) : (
            !placing && <span className="text-[10px] text-rose-300/70">Nada apostado</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Cronômetro: sobe enquanto envia; congela no tempo final (em segundos). */
function Chrono({ placing, elapsedMs }: { placing: boolean; elapsedMs?: number }) {
  const [ms, setMs] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!placing) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      setMs(performance.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [placing]);

  const shownMs = placing ? ms : (elapsedMs ?? ms);
  const secs = (shownMs / 1000).toFixed(placing ? 2 : 3);

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${placing ? 'text-gray-300' : 'text-lime-300'}`}>
      <Timer size={12} className={placing ? 'animate-pulse' : ''} /> {secs}s
    </span>
  );
}
