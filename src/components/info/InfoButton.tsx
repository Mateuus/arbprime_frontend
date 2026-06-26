'use client';
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { InfoTopicModal, InfoTopicKey } from '@/components/info/infoTopics';

interface InfoButtonProps {
  /** Qual tópico de INFO_TOPICS abrir. */
  topic: InfoTopicKey;
  /** Tamanho do ícone. */
  size?: number;
  /** Classes extras no botão. */
  className?: string;
  /** Texto acessível / tooltip nativo. */
  label?: string;
  /** 'icon' = só o "?"; 'pill' = "? Entenda" com borda. */
  variant?: 'icon' | 'pill';
  /** Rótulo do pill (default "Entenda"). */
  pillText?: string;
}

/**
 * Botão "?" REUTILIZÁVEL que abre o InfoTopicModal de um tópico. Gerencia o
 * próprio estado — basta soltar <InfoButton topic="clv" /> em qualquer lugar.
 */
export function InfoButton({
  topic,
  size = 16,
  className = '',
  label = 'Saiba mais',
  variant = 'icon',
  pillText = 'Entenda',
}: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        aria-label={label}
        title={label}
        className={
          variant === 'pill'
            ? `inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-400 transition hover:border-violet-500/30 hover:text-violet-200 ${className}`
            : `inline-grid place-items-center text-gray-500 transition hover:text-violet-300 ${className}`
        }
      >
        <HelpCircle size={size} />
        {variant === 'pill' && <span>{pillText}</span>}
      </button>
      {open && <InfoTopicModal topicKey={topic} onClose={() => setOpen(false)} />}
    </>
  );
}

export default InfoButton;
