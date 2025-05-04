import { useRouter } from 'next/router';
import { GiHomeGarage, GiWallet, GiCoins, GiSoccerBall } from 'react-icons/gi';
import { Gift, Infinity, CalendarClock } from 'lucide-react';
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
}

export interface MenuItem {
  id: string;
  name: string;
  path?: string;
  icon: ReactNode;
  onClick?: () => void;
  requiresAuth?: boolean;
  button?: boolean;
  subItems?: MenuSubItem[];
}

export const useMenuItems = (): MenuItem[] => {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();

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
      },
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
        id: 'promo',
        name: 'Promoções ArbPrime',
        path: '/promos',
        icon: <Gift size={22} />,
        requiresAuth: false,
        button: true,
        onClick: () => router.push('/promos')
      }
    ];

    return allItems
      .filter(item => !item.requiresAuth || isAuthenticated)
      .map(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(
            sub => !sub.requiresAuth || isAuthenticated
          );
          return { ...item, subItems: filteredSubItems };
        }
        return item;
      });

  }, [isAuthenticated, router]);
};
