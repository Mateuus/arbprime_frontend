import React from 'react';
import { CheckCircle2, Trash2, Eye } from 'lucide-react';
import { BetDTO } from '@/gateways/api.gateway';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BRL, signedBRL, profitColor, fmtDateShort } from './format';
import StatusBadge from './StatusBadge';

interface Props {
  bets: BetDTO[];
  onSettle: (bet: BetDTO) => void;
  onDelete: (bet: BetDTO) => void;
  onView?: (bet: BetDTO) => void;
}

function LegLogos({ bet }: { bet: BetDTO }) {
  const { getBookmaker } = useBookmakers();
  return (
    <span className="inline-flex items-center -space-x-1">
      {bet.legs.slice(0, 4).map((l, i) => {
        const b = getBookmaker(l.bookmakerSlug);
        return <BookmakerLogo key={i} name={b?.name || l.bookmakerSlug} slug={l.bookmakerSlug} logoUrl={b?.logoUrl} color={b?.color} size={18} className="ring-1 ring-brand-dark" />;
      })}
      {bet.legs.length > 4 && <span className="text-[10px] text-gray-500 pl-2">+{bet.legs.length - 4}</span>}
    </span>
  );
}

/** Tabela de apostas (desktop) + lista de cards (mobile). */
export default function BetsTable({ bets, onSettle, onDelete, onView }: Props) {
  const canSettle = (b: BetDTO) => b.status === 'open' || b.status === 'partially_settled';

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-500 bg-white/5">
              <th className="text-left font-medium px-3 py-2.5">Data</th>
              <th className="text-left font-medium px-3 py-2.5">Evento</th>
              <th className="text-left font-medium px-3 py-2.5">Casas</th>
              <th className="text-right font-medium px-3 py-2.5">Stake</th>
              <th className="text-center font-medium px-3 py-2.5">Status</th>
              <th className="text-right font-medium px-3 py-2.5">Lucro</th>
              <th className="text-right font-medium px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bets.map((b) => (
              <tr key={b.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{fmtDateShort(b.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="text-white truncate max-w-[220px]">
                    {b.home || '—'}{b.away ? <span className="text-gray-500"> x {b.away}</span> : ''}
                    {b.legs.some((l) => l.isFreebet) && <span className="ml-1.5 inline-flex items-center text-[9px] font-bold text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded px-1 py-0.5 align-middle">FB</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate max-w-[200px]">{[b.sport, b.league].filter(Boolean).join(' · ') || (b.betType === 'arb' ? 'Surebet' : 'Single')}</div>
                </td>
                <td className="px-3 py-2.5"><LegLogos bet={b} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-200">{BRL(b.totalStake)}</td>
                <td className="px-3 py-2.5 text-center"><StatusBadge status={b.status} /></td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${b.realizedProfit == null ? 'text-gray-500' : profitColor(b.realizedProfit)}`}>
                  {b.realizedProfit == null ? '—' : signedBRL(b.realizedProfit)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {canSettle(b) && (
                      <button onClick={() => onSettle(b)} title="Liquidar" className="p-1.5 rounded-lg text-emerald-300 hover:bg-emerald-500/15"><CheckCircle2 size={16} /></button>
                    )}
                    {onView && <button onClick={() => onView(b)} title="Detalhes" className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10"><Eye size={16} /></button>}
                    <button onClick={() => onDelete(b)} title="Excluir" className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {bets.map((b) => (
          <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{b.home || '—'}{b.away ? <span className="text-gray-500"> x {b.away}</span> : ''}</div>
                <div className="text-[11px] text-gray-500">{fmtDateShort(b.createdAt)} · {[b.sport, b.league].filter(Boolean).join(' · ') || (b.betType === 'arb' ? 'Surebet' : 'Single')}</div>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <LegLogos bet={b} />
              <div className="text-right">
                <div className="text-[11px] text-gray-500">Stake {BRL(b.totalStake)}</div>
                <div className={`text-sm font-semibold tabular-nums ${b.realizedProfit == null ? 'text-gray-500' : profitColor(b.realizedProfit)}`}>
                  {b.realizedProfit == null ? '—' : signedBRL(b.realizedProfit)}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              {canSettle(b) && <button onClick={() => onSettle(b)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs ring-1 ring-emerald-500/30"><CheckCircle2 size={14} /> Liquidar</button>}
              <button onClick={() => onDelete(b)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
