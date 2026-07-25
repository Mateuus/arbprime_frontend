import type { ReactNode } from 'react';
import Link from 'next/link';

/** KPI card. Se `href`, o card inteiro vira link com hover. */
export default function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  hintTone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  icon?: ReactNode;
  hintTone?: 'default' | 'warning';
}) {
  const body = (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5 shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-faint">{label}</span>
        {icon && <span className="text-[var(--ds-brand-text)]">{icon}</span>}
      </div>
      <span className="text-2xl font-semibold tabular-nums text-fg">{value}</span>
      {hint != null && (
        <span className={`text-xs ${hintTone === 'warning' ? 'text-[var(--ds-warning-text)]' : 'text-fg-muted'}`}>
          {hint}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-solid)] hover:[&>div]:shadow-md">
        {body}
      </Link>
    );
  }
  return body;
}
