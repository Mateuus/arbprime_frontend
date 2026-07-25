import type { User } from '@/context/UserContext';

/**
 * Escopos (capabilities) do Dashboard admin.
 *
 * Hoje o backend só distingue `role === 'admin'` (binário). Este módulo é a
 * COSTURA de RBAC: o menu e o guard consultam `can(user, scope)` em vez de
 * `user.role === 'admin'` cru. Quando o backend passar a devolver `user.scopes`
 * (papéis operacionais: finance/support/catalog…), NADA no frontend muda — só o
 * mapa role→scopes no backend.
 *
 * Enquanto isso não existe, `can()` faz FALLBACK: admin ⇒ ['*'] (acesso total).
 */
export type Scope =
  | '*'
  | 'overview:read'
  | 'audit:read'
  | 'users:read'
  | 'finance:read'
  | 'support:write'
  | 'catalog:write'
  | 'content:write'
  | 'infra:write'
  | 'config:write';

// `User` ainda não declara `scopes`; aceitamos via cast até o backend enviá-lo.
type WithScopes = { scopes?: string[]; role?: string };

/** Scopes efetivos do usuário (do backend, ou derivados do role como fallback). */
export function scopesOf(user: Pick<User, 'role'> | null): string[] {
  if (!user) return [];
  const explicit = (user as WithScopes).scopes;
  if (Array.isArray(explicit) && explicit.length) return explicit;
  // Fallback retrocompatível: o backend atual só marca 'admin'.
  return user.role === 'admin' ? ['*'] : [];
}

/**
 * O usuário tem o escopo pedido?
 * ⚠️ `'*'` PRECISA ser testado primeiro — senão o admin (scopes ['*']) é
 * bloqueado de tudo (nenhum scope específico bate '*').
 */
export function can(user: Pick<User, 'role'> | null, scope: Scope): boolean {
  const scopes = scopesOf(user);
  return scopes.includes('*') || scopes.includes(scope);
}

/** Tem QUALQUER acesso ao console? (controla o botão "Painel" na navbar.) */
export function hasDashboardAccess(user: Pick<User, 'role'> | null): boolean {
  return scopesOf(user).length > 0;
}
