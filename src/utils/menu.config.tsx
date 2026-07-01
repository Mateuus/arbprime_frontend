import { useRouter } from 'next/router';
import { GiHomeGarage, GiWallet, GiCoins, GiSoccerBall } from 'react-icons/gi';
import { Gift, CalendarClock, LayoutDashboard, Settings, Users, Users2, Zap, Clock, Network, Store, Trophy, Tags, CreditCard, Receipt, ServerCog, Flag, Wallet, ListChecks, Gem, LineChart, SlidersHorizontal, Handshake, Ticket, ClipboardCheck, Activity, Split, Bot } from 'lucide-react';
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
  button?: boolean;
  header?: boolean; // rótulo de seção (não clicável), ex.: "PLATAFORMA"
  subItems?: MenuSubItem[];
}

export const useMenuItems = (): MenuItem[] => {
  const router = useRouter();
  const { isAuthenticated, user } = useUserContext();
  const isAdmin = user?.role === 'admin';
  const isAffiliate = !!user?.isAffiliate;

  return useMemo(() => {
    const allItems: MenuItem[] = [
      {
        id: 'home',
        name: 'Home',
        path: '/',
        icon: <GiHomeGarage size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/')
      },
      {
        id: 'events',
        name: 'Eventos',
        path: '/events',
        icon: <GiSoccerBall size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/events')
      },
      {
        id: 'plans',
        name: 'Planos',
        path: '/plans',
        icon: <CreditCard size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/plans')
      },
      {
        id: 'status',
        name: 'Status',
        path: '/status',
        icon: <Activity size={22} />,
        requiresAuth: false,
        onClick: () => router.push('/status')
      },
      {
        id: 'analytix',
        name: 'PRIME ANALYTIX',
        icon: <GiWallet size={22} />,
        requiresAuth: true,
        subItems: [
          {
            id: 'painel',
            name: 'Painel',
            path: '/analytix',
            icon: <LayoutDashboard size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix')
          },
          {
            id: 'apostas',
            name: 'Apostas',
            path: '/analytix/apostas',
            icon: <ListChecks size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/apostas')
          },
          {
            id: 'banca',
            name: 'Banca',
            path: '/analytix/banca',
            icon: <Wallet size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/banca')
          },
          {
            id: 'casas',
            name: 'Contas',
            path: '/analytix/casas',
            icon: <Store size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/casas')
          },
          {
            id: 'parceiros',
            name: 'Parceiros',
            path: '/analytix/parceiros',
            icon: <Users2 size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/parceiros')
          }
        ]
      },/*
      {
        id: 'arbcrypto',
        name: 'Arb Crypto',
        icon: <GiCoins size={22} />,
        requiresAuth: true,
        subItems: [
          {
            id: 'perp',
            name: 'Perpetuals',
            path: '/arbcrypto/perpetuals',
            icon: <Infinity size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/arbcrypto/perpetuals')
          }
        ]
      },*/
      {
        id: 'comunidade',
        name: 'Comunidade',
        icon: <Users2 size={22} />,
        requiresAuth: false,
        subItems: [
          {
            id: 'descobrir',
            name: 'Descobrir',
            path: '/comunidade',
            icon: <LayoutDashboard size={18} />,
            requiresAuth: false,
            onClick: () => router.push('/comunidade')
          },
          {
            id: 'meu-perfil',
            name: 'Meu perfil',
            path: '/comunidade/perfil',
            icon: <Users size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/comunidade/perfil')
          }
        ]
      },
      {
        id: 'affiliate',
        name: 'Afiliados',
        path: '/affiliate',
        icon: <Handshake size={22} />,
        requiresAuth: true,
        affiliateOnly: true,
        onClick: () => router.push('/affiliate')
      },

      // ===================== OPORTUNIDADES =====================
      {
        id: 'sec-opportunities',
        name: 'Oportunidades',
        icon: null,
        header: true,
        requiresAuth: true
      },
      {
        id: 'arbbets',
        name: 'Arb Bets',
        icon: <GiSoccerBall size={22} />,
        requiresAuth: true,
        subItems: [
          {
            id: 'prematch',
            name: 'Prematch',
            path: '/arbbets',
            icon: <CalendarClock size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/arbbets')
          },
          {
            id: 'duplo-green',
            name: 'Duplo Green',
            path: '/arbbets/duplo-green',
            icon: <GiSoccerBall size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/arbbets/duplo-green')
          },
          {
            id: 'duas-vidas',
            name: 'Duas Vidas',
            path: '/arbbets/duas-vidas',
            icon: <Zap size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/arbbets/duas-vidas')
          }
        ]
      },

      {
        id: 'valuebets',
        name: 'Value Bets',
        icon: <Gem size={22} />,
        requiresAuth: true,
        subItems: [
          {
            id: 'valuebets-prematch',
            name: 'Prematch',
            path: '/valuebets',
            icon: <CalendarClock size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/valuebets')
          },
          {
            id: 'valuebets-clv',
            name: 'Desempenho (CLV)',
            path: '/valuebets/clv',
            icon: <LineChart size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/valuebets/clv')
          }
        ]
      },

      {
        id: 'middles',
        name: 'Middles',
        path: '/middles',
        icon: <Split size={22} />,
        requiresAuth: true,
        onClick: () => router.push('/middles')
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
        onClick: () => router.push('/instancias')
      },

      // ===================== ADMIN =====================
      {
        id: 'sec-admin-platform',
        name: 'Administração',
        icon: null,
        header: true,
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-dashboard',
        name: 'Dashboard',
        path: '/admin/dashboard',
        icon: <LayoutDashboard size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/dashboard')
      },

      // ----- Gestão: usuários, financeiro, afiliados, suporte -----
      {
        id: 'sec-admin-gestao',
        name: 'Gestão',
        icon: null,
        header: true,
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-users',
        name: 'Usuários',
        path: '/admin/users',
        icon: <Users size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/users')
      },
      {
        id: 'admin-plans',
        name: 'Planos',
        path: '/admin/plans',
        icon: <CreditCard size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/plans')
      },
      {
        id: 'admin-transactions',
        name: 'Transações',
        path: '/admin/transactions',
        icon: <Receipt size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/transactions')
      },
      {
        id: 'admin-payment-approvals',
        name: 'Aprovações',
        path: '/admin/payment-approvals',
        icon: <ClipboardCheck size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/payment-approvals')
      },
      {
        id: 'admin-affiliates',
        name: 'Afiliados',
        icon: <Handshake size={22} />,
        requiresAuth: true,
        adminOnly: true,
        subItems: [
          {
            id: 'admin-affiliates-list',
            name: 'Afiliados',
            path: '/admin/affiliates',
            icon: <Handshake size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/affiliates')
          },
          {
            id: 'admin-coupons',
            name: 'Cupons',
            path: '/admin/coupons',
            icon: <Ticket size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/coupons')
          }
        ]
      },
      {
        id: 'admin-reports',
        name: 'Reclamações',
        path: '/admin/reports',
        icon: <Flag size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/reports')
      },

      // ----- Catálogo: curadoria de dados que alimenta o matching -----
      {
        id: 'sec-admin-catalog',
        name: 'Catálogo',
        icon: null,
        header: true,
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-bookmakers',
        name: 'Bookmakers',
        path: '/admin/bookmakers',
        icon: <Store size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/bookmakers')
      },
      {
        id: 'admin-teams',
        name: 'Times & Aliases',
        path: '/admin/teams',
        icon: <Users2 size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/teams')
      },
      {
        id: 'admin-leagues',
        name: 'Ligas & Aliases',
        path: '/admin/leagues',
        icon: <Trophy size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/leagues')
      },
      {
        id: 'admin-markets',
        name: 'Mercados',
        path: '/admin/markets',
        icon: <Tags size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/markets')
      },

      // ----- Sistema: operação e configurações -----
      {
        id: 'sec-admin-system',
        name: 'Sistema',
        icon: null,
        header: true,
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-actions',
        name: 'Ações',
        path: '/admin/actions',
        icon: <Zap size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/actions')
      },
      {
        id: 'admin-proxies',
        name: 'Proxies',
        path: '/admin/proxies',
        icon: <Network size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/proxies')
      },
      {
        id: 'admin-settings',
        name: 'Configurações',
        icon: <Settings size={22} />,
        requiresAuth: true,
        adminOnly: true,
        subItems: [
          {
            id: 'admin-settings-general',
            name: 'Geral',
            path: '/admin/settings',
            icon: <Settings size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/settings')
          },
          {
            id: 'admin-settings-payments',
            name: 'Pagamentos',
            path: '/admin/payment-config',
            icon: <ServerCog size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/payment-config')
          },
          {
            id: 'admin-valuebet',
            name: 'Value Bets',
            path: '/admin/valuebet-config',
            icon: <SlidersHorizontal size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/valuebet-config')
          }
        ]
      },
    ];

    return allItems
      .filter(item => (!item.requiresAuth || isAuthenticated) && (!item.adminOnly || isAdmin) && (!item.affiliateOnly || isAffiliate))
      .map(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(
            sub => (!sub.requiresAuth || isAuthenticated) && (!sub.adminOnly || isAdmin)
          );
          return { ...item, subItems: filteredSubItems };
        }
        return item;
      });

  }, [isAuthenticated, isAdmin, isAffiliate, router]);
};
