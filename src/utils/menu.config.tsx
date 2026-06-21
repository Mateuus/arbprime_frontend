import { useRouter } from 'next/router';
import { GiHomeGarage, GiWallet, GiCoins, GiSoccerBall } from 'react-icons/gi';
import { Gift, Infinity, CalendarClock, LayoutDashboard, Settings, Users, Zap, Clock, Network, Store } from 'lucide-react';
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
        id: 'analytix',
        name: 'PRIME ANALYTIX',
        icon: <GiWallet size={22} />,
        requiresAuth: true,
        subItems: [
          {
            id: 'bankroll',
            name: 'Bankroll',
            path: '/analytix/bankroll',
            icon: <Infinity size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/bankroll')
          },
          {
            id: 'stats',
            name: 'Estatísticas',
            path: '/analytix/stats',
            icon: <Infinity size={18} />,
            requiresAuth: true,
            onClick: () => router.push('/analytix/stats')
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
            id: 'admin-bookmakers',
            name: 'Bookmakers',
            path: '/admin/bookmakers',
            icon: <Store size={18} />,
            requiresAuth: true,
            adminOnly: true,
            onClick: () => router.push('/admin/bookmakers')
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
