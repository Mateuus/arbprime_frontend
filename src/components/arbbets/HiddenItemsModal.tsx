import { HiddenItemDTO } from '@/gateways/api.gateway';
import { HideType } from '@/hooks/useHiddenSet';
import { X, EyeOff, Eye, CalendarX, Store, Tag, Trash2 } from 'lucide-react';

const TYPE_META: Record<HideType, { label: string; icon: React.ReactNode }> = {
  event: { label: 'Eventos ocultados', icon: <CalendarX size={14} className="text-rose-300" /> },
  house: { label: 'Casas ocultadas (no evento)', icon: <Store size={14} className="text-amber-300" /> },
  selection: { label: 'Odds/seleções ocultadas', icon: <Tag size={14} className="text-violet-300" /> },
};
const ORDER: HideType[] = ['event', 'house', 'selection'];

/**
 * Painel onde o usuário vê tudo o que ocultou (evento, casa ou odd) e pode
 * REEXIBIR item a item, ou tudo de uma vez.
 */
const HiddenItemsModal = ({ items, onUnhide, onClearAll, onClose }: {
  items: HiddenItemDTO[];
  onUnhide: (type: HideType, itemKey: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}) => {
  const groups = ORDER.map((type) => ({ type, list: items.filter((i) => i.type === type) })).filter((g) => g.list.length > 0);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <div className="flex items-center gap-2 mb-1">
          <EyeOff className="text-teal-300" size={18} />
          <h2 className="text-base font-bold text-white">Itens ocultados</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">O que você ocultou não aparece na sua lista de surebets. Reexiba quando quiser.</p>

        {items.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            <Eye className="mx-auto mb-2 text-gray-600" size={28} />
            Nada ocultado. Use o menu (⋮) numa surebet para ocultar uma odd, casa ou evento.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.type}>
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">
                    {TYPE_META[g.type].icon} {TYPE_META[g.type].label} ({g.list.length})
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                    {g.list.map((it) => (
                      <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-gray-200 truncate">{it.label || it.itemKey}</div>
                          {it.label && <div className="text-[10px] text-gray-600 font-mono truncate">{it.itemKey}</div>}
                        </div>
                        <button
                          onClick={() => onUnhide(it.type, it.itemKey)}
                          className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-teal-500/15 ring-1 ring-teal-500/30 text-teal-200 hover:bg-teal-500/25 inline-flex items-center gap-1.5"
                        >
                          <Eye size={13} /> Reexibir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={onClearAll} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-300 hover:bg-white/10 inline-flex items-center gap-1.5">
                <Trash2 size={13} /> Reexibir tudo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HiddenItemsModal;
