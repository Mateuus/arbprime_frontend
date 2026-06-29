'use client';
import { createPortal } from 'react-dom';
import { X, Trophy, Calendar } from 'lucide-react';
import { MiddleData, Middle } from '@/interfaces/middle.interface';
import { MiddleCard } from '@/components/middles/MiddleCard';
import { HideType } from '@/hooks/useHiddenSet';
import { fmtDateTime, fmtSigned, evTone } from '@/utils/middle';

/**
 * Modal "Por evento": mostra UM jogo no topo e, abaixo, todos os middles desse
 * evento (cards em modo hideEvent — sem repetir o cabeçalho do jogo). Mantém a
 * lista da página compacta (um card por evento) e abre o detalhe só quando o
 * usuário pede.
 */
export function MiddleEventModal({ event, list, onCalc, onClose, notify, onHide, isHidden }: {
  event: MiddleData;
  list: Middle[];
  onCalc: (event: MiddleData, m: Middle) => void;
  onClose: () => void;
  notify?: (text: string) => void;
  onHide?: (type: HideType, itemKey: string, label?: string, eventStartAt?: string | null) => void;
  isHidden?: (type: HideType, itemKey: string) => boolean;
}) {
  const bestEv = list.length ? Math.max(...list.map((x) => x.ev)) : 0;
  const dateLabel = fmtDateTime(event.date);

  const body = (
    <div className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-brand-dark shadow-2xl sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho fixo do evento */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="mr-2 min-w-0">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <div className="truncate text-base font-bold leading-tight text-white">
              {event.home} <span className="text-sm font-normal text-gray-500">×</span> {event.away}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
              {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={11} className="shrink-0 text-indigo-400/60" /> <span className="truncate">{event.league}</span></span>}
              {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Calendar size={11} /> {dateLabel}</span>}
              <span className="shrink-0 text-gray-500">· {list.length} middle{list.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-gray-500">Melhor EV</div>
              <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ring-1 ${evTone(bestEv)}`}>{fmtSigned(bestEv)}%</span>
            </div>
            <button onClick={onClose} className="text-gray-400 transition hover:text-rose-400" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de middles do evento */}
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {list.map((m) => (
              <MiddleCard key={m.id} event={event} m={m} onCalc={onCalc} notify={notify} hideEvent onHide={onHide} isHidden={isHidden} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}

export default MiddleEventModal;
