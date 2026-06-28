import React from 'react';
import { BetDTO } from '@/gateways/api.gateway';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BRL, signedBRL, profitColor, fmtDateShort } from './format';
import LegStatusBadge from './LegStatusBadge';

/**
 * Lista COMPACTA de apostas (preview do Painel). Read-only e sem rolagem
 * horizontal — a tabela completa (com ações) fica na página /analytix/apostas.
 * Uma linha por perna (aposta individual), igual à lista principal.
 */
export default function RecentBetsList({ bets }: { bets: BetDTO[] }) {
  const { getBookmaker } = useBookmakers();
  const rows = bets.flatMap((b) => b.legs.map((leg) => ({ b, leg })));

  if (!rows.length) return <div className="py-8 text-center text-sm text-gray-500">Nenhuma aposta ainda.</div>;

  return (
    <div className="divide-y divide-white/5">
      {rows.map(({ b, leg }) => {
        const bk = getBookmaker(leg.bookmakerSlug);
        const multi = leg.selections && leg.selections.length;
        const opt = multi ? `Múltipla · ${leg.selections!.length} seleções` : (leg.selection || '—');
        return (
          <div key={leg.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate">
                {b.home || '—'}{b.away ? <span className="text-gray-500"> x {b.away}</span> : ''}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 min-w-0">
                <BookmakerLogo name={bk?.name || leg.bookmakerSlug} slug={leg.bookmakerSlug} logoUrl={bk?.logoUrl} color={bk?.color} size={13} className="shrink-0" />
                <span className="truncate" style={{ color: bk?.color || undefined }}>{bk?.name || leg.bookmakerSlug}</span>
                <span className="text-gray-600 shrink-0">·</span>
                <span className="truncate">{opt}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-gray-400 tabular-nums">{BRL(leg.stake)}</div>
              <div className="mt-0.5">
                {leg.legProfit == null
                  ? <LegStatusBadge status={leg.status} />
                  : <span className={`text-xs font-semibold tabular-nums ${profitColor(leg.legProfit)}`}>{signedBRL(leg.legProfit)}</span>}
              </div>
            </div>
            <div className="hidden sm:block text-[11px] text-gray-500 shrink-0 w-12 text-right">{fmtDateShort(b.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}
