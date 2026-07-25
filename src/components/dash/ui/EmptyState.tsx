import type { ReactNode } from 'react';

/**
 * Placeholder vazio. Distinga "sem dados" (first-run) de "sem resultado para o
 * filtro" pela cópia que você passar.
 */
export default function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface2/40 px-6 py-16 text-center">
      {icon && <div className="text-fg-faint">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {description != null && <div className="max-w-md text-sm text-fg-muted">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
