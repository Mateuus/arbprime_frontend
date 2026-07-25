import type { ReactNode } from 'react';
import {
  LayoutDashboard, Users, Gem, Receipt, ClipboardCheck, Handshake, Ticket,
  CreditCard, Flag, Store, Users2, Trophy, Tags, RadioTower, Network, Zap,
  SlidersHorizontal,
} from 'lucide-react';
import type { Scope } from './adminAccess';

export interface DashNavItem {
  id: string;
  name: string;
  path: string;
  icon: ReactNode;
  scope: Scope;
  /** rota-base p/ marcar ativo em sub-rotas (ex.: /admin/users/[id]). */
  match?: string;
}

export interface DashNavSection {
  id: string;
  label: string;
  scope: Scope;
  items: DashNavItem[];
}

const SZ = 18;

/**
 * Navegação do Dashboard admin. FONTE SEPARADA do menu.config.tsx do site — é o
 * que resolve o "admin gigante no sidebar do usuário".
 * Agrupada por FUNÇÃO DE QUEM OPERA (Financeiro/Catálogo/Infra) = a fronteira já
 * pré-desenhada do RBAC futuro (cada seção/item carrega um `scope`).
 * Só lista páginas que EXISTEM (wrap-first — nenhum link morto).
 */
export const DASHBOARD_NAV: DashNavSection[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    scope: 'overview:read',
    items: [
      { id: 'painel', name: 'Painel', path: '/admin/dashboard', icon: <LayoutDashboard size={SZ} />, scope: 'overview:read' },
    ],
  },
  {
    id: 'users',
    label: 'Usuários & acesso',
    scope: 'users:read',
    items: [
      { id: 'users', name: 'Usuários', path: '/admin/users', icon: <Users size={SZ} />, scope: 'users:read', match: '/admin/users' },
    ],
  },
  {
    id: 'finance',
    label: 'Monetização',
    scope: 'finance:read',
    items: [
      { id: 'plans', name: 'Planos', path: '/admin/plans', icon: <Gem size={SZ} />, scope: 'finance:read' },
      { id: 'transactions', name: 'Transações', path: '/admin/transactions', icon: <Receipt size={SZ} />, scope: 'finance:read' },
      { id: 'approvals', name: 'Aprovações PIX', path: '/admin/payment-approvals', icon: <ClipboardCheck size={SZ} />, scope: 'finance:read' },
      { id: 'affiliates', name: 'Afiliados', path: '/admin/affiliates', icon: <Handshake size={SZ} />, scope: 'finance:read' },
      { id: 'coupons', name: 'Cupons', path: '/admin/coupons', icon: <Ticket size={SZ} />, scope: 'finance:read' },
      { id: 'payment-config', name: 'Config. de pagamentos', path: '/admin/payment-config', icon: <CreditCard size={SZ} />, scope: 'finance:read' },
    ],
  },
  {
    id: 'support',
    label: 'Suporte & integridade',
    scope: 'support:write',
    items: [
      { id: 'reports', name: 'Reclamações & Exclusões', path: '/admin/reports', icon: <Flag size={SZ} />, scope: 'support:write' },
    ],
  },
  {
    id: 'catalog',
    label: 'Catálogo',
    scope: 'catalog:write',
    items: [
      { id: 'bookmakers', name: 'Bookmakers', path: '/admin/bookmakers', icon: <Store size={SZ} />, scope: 'catalog:write' },
      { id: 'teams', name: 'Times & Aliases', path: '/admin/teams', icon: <Users2 size={SZ} />, scope: 'catalog:write' },
      { id: 'leagues', name: 'Ligas & Aliases', path: '/admin/leagues', icon: <Trophy size={SZ} />, scope: 'catalog:write' },
      { id: 'markets', name: 'Mercados', path: '/admin/markets', icon: <Tags size={SZ} />, scope: 'catalog:write' },
    ],
  },
  {
    id: 'content',
    label: 'Conteúdo & mídia',
    scope: 'content:write',
    items: [
      { id: 'primeradio', name: 'PrimeRádio', path: '/admin/primeradio', icon: <RadioTower size={SZ} />, scope: 'content:write' },
    ],
  },
  {
    id: 'infra',
    label: 'Infraestrutura',
    scope: 'infra:write',
    items: [
      { id: 'proxies', name: 'Proxies', path: '/admin/proxies', icon: <Network size={SZ} />, scope: 'infra:write' },
      { id: 'actions', name: 'Ações', path: '/admin/actions', icon: <Zap size={SZ} />, scope: 'infra:write' },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    scope: 'config:write',
    items: [
      { id: 'settings', name: 'Geral', path: '/admin/settings', icon: <SlidersHorizontal size={SZ} />, scope: 'config:write' },
      { id: 'valuebet', name: 'Value Bets', path: '/admin/valuebet-config', icon: <SlidersHorizontal size={SZ} />, scope: 'config:write' },
    ],
  },
];

/** Mapa rota → rótulo/seção, p/ o breadcrumb do topbar. */
export function dashCrumbFor(pathname: string): { section: string; label: string } | null {
  for (const sec of DASHBOARD_NAV) {
    for (const it of sec.items) {
      if (pathname === it.path || (it.match && pathname.startsWith(it.match))) {
        return { section: sec.label, label: it.name };
      }
    }
  }
  return null;
}
