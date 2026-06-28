import React, { useMemo, useState } from 'react';
import { X, Loader2, Check, Clock, CheckCircle2, XCircle, RotateCcw, ArrowUpCircle, ArrowDownCircle, DollarSign } from 'lucide-react';
import { apiGateway, BetDTO, LegStatusValue, SettleLegInput } from '@/gateways/api.gateway';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { BRL, signedBRL, profitColor, fmtGameDateTime, unwrap } from './format';

interface Props {
  bet: BetDTO;
  onClose: () => void;
  onSettled?: (bet: BetDTO | null) => void;
  // Quando informado, liquida apenas ESTA perna (aposta individual da lista).
  legId?: string;
}

interface LegState { legId: string; status: LegStatusValue; settledReturn: string }

/** P&L de uma perna no cliente (espelha analytix.service.legPnl). */
const legPnlPreview = (status: LegStatusValue, stake: number, odd: number, comm: number, settledReturn: number, isFreebet = false, side: 'back' | 'lay' = 'back'): number => {
  const c = (comm || 0) / 100;
  if (side === 'lay') {
    const liability = stake * (odd - 1);
    switch (status) {
      case 'won': return stake * (1 - c);
      case 'half_won': return (stake * (1 - c)) / 2;
      case 'lost': return -liability;
      case 'half_lost': return -liability / 2;
      case 'cashout': return (settledReturn || 0) - liability;
      default: return 0;
    }
  }
  switch (status) {
    case 'won': return stake * (odd - 1) * (1 - c);
    case 'half_won': return (stake / 2) * (odd - 1) * (1 - c);
    case 'lost': return isFreebet ? 0 : -stake;
    case 'half_lost': return isFreebet ? 0 : -stake / 2;
    case 'cashout': return (settledReturn || 0) - (isFreebet ? 0 : stake);
    default: return 0;
  }
};

// Cards de status (grade com ícone) — substitui o <select>.
const STATUS_CARDS: { value: LegStatusValue; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'pending', label: 'Pendente', icon: Clock },
  { value: 'won', label: 'Ganha', icon: CheckCircle2 },
  { value: 'lost', label: 'Perdida', icon: XCircle },
  { value: 'void', label: 'Anulada', icon: RotateCcw },
  { value: 'half_won', label: 'Meio ganha', icon: ArrowUpCircle },
  { value: 'half_lost', label: 'Meio perdida', icon: ArrowDownCircle },
  { value: 'cashout', label: 'Cashout', icon: DollarSign },
];

function StatusGrid({ value, onChange }: { value: LegStatusValue; onChange: (v: LegStatusValue) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {STATUS_CARDS.map((s) => {
        const active = value === s.value;
        const Icon = s.icon;
        return (
          <button key={s.value} type="button" onClick={() => onChange(s.value)}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm ring-1 transition ${active ? 'bg-teal-500/15 text-teal-100 ring-teal-500/50' : 'bg-black/20 text-gray-300 ring-white/10 hover:bg-white/5'}`}>
            <span className="flex items-center gap-2 min-w-0">
              <span className={`grid place-items-center h-3.5 w-3.5 rounded-full ring-1 shrink-0 ${active ? 'bg-teal-400 ring-teal-400' : 'ring-white/30'}`}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
              </span>
              <span className="truncate">{s.label}</span>
            </span>
            <Icon size={15} className={active ? 'text-teal-300' : 'text-gray-500'} />
          </button>
        );
      })}
    </div>
  );
}

/** Modal de liquidação: status por perna (grade de cards); recalcula o lucro realizado. */
export default function SettleBetModal({ bet, onClose, onSettled, legId }: Props) {
  // Pernas em escopo: 1 (aposta individual) ou todas (compatibilidade).
  const legs = useMemo(() => (legId ? bet.legs.filter((l) => l.id === legId) : bet.legs), [bet.legs, legId]);
  const single = legs.length === 1;

  const [state, setState] = useState<LegState[]>(() =>
    legs.map((l) => ({ legId: l.id, status: l.status, settledReturn: l.settledReturn != null ? String(l.settledReturn) : '' })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setLeg = (id: string, patch: Partial<LegState>) =>
    setState((prev) => prev.map((s) => (s.legId === id ? { ...s, ...patch } : s)));

  const realized = useMemo(() => {
    return legs.reduce((acc, l) => {
      const s = state.find((x) => x.legId === l.id);
      if (!s) return acc;
      return acc + legPnlPreview(s.status, l.stake, l.odd, l.commissionPct || 0, parseFloat(s.settledReturn.replace(',', '.')) || 0, l.isFreebet, l.side);
    }, 0);
  }, [state, legs]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: SettleLegInput[] = state.map((s) => ({
        legId: s.legId,
        status: s.status,
        settledReturn: s.status === 'cashout' ? (parseFloat(s.settledReturn.replace(',', '.')) || 0) : undefined,
      }));
      const r = await apiGateway.settleBet(bet.id, payload);
      if (r.data?.result === 1) { onSettled?.(unwrap<BetDTO | null>(r, null)); onClose(); }
      else setError(r.data?.message || 'Não foi possível liquidar.');
    } catch {
      setError('Erro ao liquidar a aposta.');
    } finally {
      setSaving(false);
    }
  };

  const quickAll = (status: LegStatusValue) => setState((prev) => prev.map((s) => ({ ...s, status })));

  const game = fmtGameDateTime(bet.eventStart);
  const ctx = [bet.sport, bet.league].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <h2 className="text-lg font-bold text-white pr-8">{single ? 'Liquidar aposta' : 'Liquidar surebet'}</h2>
        <p className="text-sm text-gray-300 mt-0.5">{bet.home}{bet.away ? <span className="text-gray-500"> x {bet.away}</span> : ''}</p>
        {(ctx || game) && (
          <p className="text-[11px] text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            {ctx && <span>{ctx}</span>}
            {ctx && game && <span>·</span>}
            {game && <span className="inline-flex items-center gap-1 text-teal-300/90"><Clock size={11} /> {game}</span>}
          </p>
        )}

        {!single && (
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className="text-gray-500">Marcar todas:</span>
            <button onClick={() => quickAll('won')} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25">Ganhas</button>
            <button onClick={() => quickAll('lost')} className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/25">Perdidas</button>
            <button onClick={() => quickAll('void')} className="px-2 py-0.5 rounded bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30 hover:bg-zinc-500/25">Anuladas</button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {legs.map((l) => {
            const s = state.find((x) => x.legId === l.id)!;
            const pnl = legPnlPreview(s.status, l.stake, l.odd, l.commissionPct || 0, parseFloat(s.settledReturn.replace(',', '.')) || 0, l.isFreebet, l.side);
            return (
              <div key={l.id} className={`rounded-xl p-3 ring-1 ${l.isFreebet ? 'bg-amber-500/[0.06] ring-amber-500/30' : 'bg-white/5 ring-white/10'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <BookmakerTag slug={l.bookmakerSlug} size={15} nameClassName="text-sm" />
                    {l.side === 'lay' && <span className="inline-flex items-center text-[10px] text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/30 rounded-full px-1.5 py-0.5">LAY</span>}
                    {l.isFreebet && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-full px-1.5 py-0.5">FB</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{BRL(l.stake)} @ {l.odd.toFixed(2)}</span>
                </div>
                {l.selection && <div className="mt-0.5 text-[11px] text-gray-500 truncate">{l.selection}{l.handicap ? ` (${l.handicap})` : ''}</div>}

                <div className="mt-2"><StatusGrid value={s.status} onChange={(v) => setLeg(l.id, { status: v })} /></div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  {s.status === 'cashout' ? (
                    <input value={s.settledReturn} onChange={(e) => setLeg(l.id, { settledReturn: e.target.value })} placeholder="Retorno recebido R$" inputMode="decimal"
                      className="w-40 bg-black/20 ring-1 ring-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-teal-500/40" />
                  ) : <span className="text-[11px] text-gray-500">Resultado da perna</span>}
                  <span className={`text-sm font-semibold tabular-nums ${profitColor(pnl)}`}>{signedBRL(pnl)}</span>
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
