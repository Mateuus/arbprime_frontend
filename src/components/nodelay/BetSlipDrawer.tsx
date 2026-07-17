import { SlipView, BetSlipCard } from '@/components/nodelay/BetSlipCard';
import { X, Receipt, Loader2 } from 'lucide-react';

/**
 * Gaveta de bilhetes no rodapé — SEPARADA da lista de odds. Fica sobre o modal
 * de aposta rápida sem cobrir os favoritos, então dá para acompanhar os bilhetes
 * e disparar a próxima entrada sem fechar nada. Um bilhete por conta, lado a lado.
 */
export function BetSlipDrawer({ slips, onClose }: { slips: SlipView[]; onClose: () => void }) {
  const placing = slips.some((s) => s.status === 'placing');
  const ok = slips.filter((s) => s.result?.ok).length;
  const done = slips.filter((s) => s.status === 'done').length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[10000] border-t border-white/10 bg-brand-dark/95 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
        {/* Cabeçalho */}
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-500/15 ring-1 ring-lime-500/30">
            <Receipt size={14} className="text-lime-300" />
          </span>
          <span className="text-sm font-bold text-white">Bilhetes</span>
          {placing ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Loader2 size={11} className="animate-spin" /> {done}/{slips.length} enviados
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">
              <span className="font-semibold text-emerald-300">{ok}</span> de {slips.length} aceitas
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <X size={13} /> Fechar
          </button>
        </div>

        {/* Grid responsivo: quebra em linhas e rola na VERTICAL — nunca slider
            lateral no celular (1 col no estreito, mais colunas conforme a tela). */}
        <div className="grid max-h-[46dvh] grid-cols-1 gap-2 overflow-y-auto pb-1 min-[430px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {slips.map((s) => (
            <BetSlipCard key={s.key} slip={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
