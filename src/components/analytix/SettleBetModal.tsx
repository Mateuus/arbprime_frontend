import React, { useMemo, useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { apiGateway, BetDTO, LegStatusValue, SettleLegInput } from '@/gateways/api.gateway';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { Select } from '@/components/ui/Select';
import { BRL, signedBRL, profitColor, LEG_STATUS_OPTIONS, unwrap } from './format';

interface Props {
  bet: BetDTO;
  onClose: () => void;
  onSettled?: (bet: BetDTO | null) => void;
}

interface LegState { legId: string; status: LegStatusValue; settledReturn: string }

/** P&L de uma perna no cliente (espelha analytix.service.legPnl). */
const legPnlPreview = (status: LegStatusValue, stake: number, odd: number, comm: number, settledReturn: number, isFreebet = false): number => {
  const c = (comm || 0) / 100;
  switch (status) {
    case 'won': return stake * (odd - 1) * (1 - c);
    case 'half_won': return (stake / 2) * (odd - 1) * (1 - c);
    case 'lost': return isFreebet ? 0 : -stake;
    case 'half_lost': return isFreebet ? 0 : -stake / 2;
    case 'cashout': return (settledReturn || 0) - (isFreebet ? 0 : stake);
    default: return 0;
  }
};

/** Modal de liquidação: status por perna; recalcula o lucro realizado. */
export default function SettleBetModal({ bet, onClose, onSettled }: Props) {
  const [state, setState] = useState<LegState[]>(() =>
    bet.legs.map((l) => ({ legId: l.id, status: l.status, settledReturn: l.settledReturn != null ? String(l.settledReturn) : '' })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setLeg = (legId: string, patch: Partial<LegState>) =>
    setState((prev) => prev.map((s) => (s.legId === legId ? { ...s, ...patch } : s)));

  const realized = useMemo(() => {
    return bet.legs.reduce((acc, l) => {
      const s = state.find((x) => x.legId === l.id);
      if (!s) return acc;
      return acc + legPnlPreview(s.status, l.stake, l.odd, l.commissionPct || 0, parseFloat(s.settledReturn.replace(',', '.')) || 0, l.isFreebet);
    }, 0);
  }, [state, bet.legs]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const legs: SettleLegInput[] = state.map((s) => ({
        legId: s.legId,
        status: s.status,
        settledReturn: s.status === 'cashout' ? (parseFloat(s.settledReturn.replace(',', '.')) || 0) : undefined,
      }));
      const r = await apiGateway.settleBet(bet.id, legs);
      if (r.data?.result === 1) {
        onSettled?.(unwrap<BetDTO | null>(r, null));
        onClose();
      } else {
        setError(r.data?.message || 'Não foi possível liquidar.');
      }
    } catch {
      setError('Erro ao liquidar a aposta.');
    } finally {
      setSaving(false);
    }
  };

  const quickAll = (status: LegStatusValue) => setState((prev) => prev.map((s) => ({ ...s, status })));

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <h2 className="text-lg font-bold text-white pr-8">Liquidar aposta</h2>
        <p className="text-xs text-gray-400 mt-0.5">{bet.home} {bet.away ? `x ${bet.away}` : ''}</p>

        <div className="mt-3 flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">Marcar todas:</span>
          <button onClick={() => quickAll('won')} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25">Ganhas</button>
          <button onClick={() => quickAll('lost')} className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25">Perdidas</button>
          <button onClick={() => quickAll('void')} className="px-2 py-0.5 rounded bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30 hover:bg-zinc-500/25">Anuladas</button>
        </div>

        <div className="mt-3 space-y-2">
          {bet.legs.map((l) => {
            const s = state.find((x) => x.legId === l.id)!;
            const pnl = legPnlPreview(s.status, l.stake, l.odd, l.commissionPct || 0, parseFloat(s.settledReturn.replace(',', '.')) || 0, l.isFreebet);
            return (
              <div key={l.id} className={`rounded-xl p-2.5 ring-1 ${l.isFreebet ? 'bg-amber-500/[0.06] ring-amber-500/30' : 'bg-white/5 ring-white/10'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <BookmakerTag slug={l.bookmakerSlug} size={15} nameClassName="text-sm" />
                    {l.isFreebet && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-full px-1.5 py-0.5">FB</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{BRL(l.stake)} @ {l.odd.toFixed(2)}</span>
                </div>
                {l.selection && <div className="mt-0.5 text-[11px] text-gray-500 truncate">{l.selection}{l.handicap ? ` (${l.handicap})` : ''}</div>}
                <div className="mt-2 flex items-center gap-2">
                  <Select className="flex-1" value={s.status} onChange={(v) => setLeg(l.id, { status: v as LegStatusValue })}
                    buttonClassName="bg-black/20 py-1.5" options={LEG_STATUS_OPTIONS} />
                  {s.status === 'cashout' && (
                    <input value={s.settledReturn} onChange={(e) => setLeg(l.id, { settledReturn: e.target.value })} placeholder="Retorno R$" inputMode="decimal"
                      className="w-28 bg-white/5 ring-1 ring-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-teal-500/50" />
                  )}
                  <span className={`w-24 text-right text-sm font-semibold tabular-nums ${profitColor(pnl)}`}>{signedBRL(pnl)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-white/5 ring-1 ring-white/10 p-3 flex items-center justify-between">
          <span className="text-sm text-gray-300">Lucro realizado</span>
          <span className={`text-lg font-bold tabular-nums ${profitColor(realized)}`}>{signedBRL(realized)}</span>
        </div>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar liquidação
          </button>
        </div>
      </div>
    </div>
  );
}
