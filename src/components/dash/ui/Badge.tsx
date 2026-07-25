import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

// Cada variante usa os slots semânticos do papel (bg/text/border) via arbitrary
// value das vars .dashboard — assim brand≠danger e nada depende de cor bruta.
const V: Record<BadgeVariant, string> = {
  neutral: 'bg-surface2 text-fg-muted ring-line',
  brand: 'bg-[var(--ds-brand-bg)] text-[var(--ds-brand-text)] ring-[var(--ds-brand-border)]',
  success: 'bg-[var(--ds-success-bg)] text-[var(--ds-success-text)] ring-[var(--ds-success-border)]',
  warning: 'bg-[var(--ds-warning-bg)] text-[var(--ds-warning-text)] ring-[var(--ds-warning-border)]',
  danger: 'bg-[var(--ds-danger-bg)] text-[var(--ds-danger-text)] ring-[var(--ds-danger-border)]',
  info: 'bg-[var(--ds-info-bg)] text-[var(--ds-info-text)] ring-[var(--ds-info-border)]',
};

export default function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${V[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
