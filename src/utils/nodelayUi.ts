// Helpers de UI do NoDelay (acento lime — família exclusiva desta feature).
import { NoDelayAccountStatus } from '@/interfaces/nodelay.interface';

/** Nível de plano exigido — espelha NODELAY_MIN_LEVEL do backend. */
export const NODELAY_MIN_LEVEL = 3;

export const STATUS_META: Record<NoDelayAccountStatus, { label: string; cls: string; dot: string }> = {
  connected: { label: 'Conectada', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  connecting: { label: 'Conectando', cls: 'bg-lime-500/15 text-lime-300 ring-lime-500/40', dot: 'bg-lime-400 animate-pulse' },
  disconnected: { label: 'Desconectada', cls: 'bg-white/10 text-gray-300 ring-white/15', dot: 'bg-gray-400' },
  login_failed: { label: 'Login falhou', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/40', dot: 'bg-rose-400' },
  session_expired: { label: 'Sessão caiu', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/40', dot: 'bg-amber-400' },
  mfa_required: { label: 'Exige 2FA', cls: 'bg-orange-500/15 text-orange-300 ring-orange-500/40', dot: 'bg-orange-400' },
};

export const statusMeta = (s: NoDelayAccountStatus | string) =>
  STATUS_META[s as NoDelayAccountStatus] ?? STATUS_META.disconnected;

/** Rótulo da família de login (o usuário não precisa saber, mas o admin sim). */
export const platformLabel = (p: string | null): string =>
  p === 'swarm' ? 'WebSocket (swarm)' : p || '—';

export const formatMoney = (v: number | null, currency = 'BRL'): string => {
  if (v == null) return '—';
  try {
    return v.toLocaleString('pt-BR', { style: 'currency', currency });
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
};

/** "há 3min" — usado no "logado há X" do card da conta. */
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/** Iniciais para o avatar da conta (sem foto — a casa não expõe). */
export function initials(name: string): string {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Mensagem amigável a partir do kind do SwarmError. */
export function swarmErrorText(kind: string, fallback: string): string {
  switch (kind) {
    case 'connect': return 'Não foi possível conectar na casa. Verifique sua internet e tente de novo.';
    case 'timeout': return 'A casa demorou demais para responder. Tente de novo.';
    case 'rejected': return 'Usuário ou senha incorretos.';
    case 'mfa_required': return 'Esta conta exige verificação em duas etapas, ainda não suportada.';
    case 'protocol': return 'A casa respondeu de forma inesperada. Avise o suporte.';
    default: return fallback;
  }
}
