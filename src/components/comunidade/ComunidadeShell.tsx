import React from 'react';
import Link from 'next/link';
import { Users2, LayoutDashboard, User, Rss, Trophy } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import { useUserContext } from '@/context/UserContext';

// `authOnly` esconde a aba enquanto o usuário não estiver logado (Feed e Meu perfil
// dependem de conta). Descobrir e Ranking são públicos.
const TABS = [
  { id: 'descobrir', name: 'Descobrir', path: '/comunidade', icon: LayoutDashboard, authOnly: false },
  { id: 'ranking', name: 'Ranking', path: '/comunidade/ranking', icon: Trophy, authOnly: false },
  { id: 'feed', name: 'Feed', path: '/comunidade/feed', icon: Rss, authOnly: true },
  { id: 'perfil', name: 'Meu perfil', path: '/comunidade/perfil', icon: User, authOnly: true },
];

interface Props {
  active?: 'descobrir' | 'ranking' | 'feed' | 'perfil' | '';
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Casca da Comunidade. PÚBLICA (sem gate de login) — ler é livre. O gate fica
 * nas ações (publicar/seguir), tratadas nas próprias páginas.
 */
export default function ComunidadeShell({ active = '', title, subtitle, actions, children }: Props) {
  const { isAuthenticated } = useUserContext();
  const tabs = TABS.filter((t) => !t.authOnly || isAuthenticated);
  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30 shrink-0">
            <Users2 className="text-teal-300" size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          <NotificationsBell />
        </div>
      </header>

      <nav className="mb-5 flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 -mx-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <Link key={t.id} href={t.path}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ring-1 transition ${
                isActive ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'
              }`}>
              <Icon size={15} /> {t.name}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
