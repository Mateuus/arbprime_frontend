import type { ReactNode } from 'react';

type Padding = 'none' | 'sm' | 'md';

const PAD: Record<Padding, string> = { none: '', sm: 'p-4', md: 'p-6' };

/** Superfície base do dashboard (card). Consome só tokens (.dashboard). */
export default function Card({
  children,
  className = '',
  padding = 'md',
}: {
  children: ReactNode;
  className?: string;
  padding?: Padding;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface shadow-sm ${PAD[padding]} ${className}`}>
      {children}
    </div>
  );
}
