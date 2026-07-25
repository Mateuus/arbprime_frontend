import { useRouter } from 'next/router';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { can } from '@/utils/adminAccess';
import { DASHBOARD_NAV } from '@/utils/dashboard.menu.config';
import { useDashboardLayout } from './DashboardLayoutContext';

export default function DashboardSidebar() {
  const router = useRouter();
  const { user } = useUserContext();
  const { wide, setHovered, closeMobile } = useDashboardLayout();

  const isActive = (path: string, match?: string) =>
    router.pathname === path || (match ? router.pathname.startsWith(match) : false);

  return (
    <div
      className="flex h-full flex-col bg-[rgb(var(--ds-sidebar))] text-fg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Marca */}
      <div className="flex h-[var(--ds-header-h)] shrink-0 items-center gap-2 border-b border-line px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-solid text-[#00191d]">
          <LayoutDashboard size={18} />
        </div>
        {wide && (
          <span className="truncate text-sm font-bold tracking-tight">
            <span className="text-fg">ARB</span>
            <span className="text-[var(--ds-brand-text)]">PRIME</span>
            <span className="ml-1 font-medium text-fg-faint">Painel</span>
          </span>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegação do painel">
        {DASHBOARD_NAV.map((sec) => {
          const items = sec.items.filter((it) => can(user, it.scope));
          if (!items.length) return null;
          return (
            <div key={sec.id} className="mb-4">
              {wide ? (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
                  {sec.label}
                </div>
              ) : (
                <div className="mx-2 mb-1 border-t border-line/60" />
              )}
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const active = isActive(it.path, it.match);
                  return (
                    <li key={it.id}>
                      <Link
                        href={it.path}
                        aria-label={it.name}
                        aria-current={active ? 'page' : undefined}
                        onClick={closeMobile}
                        className={[
                          'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
                          active
                            ? 'border-l-2 border-brand-solid bg-brand-solid/10 font-medium text-fg'
                            : 'text-fg-muted hover:bg-surface2 hover:text-fg',
                          wide ? '' : 'justify-center',
                        ].join(' ')}
                      >
                        <span className={active ? 'text-[var(--ds-brand-text)]' : ''}>{it.icon}</span>
                        {wide && <span className="truncate">{it.name}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Rodapé */}
      <div className="shrink-0 border-t border-line p-3">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-surface2 hover:text-fg"
        >
          <span aria-hidden>←</span>
          {wide && <span>Voltar ao site</span>}
        </Link>
      </div>
    </div>
  );
}
