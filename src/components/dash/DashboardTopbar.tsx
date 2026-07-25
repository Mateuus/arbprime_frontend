import { useRouter } from 'next/router';
import Link from 'next/link';
import { Menu, PanelLeft, ExternalLink, User as IconUser, ChevronRight } from 'lucide-react';
import { useDashboardLayout } from './DashboardLayoutContext';
import { dashCrumbFor } from '@/utils/dashboard.menu.config';

export default function DashboardTopbar() {
  const router = useRouter();
  const { isLg, toggleCollapsed, toggleMobile } = useDashboardLayout();
  const crumb = dashCrumbFor(router.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-[var(--ds-header-h)] items-center gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-4">
      <button
        type="button"
        aria-label={isLg ? 'Recolher menu' : 'Abrir menu'}
        onClick={() => (isLg ? toggleCollapsed() : toggleMobile())}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-muted transition-colors hover:bg-surface2 hover:text-fg"
      >
        {isLg ? <PanelLeft size={18} /> : <Menu size={18} />}
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link href="/admin/dashboard" className="shrink-0 text-fg-faint hover:text-fg">
          Painel
        </Link>
        {crumb && crumb.label !== 'Painel' && (
          <>
            <ChevronRight size={14} className="shrink-0 text-fg-faint" />
            <span className="hidden shrink-0 text-fg-faint sm:inline">{crumb.section}</span>
            <ChevronRight size={14} className="hidden shrink-0 text-fg-faint sm:inline" />
            <span className="truncate font-medium text-fg">{crumb.label}</span>
          </>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/"
          className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:bg-surface2 hover:text-fg sm:flex"
        >
          <ExternalLink size={14} /> Voltar ao site
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface2 text-fg-muted">
          <IconUser size={18} />
        </div>
      </div>
    </header>
  );
}
