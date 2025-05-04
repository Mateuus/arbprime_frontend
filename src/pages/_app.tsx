import { Inter } from "next/font/google";
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import NProgress from 'nprogress';
import '@/styles/globals.css';
import { UserProvider } from "@/context/UserContext";
import Sidebar from "@/components/SideBar";
//import MobileMenu from '@/components/MobileMenu';
import { useWebSocketClient } from '@/hooks/useWebSocketClient';
import Navbar from "@/components/NavBar";
import AuthModal from "@/components/modals/AuthModal";
import MobileTabMenu from "@/components/Mobile/MobileTabMenu";

const inter = Inter({ subsets: ["latin"] });

export default function ArbCrypto({ Component, pageProps }: AppProps) {
  const router = useRouter();
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

  // Rotas sem layout
  const noLayoutRoutes = ['/arbcrypto/calculator'];

  if (noLayoutRoutes.includes(router.pathname)) {
    return <Component {...pageProps} />;
  }
  return (
    <UserProvider>
      <AuthModal />
      <div className={`flex min-h-screen ${inter.className}`}>
        <Head>
          <meta name="description" content="ArbPrime!" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <title>ArbPrime</title>
        </Head>

        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col bg-brand-dark">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            <Component {...pageProps} />
          </main>
          <MobileTabMenu />
        </div>
      </div>
    </UserProvider>
  );
}