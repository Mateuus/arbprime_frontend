import { Inter } from "next/font/google";
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import NProgress from 'nprogress';
import '@/styles/globals.css';
import { UserProvider } from "@/context/UserContext";
import NavBar from "@/components/NavBar";
import { useWebSocketClient } from '@/hooks/useWebSocketClient';

const inter = Inter({ subsets: ["latin"] });

export default function ArbCrypto({ Component, pageProps }: AppProps) {
  const router = useRouter();
  useWebSocketClient(); 

  useEffect(() => {
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
      <div className={`flex flex-col min-h-screen bg-zinc-900 ${inter.className}`}>
        <Head>
          <meta name="description" content="ArbPrime!" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" /> 
          <title>ArbPrime</title>
        </Head>
        <NavBar />
        <main className="flex-grow pt-16">
          <Component {...pageProps} />
        </main>
      </div>
    </UserProvider>
  );
}