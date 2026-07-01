// Helpers de UI da Instância de Bet (acento cyan).
import { InstanceStatus } from '@/interfaces/betinstance.interface';

// Casas suportadas pela automação. Por enquanto só a Betano (login/place/histórico
// provados). Ao instrumentar outra casa, adicione aqui + no backend (betbot/<casa>).
export const SUPPORTED_HOUSES: { slug: string; name: string }[] = [
  { slug: 'betano', name: 'Betano' },
];

export const houseName = (slug: string): string =>
  SUPPORTED_HOUSES.find((h) => h.slug === slug)?.name ?? slug;

export const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  running: { label: 'Rodando', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40', dot: 'bg-emerald-400' },
  starting: { label: 'Iniciando', cls: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/40', dot: 'bg-cyan-400 animate-pulse' },
  paused: { label: 'Pausada', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/40', dot: 'bg-amber-400' },
  stopped: { label: 'Parada', cls: 'bg-white/10 text-gray-300 ring-white/15', dot: 'bg-gray-400' },
  error: { label: 'Erro', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/40', dot: 'bg-rose-400' },
  login_failed: { label: 'Login falhou', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/40', dot: 'bg-rose-400' },
  session_expired: { label: 'Sessão caiu', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/40', dot: 'bg-amber-400' },
};

export const statusMeta = (s: InstanceStatus | string) => STATUS_META[s] ?? STATUS_META.stopped;

export const eventLevelCls = (level: string): string =>
  level === 'error' ? 'text-rose-300' : level === 'warn' ? 'text-amber-300' : 'text-gray-300';

export const eventTypeCls = (type: string): string => {
  if (type === 'place') return 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30';
  if (type === 'login' || type === 'session') return 'bg-violet-500/15 text-violet-300 ring-violet-500/30';
  if (type === 'error') return 'bg-rose-500/15 text-rose-300 ring-rose-500/30';
  if (type === 'skip') return 'bg-white/10 text-gray-300 ring-white/15';
  return 'bg-white/10 text-gray-400 ring-white/15';
};

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function hhmmss(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
