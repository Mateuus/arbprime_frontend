// NoDelay — aposta rápida multi-conta. Espelha o backend (nodelay.controller).

export type NoDelayPlatform = 'swarm';

/** Instância = workspace do usuário que agrupa casas do padrão swarm+fssbio. */
export interface NoDelayInstance {
  id: string;
  name: string;
  houseSlugs: string[];
  createdAt: string;
  updatedAt: string;
}

export type NoDelayAccountStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'login_failed'
  | 'session_expired'
  | 'mfa_required';

/** Casa liberada no NoDelay + o que o browser precisa para conectar nela. */
export interface NoDelayBookmaker {
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  url: string | null;
  platform: NoDelayPlatform | string | null;
  wssUrl: string | null;
  origin: string | null;
  siteId: string | null;
  source: number | null;
  language: string | null;
  /** Host da API rogue/FSB (POR CASA: 7games=prod20563, betão=prod20562). */
  rogueUrl: string | null;
  /** Operador (site do BFF) — origem do mint de token. */
  operatorSite: string | null;
  /** Chave do widget de radar por esporte ('default' = futebol). */
  radarProfiles: Record<string, string> | null;
  /** Origem que serve o match-tracker-map (cai no `url` da casa). */
  radarMapUrl: string | null;
  /** Ligada no admin E com plataforma/wssUrl preenchidos. */
  ready: boolean;
  accountsCount: number;
  connectedCount: number;
}

export interface NoDelayAccount {
  id: string;
  bookmakerSlug: string;
  label: string | null;
  username: string;
  externalUserId: string | null;
  status: NoDelayAccountStatus;
  lastError: string | null;
  sessionAt: string | null;
  hasSession: boolean;
  balance: number | null;
  currency: string;
  balanceAt: string | null;
  isActive: boolean;
  credentialsSetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Só trafega quando o front vai de fato logar (rota /credentials). */
export interface NoDelayCredentials {
  id: string;
  bookmakerSlug: string;
  username: string;
  password: string;
}

/** Sessão salva que o browser revalida no "Atualizar" (rota /sessions). */
export interface NoDelaySession {
  id: string;
  bookmakerSlug: string;
  label: string | null;
  username: string;
  externalUserId: string;
  authToken: string;
}

/** Resultado da checagem de uma conta no "Atualizar". */
export interface NoDelayCheckResult {
  id: string;
  name: string;
  bookmakerSlug: string;
  /** alive = ainda logada · expired = caiu · error = não deu pra saber */
  state: 'alive' | 'expired' | 'error';
  balance?: number | null;
  currency?: string;
  message?: string;
}
