import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * Rótulo de campo com um "?" ao lado que abre um tooltip explicando o que é.
 * Use dentro de <label> antes do input, ou como cabeçalho de um campo.
 */
export default function HelpLabel({ children, help, className = '' }: { children: React.ReactNode; help: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      <Tooltip label={help}>
        <HelpCircle size={12} className="text-gray-500 hover:text-teal-300 cursor-help" />
      </Tooltip>
    </span>
  );
}
