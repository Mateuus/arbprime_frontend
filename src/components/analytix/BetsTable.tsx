import React from 'react';
import { Trash2, Eye, Clock, Gavel, Pencil, Layers } from 'lucide-react';
import { BetDTO, BetLegDTO, BookmakerDTO } from '@/gateways/api.gateway';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BRL, signedBRL, profitColor, fmtDateShort, fmtGameDateTime } from './format';
import LegStatusBadge from './LegStatusBadge';

interface Props {
  bets: BetDTO[];
  // Ações são por PERNA — cada perna é uma aposta individual na lista.
  onSettle: (bet: BetDTO, leg: BetLegDTO) => void;
  onDelete: (bet: BetDTO, leg: BetLegDTO) => void;
  onEdit?: (bet: BetDTO) => void;
  onView?: (bet: BetDTO) => void;
}

// "Opção" (pick) + "Mercado" de uma perna, para a coluna Mercado · Opção.
const legPick = (l: BetLegDTO) => ({
  sel: l.selection || '—',
  mkt: [l.rawMarket || l.market, l.handicap].filter(Boolean).join(' '),
});

const FreebetTag = () => (
  <span className="inline-flex items-center text-[9px] font-bold text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded px-1 py-0.5 align-middle">FB</span>
);

// Bloco do evento (mandante x visitante + data/hora do jogo + esporte·liga).
// Repetido em cada perna — cada aposta é uma linha individual.
function EventInline({ bet }: { bet: BetDTO }) {
  const game = fmtGameDateTime(bet.eventStart);
  const ctx = [bet.sport, bet.league].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      <div className="text-white truncate max-w-[220px]">
        {bet.home || '—'}{bet.away ? <span className="text-gray-500"> x {bet.away}</span> : ''}
      </div>
      {game ? (
        <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-teal-300/90"><Clock size={10} /> {game}</div>
      ) : (
        <div className="mt-0.5 text-[11px] text-gray-600">sem data do jogo</div>
      )}
      {ctx && <div className="text-[11px] text-gray-500 truncate max-w-[220px]">{ctx}</div>}
    </div>
  );
}

function HouseCell({ slug, bk }: { slug: string; bk?: BookmakerDTO }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <BookmakerLogo name={bk?.name || slug} slug={slug} logoUrl={bk?.logoUrl} color={bk?.color} size={18} className="ring-1 ring-brand-dark shrink-0" />
      {/* Nome na COR da casa (cai em cinza quando a casa não tem cor cadastrada). */}
      <span className="truncate max-w-[120px] font-medium text-gray-200" style={{ color: bk?.color || undefined }}>{bk?.name || slug}</span>
    </span>
  );
}

// Coluna "Mercado · Opção". Múltipla mostra a quebra das seleções + odd combinada.
function MarketCell({ leg }: { leg: BetLegDTO }) {
  if (leg.selections && leg.selections.length) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-white">
          <Layers size={12} className="text-teal-300 shrink-0" />
          <span className="truncate">Múltipla · {leg.selections.length} seleções</span>
          <span className="text-[11px] text-gray-400 tabular-nums">@ {leg.odd.toFixed(2)}</span>
        </div>
        <div className="mt-0.5 space-y-0.5">
          {leg.selections.map((s, i) => (
            <div key={i} className="text-[11px] text-gray-500 truncate max-w-[240px]">
              • {s.selection || '—'}{s.market ? ` · ${s.market}` : ''} <span className="text-gray-600 tabular-nums">@ {Number(s.odd).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const { sel, mkt } = legPick(leg);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-gray-200 max-w-[200px]">
        {leg.side === 'lay' && <span className="text-[9px] font-bold text-orange-300 bg-orange-500/10 ring-1 ring-orange-500/30 rounded px-1 py-0.5 shrink-0">LAY</span>}
        <span className="truncate">{sel}</span>
      </div>
      {mkt && <div className="text-[11px] text-gray-500 truncate max-w-[200px]">{mkt}</div>}
    </div>
  );
}

function LegProfit({ leg }: { leg: BetLegDTO }) {
  return (
    <span className={`tabular-nums font-semibold ${leg.legProfit == null ? 'text-gray-500' : profitColor(leg.legProfit)}`}>
      {leg.legProfit == null ? '—' : signedBRL(leg.legProfit)}
    </span>
  );
}

function RowActions({ bet, leg, onSettle, onDelete, onEdit, onView }: { bet: BetDTO; leg: BetLegDTO } & Pick<Props, 'onSettle' | 'onDelete' | 'onEdit' | 'onView'>) {
  const resolved = leg.status !== 'pending';
  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Definir resultado: rótulo "Liquidar" quando pendente; já resolvida vira só
          o ícone (alterar resultado). Nunca o check verde que parecia "ganhou". */}
      {resolved ? (
        <Tooltip label="Alterar resultado">
          <button onClick={() => onSettle(bet, leg)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-200 hover:bg-white/10 transition"><Gavel size={15} /></button>
        </Tooltip>
      ) : (
        <Tooltip label="Liquidar (definir o resultado da aposta)">
          <button onClick={() => onSettle(bet, leg)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-teal-200 bg-teal-500/10 ring-1 ring-teal-500/25 hover:bg-teal-500/20 transition">
            <Gavel size={13} /> <span className="hidden lg:inline">Liquidar</span>
          </button>
        </Tooltip>
      )}
      {onEdit && (
        <Tooltip label="Editar aposta (casa, odd, stake, seleção...)">
          <button onClick={() => onEdit(bet)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/10 transition"><Pencil size={15} /></button>
        </Tooltip>
      )}
      {onView && (
        <Tooltip label="Detalhes">
          <button onClick={() => onView(bet)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/10 transition"><Eye size={15} /></button>
        </Tooltip>
      )}
      <Tooltip label="Excluir esta aposta">
        <button onClick={() => onDelete(bet, leg)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 transition"><Trash2 size={15} /></button>
      </Tooltip>
    </div>
  );
}

/**
 * Tabela de apostas — cada PERNA é uma aposta INDIVIDUAL (uma linha própria),
 * com data/evento repetidos. Status, lucro e ações (liquidar/excluir) são por
 * perna. As pernas de uma mesma surebet ficam só naturalmente próximas (mesma
 * data/evento), sem agrupamento.
 */
export default function BetsTable({ bets, onSettle, onDelete, onEdit, onView }: Props) {
  const { getBookmaker } = useBookmakers();
  // Achata: uma entrada por perna, preservando a aposta de origem.
  const rows = bets.flatMap((bet) => bet.legs.map((leg) => ({ bet, leg })));

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-500 bg-white/5">
              <th className="text-left font-medium px-3 py-2.5">Data</th>
              <th className="text-left font-medium px-3 py-2.5">Evento</th>
              <th className="text-left font-medium px-3 py-2.5">Casa</th>
              <th className="text-left font-medium px-3 py-2.5">Mercado · Opção</th>
              <th className="text-right font-medium px-3 py-2.5">Stake</th>
              <th className="text-center font-medium px-3 py-2.5">Status</th>
              <th className="text-right font-medium px-3 py-2.5">Lucro</th>
              <th className="text-right font-medium px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(({ bet, leg }) => (
              <tr key={leg.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 align-top text-gray-400 whitespace-nowrap">{fmtDateShort(bet.createdAt)}</td>
                <td className="px-3 py-2.5 align-top"><EventInline bet={bet} /></td>
                <td className="px-3 py-2.5 align-top"><HouseCell slug={leg.bookmakerSlug} bk={getBookmaker(leg.bookmakerSlug)} /></td>
                <td className="px-3 py-2.5 align-top"><MarketCell leg={leg} /></td>
                <td className="px-3 py-2.5 align-top text-right tabular-nums text-gray-200 whitespace-nowrap">
                  {BRL(leg.stake)}{leg.isFreebet && <span className="ml-1"><FreebetTag /></span>}
                </td>
                <td className="px-3 py-2.5 align-top text-center"><LegStatusBadge status={leg.status} /></td>
                <td className="px-3 py-2.5 align-top text-right whitespace-nowrap"><LegProfit leg={leg} /></td>
                <td className="px-3 py-2.5 align-top"><RowActions bet={bet} leg={leg} onSettle={onSettle} onDelete={onDelete} onEdit={onEdit} onView={onView} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — um card por perna (aposta individual) */}
      <div className="md:hidden space-y-2">
        {rows.map(({ bet, leg }) => (
          <div key={leg.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <EventInline bet={bet} />
              <LegStatusBadge status={leg.status} />
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <HouseCell slug={leg.bookmakerSlug} bk={getBookmaker(leg.bookmakerSlug)} />
                <div className="mt-0.5"><MarketCell leg={leg} /></div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] text-gray-400 tabular-nums">Stake {BRL(leg.stake)}{leg.isFreebet && <span className="ml-1"><FreebetTag /></span>}</div>
                <div className="mt-0.5 text-sm"><LegProfit leg={leg} /></div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-500">{fmtDateShort(bet.createdAt)}</span>
              <RowActions bet={bet} leg={leg} onSettle={onSettle} onDelete={onDelete} onEdit={onEdit} onView={onView} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
