import { useRouter } from 'next/router';
import { GiHomeGarage, GiWallet, GiCoins, GiSoccerBall } from 'react-icons/gi';
import { Gift, CalendarClock, LayoutDashboard, Settings, Users, Users2, Zap, Clock, Network, Store, Trophy, Tags, CreditCard, Receipt, ServerCog, Flag, Wallet, ListChecks, Gem, LineChart, SlidersHorizontal } from 'lucide-react';
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
  button?: boolean;
  header?: boolean; // rótulo de seção (não clicável), ex.: "PLATAFORMA"
  subItems?: MenuSubItem[];
}

export const useMenuItems = (): MenuItem[] => {
  const router = useRouter();
  const { isAuthenticated, user } = useUserContext();
  const isAdmin = user?.role === 'admin';

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

      // ===================== ADMIN: PLATAFORMA =====================
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
        id: 'admin-reports',
        name: 'Reclamações',
        path: '/admin/reports',
        icon: <Flag size={22} />,
        requiresAuth: true,
        adminOnly: true,
        onClick: () => router.push('/admin/reports')
      },
      // ===================== ADMIN: SISTEMA =====================
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
            id: 'admin-bookmakers',
            name: 'Bookmakers',
            path: '/admin/bookmakers',
            icon: <Store size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/bookmakers')
          },
          {
            id: 'admin-teams',
            name: 'Times & Aliases',
            path: '/admin/teams',
            icon: <Users2 size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/teams')
          },
          {
            id: 'admin-leagues',
            name: 'Ligas & Aliases',
            path: '/admin/leagues',
            icon: <Trophy size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/leagues')
          },
          {
            id: 'admin-markets',
            name: 'Mercados',
            path: '/admin/markets',
            icon: <Tags size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/markets')
          },
          {
            id: 'admin-valuebet',
            name: 'Value Bets',
            path: '/admin/valuebet-config',
            icon: <SlidersHorizontal size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/valuebet-config')
          },
          {
            id: 'admin-proxies',
            name: 'Proxies',
            path: '/admin/proxies',
            icon: <Network size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/proxies')
          }
        ]
      },
    ];

    return allItems
      .filter(item => (!item.requiresAuth || isAuthenticated) && (!item.adminOnly || isAdmin))
      .map(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(
            sub => (!sub.requiresAuth || isAuthenticated) && (!sub.adminOnly || isAdmin)
          );
          return { ...item, subItems: filteredSubItems };
        }
        return item;
      });

  }, [isAuthenticated, isAdmin, router]);
};
