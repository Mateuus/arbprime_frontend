import { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { InfoModal } from './InfoModal';

interface Props {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;     // estilo destrutivo (vermelho) p/ exclusões
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Modal de CONFIRMAÇÃO padrão do app (substitui o window.confirm nativo).
 * Reaproveita o InfoModal (overlay + bottom-sheet no mobile, ESC/clique-fora).
 */
export function ConfirmModal({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, loading = false, onConfirm, onClose }: Props) {
  return (
    <InfoModal
      title={title}
      maxWidthClass="max-w-md"
      icon={<div className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${danger ? 'bg-rose-500/15 ring-rose-500/30 text-rose-300' : 'bg-teal-500/15 ring-teal-500/30 text-teal-300'}`}><AlertTriangle size={18} /></div>}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 transition ${danger ? 'bg-rose-500 hover:bg-rose-400 text-white' : 'bg-teal-500 hover:bg-teal-400 text-slate-900'}`}>
            {loading && <Loader2 className="animate-spin" size={15} />} {confirmLabel}
          </button>
        </div>
      )}
    >
      {message && <div className="text-sm text-gray-300">{message}</div>}
    </InfoModal>
  );
}

export default ConfirmModal;
