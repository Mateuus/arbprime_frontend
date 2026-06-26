import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { GiWallet } from 'react-icons/gi';
import { LayoutDashboard, ListChecks, Wallet, Store, Users, RefreshCcw } from 'lucide-react';

const TABS = [
  { id: 'painel', name: 'Painel', path: '/analytix', icon: LayoutDashboard },
  { id: 'apostas', name: 'Apostas', path: '/analytix/apostas', icon: ListChecks },
  { id: 'banca', name: 'Banca', path: '/analytix/banca', icon: Wallet },
  { id: 'casas', name: 'Contas', path: '/analytix/casas', icon: Store },
  { id: 'parceiros', name: 'Parceiros', path: '/analytix/parceiros', icon: Users },
];

interface ShellProps {
  active: 'painel' | 'apostas' | 'banca' | 'casas' | 'parceiros';
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Casca comum das páginas do Analytix: protege por login, exibe cabeçalho com
 * badge + abas (Painel/Apostas/Banca/Casas) e a área de ações (ex.: seletor de
 * banca, botão "Nova aposta"). Grátis para qualquer usuário logado.
 */
export default function AnalytixShell({ active, title, subtitle, actions, children }: ShellProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserContext();

  if (isLoading) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 flex items-center justify-center gap-2 text-gray-400">
          <RefreshCcw className="animate-spin" size={18} /> Verificando acesso...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-teal-500/15 ring-1 ring-teal-500/30 mb-4">
            <GiWallet className="text-teal-300" size={24} />
          </div>
          <h2 className="text-lg font-bold text-white">Entre para usar o Analytix</h2>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            Acompanhe suas apostas, banca, lucro e ROI — exclusivo para usuários logados.
          </p>
          <button
            onClick={() => router.push({ pathname: '/analytix', query: { modal: 'auth', page: 'login' } }, undefined, { shallow: true })}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition"
          >
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30 shrink-0">
            <GiWallet className="text-teal-300" size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </header>

      {/* Abas */}
      <nav className="mb-5 flex items-center gap-1.5 overflow-x-auto py-1.5 px-1 -mx-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.path}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ring-1 transition ${
                isActive
                  ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200'
                  : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Icon size={15} /> {t.name}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
