import { Inter } from 'next/font/google';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { can } from '@/utils/adminAccess';
import { DashboardLayoutProvider, useDashboardLayout } from './DashboardLayoutContext';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar from './DashboardTopbar';
import DashboardBackdrop from './DashboardBackdrop';

const inter = Inter({ subsets: ['latin'] });

const EXPANDED = 'var(--ds-sidebar-expanded)';
const COLLAPSED = 'var(--ds-sidebar-collapsed)';

function BootScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--ds-bg))] text-fg-muted">
      <div className="flex items-center gap-3 text-sm">
        <Loader2 size={18} className="animate-spin" />
        {label}
      </div>
    </div>
  );
}

/** Shell visual (assume que o guard já liberou). */
function Shell({ children }: { children: React.ReactNode }) {
  const { wide, isLg, mobileOpen } = useDashboardLayout();
  const asideWidth = isLg ? (wide ? EXPANDED : COLLAPSED) : EXPANDED;
  const contentMargin = isLg ? (wide ? EXPANDED : COLLAPSED) : '0px';

  return (
    <>
      <DashboardBackdrop />
      {/* Sidebar — ÚNICO elemento que usa transform (off-canvas no mobile).
          Nunca pôr transform num ancestral do conteúdo: quebraria o position:fixed
          dos popovers (usePopover). */}
      <aside
        className={[
          'fixed left-0 top-0 z-50 h-screen border-r border-line',
          'transition-[width,transform] duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
        style={{ width: asideWidth }}
      >
        <DashboardSidebar />
      </aside>

      {/* Coluna de conteúdo — margem (não transform) acompanha o sidebar. */}
      <div
        className="flex min-h-screen flex-col transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: contentMargin }}
      >
        <DashboardTopbar />
        <main className="flex-1 overflow-x-hidden">
          <div className="w-full px-3 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </>
  );
}

/** Guard + shell. Providers globais (UserProvider/modais/WS) vivem no _app. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useUserContext();
  const router = useRouter();
  const allowed = isAuthenticated && can(user, '*');
  // "Já teve acesso ao console" — permite manter o shell durante um flip
  // transitório de sessão (502 momentâneo do backend) sem expulsar o admin.
  const [everAllowed, setEverAllowed] = useState(false);
  useEffect(() => {
    if (allowed) setEverAllowed(true);
  }, [allowed]);

  // Reconexão transitória: já foi admin, sessão caiu momentaneamente.
  const reconnecting = everAllowed && !allowed && !isLoading;

  useEffect(() => {
    if (isLoading) return; // espera hidratar
    // Autenticado mas SEM acesso ao console → volta pro site.
    if (isAuthenticated && !can(user, '*')) {
      router.replace('/');
      return;
    }
    // Deslogado E nunca teve acesso → login. (Se já teve acesso, é flip
    // transitório: não redireciona, mostra banner de reconexão.)
    if (!isAuthenticated && !everAllowed) {
      router.replace('/?modal=login');
    }
  }, [isLoading, isAuthenticated, everAllowed, user, router]);

  const showShell = allowed || reconnecting;

  return (
    <div className={`dashboard min-h-screen ${inter.className}`}>
      <Head>
        <title>Painel · ArbPrime</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {isLoading ? (
        <BootScreen label="Carregando…" />
      ) : !showShell ? (
        <BootScreen label="Redirecionando…" />
      ) : (
        <DashboardLayoutProvider>
          {/* Banner de reconexão: revalidação falhou depois de já ter logado.
              NUNCA expulsamos o admin no meio de uma edição. */}
          {reconnecting && (
            <div className="bg-[var(--ds-warning-bg)] px-4 py-1.5 text-center text-xs text-[var(--ds-warning-text)]">
              Reconectando à sessão…
            </div>
          )}
          <Shell>{children}</Shell>
        </DashboardLayoutProvider>
      )}
    </div>
  );
}
