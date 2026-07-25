import { useRouter } from 'next/router';
import { GiHomeGarage, GiSoccerBall } from 'react-icons/gi';
import { CalendarClock, LayoutDashboard, Users, Users2, Zap, Store, CreditCard, Activity, ListChecks, Wallet, Gem, LineChart, Split, Bot, Rocket, MonitorPlay, Layers, Radio, Handshake } from 'lucide-react';
import { useMemo } from 'react';
import { ReactNode } from 'react';
import { useUserContext } from '@/context/UserContext';

export interface MenuSubItem {
  id: string;
  name: string;
  path: string;
  icon?: ReactNode;
  onClick?: () => void;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  minLevel?: number; // nível de plano mínimo (ver MenuItem.minLevel)
}

export interface MenuItem {
  id: string;
  name: string;
  path?: string;
  icon: ReactNode;
  onClick?: () => void;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  affiliateOnly?: boolean; // só aparece para quem é afiliado
  // Nível de plano mínimo p/ ver o item (user.level, que vem do plano ativo).
  // Só ESCONDE o menu — quem protege o recurso é o backend (requireLevel).
  minLevel?: number;
  button?: boolean;
  header?: boolean; // rótulo de seção (não clicável), ex.: "OPORTUNIDADES"
  subItems?: MenuSubItem[];
}

// Menu do SITE (usuário). A administração NÃO mora mais aqui — foi para o
// Dashboard (src/utils/dashboard.menu.config.tsx), acessível pelo botão "Painel"
// na navbar. Isso é o que resolve o "admin gigante no sidebar do usuário".
export const useMenuItems = (): MenuItem[] => {
  const router = useRouter();
  const { isAuthenticated, user } = useUserContext();
  const isAdmin = user?.role === 'admin';
  const isAffiliate = !!user?.isAffiliate;
  // Nível do plano ativo (0 = sem plano). O backend o mantém sincronizado em
  // /user/info (resolveUserAccess), e o UserProvider repolla a cada 5min — ou
  // seja, um upgrade libera o item sem precisar relogar.
  const level = user?.level ?? 0;

  return useMemo(() => {
    const allItems: MenuItem[] = [
      // ===================== TOPO (sem header) =====================
      {
        id: 'home',
        name: 'Home',
        path: '/',
        icon: <GiHomeGarage size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/'),
      },
      {
        id: 'events',
        name: 'Eventos',
        path: '/events',
        icon: <GiSoccerBall size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/events'),
      },

      // ===================== OPORTUNIDADES =====================
      {
        id: 'sec-opportunities',
        name: 'Oportunidades',
        icon: null,
        header: true,
        requiresAuth: true,
      },
      {
        id: 'arbbets',
        name: 'Surebets',
        icon: <GiSoccerBall size={22} />,
        requiresAuth: true,
        subItems: [
          { id: 'prematch', name: 'Prematch', path: '/arbbets', icon: <CalendarClock size={18} />, requiresAuth: true, onClick: () => router.push('/arbbets') },
          { id: 'duplo-green', name: 'Duplo Green', path: '/arbbets/duplo-green', icon: <GiSoccerBall size={18} />, requiresAuth: true, onClick: () => router.push('/arbbets/duplo-green') },
          { id: 'duas-vidas', name: 'Duas Vidas', path: '/arbbets/duas-vidas', icon: <Zap size={18} />, requiresAuth: true, onClick: () => router.push('/arbbets/duas-vidas') },
          { id: 'multipla', name: 'Múltiplas', path: '/arbbets/multipla', icon: <Layers size={18} />, requiresAuth: true, onClick: () => router.push('/arbbets/multipla') },
        ],
      },
      {
        id: 'valuebets',
        name: 'Value Bets',
        icon: <Gem size={22} />,
        requiresAuth: true,
        subItems: [
          { id: 'valuebets-prematch', name: 'Prematch', path: '/valuebets', icon: <CalendarClock size={18} />, requiresAuth: true, onClick: () => router.push('/valuebets') },
          { id: 'valuebets-clv', name: 'Desempenho (CLV)', path: '/valuebets/clv', icon: <LineChart size={18} />, requiresAuth: true, onClick: () => router.push('/valuebets/clv') },
        ],
      },
      {
        id: 'middles',
        name: 'Middles',
        path: '/middles',
        icon: <Split size={22} />,
        requiresAuth: true,
        onClick: () => router.push('/middles'),
      },

      // ===================== AUTOMAÇÃO =====================
      {
        id: 'sec-automation',
        name: 'Automação',
        icon: null,
        header: true,
        requiresAuth: true,
      },
      {
        id: 'instances',
        name: 'Instâncias',
        path: '/instancias',
        icon: <Bot size={22} />,
        requiresAuth: true,
        onClick: () => router.push('/instancias'),
      },
      {
        id: 'nodelay',
        name: 'NoDelay',
        path: '/nodelay',
        icon: <Rocket size={22} />,
        requiresAuth: true,
        minLevel: 2, // nível 2+ (backend valida em requireLevel / NODELAY_MIN_LEVEL)
        onClick: () => router.push('/nodelay'),
      },

      // ===================== PRIME ANALYTIX =====================
      {
        id: 'sec-analytix',
        name: 'Prime Analytix',
        icon: null,
        header: true,
        requiresAuth: true,
      },
      { id: 'analytix-painel', name: 'Painel', path: '/analytix', icon: <LayoutDashboard size={22} />, requiresAuth: true, onClick: () => router.push('/analytix') },
      { id: 'analytix-apostas', name: 'Apostas', path: '/analytix/apostas', icon: <ListChecks size={22} />, requiresAuth: true, onClick: () => router.push('/analytix/apostas') },
      { id: 'analytix-banca', name: 'Banca', path: '/analytix/banca', icon: <Wallet size={22} />, requiresAuth: true, onClick: () => router.push('/analytix/banca') },
      { id: 'analytix-casas', name: 'Contas', path: '/analytix/casas', icon: <Store size={22} />, requiresAuth: true, onClick: () => router.push('/analytix/casas') },
      { id: 'analytix-parceiros', name: 'Parceiros', path: '/analytix/parceiros', icon: <Users2 size={22} />, requiresAuth: true, onClick: () => router.push('/analytix/parceiros') },

      // ===================== COMUNIDADE =====================
      {
        id: 'sec-community',
        name: 'Comunidade',
        icon: null,
        header: true,
        requiresAuth: false,
      },
      { id: 'comunidade-descobrir', name: 'Descobrir', path: '/comunidade', icon: <Users2 size={22} />, requiresAuth: false, onClick: () => router.push('/comunidade') },
      { id: 'comunidade-perfil', name: 'Meu perfil', path: '/comunidade/perfil', icon: <Users size={22} />, requiresAuth: true, onClick: () => router.push('/comunidade/perfil') },

      // ===================== TRANSMISSÕES =====================
      {
        id: 'sec-broadcasts',
        name: 'Transmissões',
        icon: null,
        header: true,
        requiresAuth: false,
      },
      { id: 'primetv', name: 'PrimeTV', path: '/primetv', icon: <MonitorPlay size={22} />, requiresAuth: false, onClick: () => router.push('/primetv') },
      { id: 'primeradio', name: 'PrimeRádio', path: '/primeradio', icon: <Radio size={22} />, requiresAuth: false, onClick: () => router.push('/primeradio') },

      // ===================== CONTA =====================
      {
        id: 'sec-account',
        name: 'Conta',
        icon: null,
        header: true,
        requiresAuth: false,
      },
      {
        // Planos permanece VISÍVEL — é o CTA de conversão (receita), não faxina.
        id: 'plans',
        name: 'Planos',
        path: '/plans',
        icon: <CreditCard size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/plans'),
      },
      {
        id: 'status',
        name: 'Status',
        path: '/status',
        icon: <Activity size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/status'),
      },
      {
        id: 'affiliate',
        name: 'Afiliados',
        path: '/affiliate',
        icon: <Handshake size={22} />,
        requiresAuth: true,
        affiliateOnly: true,
        onClick: () => router.push('/affiliate'),
      },
    ];

    // Admin enxerga tudo: o nível é sobre plano pago, não sobre permissão.
    const hasLevel = (min?: number) => !min || isAdmin || level >= min;

    return allItems
      .filter(item => (!item.requiresAuth || isAuthenticated) && (!item.adminOnly || isAdmin) && (!item.affiliateOnly || isAffiliate) && hasLevel(item.minLevel))
      .map(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(
            sub => (!sub.requiresAuth || isAuthenticated) && (!sub.adminOnly || isAdmin) && hasLevel(sub.minLevel)
          );
          return { ...item, subItems: filteredSubItems };
        }
        return item;
      });

  }, [isAuthenticated, isAdmin, isAffiliate, level, router]);
};
