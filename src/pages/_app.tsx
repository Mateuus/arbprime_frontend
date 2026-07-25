import type { AppProps } from 'next/app';
import type { NextPage } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import NProgress from 'nprogress';
import '@/styles/globals.css';
import { UserProvider } from "@/context/UserContext";
import { useWebSocketClient } from '@/hooks/useWebSocketClient';
import { serverManager } from '@/services/serverManager';
import AuthModal from "@/components/modals/AuthModal";
import UnifiedUserModal from "@/components/modals/UnifiedUserModal";
import SiteLayout from "@/components/layout/SiteLayout";
import DashboardLayout from "@/components/dash/DashboardLayout";

// Cada página pode declarar `Page.getLayout` para escolher seu próprio shell.
// Sem isso, cai no SiteLayout (sidebar+navbar do site). As páginas do Dashboard
// admin declaram getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>.
export type NextPageWithLayout<P = Record<string, unknown>> = NextPage<P> & {
  getLayout?: (page: ReactElement) => ReactNode;
};
type AppPropsWithLayout = AppProps & { Component: NextPageWithLayout };

export default function ArbCrypto({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  // Resolve o melhor servidor (ping) e liga o monitor de failover já no boot,
  // antes das primeiras requisições REST/WS.
  serverManager.init();
  useWebSocketClient();

  useEffect(() => {
    const { referralCode } = router.query;

    //Salvar Referencial Code, para não ser alterado o usuario tentar apagar etc...
    if (typeof referralCode === 'string') {
      // Salva no localStorage
      localStorage.setItem('referralCode', referralCode);
    }

    const handleStart = () => NProgress.start();
    const handleStop = () => NProgress.done();

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleStop);
    router.events.on('routeChangeError', handleStop);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleStop);
      router.events.off('routeChangeError', handleStop);
    };
  }, [router]);

  // Rotas sem layout (sem sidebar/navbar). Os players do PrimeTV e do
  // PrimeRádio abrem em popup e devem ocupar a janela inteira, sem
  // header/menu — a popup é só o player.
  // ⚠️ IMPORTANTE: continuam com early-return FORA do UserProvider (bare) —
  // não devem disparar getUserInfo() nem montar os modais globais.
  const noLayoutRoutes = ['/arbcrypto/calculator', '/tv/[id]', '/radio/[id]'];
  if (noLayoutRoutes.includes(router.pathname)) {
    return <Component {...pageProps} />;
  }

  // Layout: a página pode declarar getLayout; senão, todo /admin/* usa o
  // DashboardLayout (console admin) e o resto usa o SiteLayout. Assim as 20
  // telas de admin ganham o shell sem edição arquivo-a-arquivo.
  const isAdminRoute = router.pathname === '/admin' || router.pathname.startsWith('/admin/');
  const defaultLayout = isAdminRoute
    ? (page: ReactElement) => <DashboardLayout>{page}</DashboardLayout>
    : (page: ReactElement) => <SiteLayout>{page}</SiteLayout>;
  const getLayout = Component.getLayout ?? defaultLayout;

  return (
    <UserProvider>
      <AuthModal />
      <UnifiedUserModal />
      {getLayout(<Component {...pageProps} />)}
    </UserProvider>
  );
}
