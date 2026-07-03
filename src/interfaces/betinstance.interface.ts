// Contrato da "Instância de Bet" (daemon por usuário que loga na casa e aposta
// valuebet automático). Espelha o backend (BetInstance/BetInstanceConfig +
// serializeInstance). Segredos NUNCA vêm — só a flag hasCredentials.

export type DesiredState = 'running' | 'paused' | 'stopped';
export type InstanceStatus =
  | 'stopped' | 'starting' | 'running' | 'paused' | 'error' | 'login_failed' | 'session_expired' | 'mfa_required';
export type DedupeScope = 'perEmission' | 'perEventSelection' | 'perEvent';
export type StakeMode = 'kelly' | 'flat';
export type RestartPolicy = 'always' | 'on-failure' | 'never';

export interface BetInstanceConfig {
  tiers: number[];
  edgeMin: number;
  oddMin: number;
  oddMax: number;
  confidenceMin: number;
  markets: string[] | null;
  leagues: string[] | null;
  stakeMode: StakeMode;
  kellyMultiplier: number;
  flatStake: number | null;
  minStake: number;
  maxStakePerBet: number;
  stakeRounding: number;
  dedupeScope: DedupeScope;
  maxBetsPerEvent: number;
  maxBetsPerDay: number | null;
  maxStakePerDay: number | null;
  stopLossDay: number | null;
  pollIntervalSec: number;
  dryRun: boolean;
  maxEventDays: number | null;
  restartPolicy: RestartPolicy;
  maxRetries: number;
  proxyId: string | null;
}

export interface BetInstance {
  id: string;
  name: string;
  bookmakerSlug: string;
  strategy: string;
  bankrollId: string | null;
  accountId: string | null;
  desiredState: DesiredState;
  status: InstanceStatus;
  lastError: string | null;
  lastHeartbeatAt: string | null;
  lastRunAt: string | null;
  config: BetInstanceConfig;
  hasCredentials: boolean;
  username: string | null; // login da casa (senha nunca vem)
  createdAt: string;
  updatedAt: string;
}

export interface BetInstanceEvent {
  id: string;
  instanceId: string;
  userId: string;
  type: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface InstanceProxy {
  id: string;
  ip: string;
  port: string;
  iptype: string;
  scope: string[];
}

export interface ProxyCheckResult {
  id: string;
  ip: string;
  port: string;
  iptype: string;
  functional: boolean;
  reason: string;
  latencyMs: number;
  dataDomeOk: boolean | null;
}
