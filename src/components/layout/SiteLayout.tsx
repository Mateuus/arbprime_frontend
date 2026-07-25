import { Inter } from 'next/font/google';
import Head from 'next/head';
import Sidebar from '@/components/SideBar';
import Navbar from '@/components/NavBar';
import MobileTabMenu from '@/components/Mobile/MobileTabMenu';

const inter = Inter({ subsets: ['latin'] });

// SEO / preview social (Open Graph). Usado por WhatsApp, Telegram, X, Facebook
// ao compartilhar o link do site. A imagem é gerada por scripts/og-image.mjs.
const SITE_URL = 'https://www.arbprime.pro';
const OG_IMAGE = `${SITE_URL}/og.png`;
const SEO_TITLE = 'ArbPrime — Lucro garantido com surebets';
const SEO_DESCRIPTION =
  'Encontre apostas com lucro garantido (surebets) e value bets nas casas brasileiras. Monitoramento ao vivo, alertas e calculadora — tudo nacional.';

/**
 * Layout PADRÃO do site (sidebar + navbar + main + tab-bar mobile).
 * Extraído do _app.tsx sem mudança de comportamento. É o `getLayout` default:
 * toda página que NÃO declara um `getLayout` próprio cai aqui.
 * O Dashboard admin usa o `DashboardLayout` no lugar deste.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex min-h-screen ${inter.className}`}>
      <Head>
        <title>{SEO_TITLE}</title>
        <meta name="description" content={SEO_DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#00191d" />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph (WhatsApp, Telegram, Facebook, LinkedIn) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ArbPrime" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:title" content={SEO_TITLE} />
        <meta property="og:description" content={SEO_DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:secure_url" content={OG_IMAGE} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="ArbPrime — arbitragem de apostas e cripto" />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_TITLE} />
        <meta name="twitter:description" content={SEO_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>

      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col bg-brand-dark min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <MobileTabMenu />
      </div>
    </div>
  );
}
