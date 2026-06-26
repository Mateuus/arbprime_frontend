'use client';
import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface InfoModalProps {
  /** Título principal do modal. */
  title: string;
  /** Subtítulo opcional (linha de apoio abaixo do título). */
  subtitle?: string;
  /** Ícone opcional exibido à esquerda do título. */
  icon?: ReactNode;
  /** Conteúdo do modal. */
  children: ReactNode;
  onClose: () => void;
  /** Largura máxima (classe Tailwind). Padrão: max-w-2xl. */
  maxWidthClass?: string;
  /** Rodapé opcional fixo (ex.: botão de ação). */
  footer?: ReactNode;
}

/**
 * Modal de informação REUTILIZÁVEL: cabeçalho com título + subtítulo (+ ícone),
 * corpo rolável e rodapé opcional. Segue o padrão visual dos modais do app
 * (overlay com blur, bottom-sheet no mobile, card centralizado no desktop).
 * Fecha no ESC, no clique fora e no X.
 */
export function InfoModal({ title, subtitle, icon, children, onClose, maxWidthClass = 'max-w-2xl', footer }: InfoModalProps) {
  // Fecha no ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[92vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-brand-dark shadow-2xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="mx-auto mb-0 h-1 w-10 rounded-full bg-white/20 sm:hidden absolute left-1/2 -translate-x-1/2 top-2" />
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight text-white sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 transition hover:text-rose-400" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

        {/* Rodapé opcional */}
        {footer && <div className="border-t border-white/10 p-3 sm:p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default InfoModal;
