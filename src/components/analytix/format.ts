import { LegStatusValue, BetStatusValue } from '@/gateways/api.gateway';

/** Formatação BRL pt-BR (R$ 1.234,56). */
export const BRL = (v: number | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

/** Número com 2 casas, vírgula decimal. */
export const num2 = (v: number | null | undefined): string =>
  (Number(v) || 0).toFixed(2).replace('.', ',');

/** Percentual com sinal opcional. */
export const pct = (v: number | null | undefined, withSign = false): string => {
  const n = Number(v) || 0;
  const s = withSign && n > 0 ? '+' : '';
  return `${s}${n.toFixed(2).replace('.', ',')}%`;
};

/** Valor BRL com sinal explícito (+R$ 10,00 / -R$ 5,00). */
export const signedBRL = (v: number | null | undefined): string => {
  const n = Number(v) || 0;
  return `${n > 0 ? '+' : ''}${BRL(n)}`;
};

/** Classe de cor para lucro/prejuízo (nunca usar cor sozinha — sempre com sinal). */
export const profitColor = (v: number | null | undefined): string => {
  const n = Number(v) || 0;
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-rose-400';
  return 'text-zinc-400';
};

export const profitFill = (v: number | null | undefined): string => {
  const n = Number(v) || 0;
  if (n > 0) return '#34d399';
  if (n < 0) return '#fb7185';
  return '#a1a1aa';
};

export const fmtDateShort = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const fmtDateTime = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * Data/hora do JOGO (kickoff) p/ exibição: "dom, 28/06 16:00". Sem ano (jogos são
 * próximos); devolve null quando não há data — o chamador decide o fallback.
 */
export const fmtGameDateTime = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${wd}, ${dm} ${hm}`;
};

// ---- Status das pernas ----
export const LEG_STATUS_LABELS: Record<LegStatusValue, string> = {
  pending: 'Pendente',
  won: 'Ganha',
  lost: 'Perdida',
  void: 'Anulada',
  half_won: 'Meio ganha',
  half_lost: 'Meio perdida',
  cashout: 'Cashout',
};

export const LEG_STATUS_STYLE: Record<LegStatusValue, string> = {
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  won: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  lost: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  void: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  half_won: 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20',
  half_lost: 'bg-rose-500/10 text-rose-200 ring-rose-500/20',
  cashout: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
};

export const LEG_STATUS_OPTIONS: { value: LegStatusValue; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'won', label: 'Ganha' },
  { value: 'lost', label: 'Perdida' },
  { value: 'half_won', label: 'Meio ganha' },
  { value: 'half_lost', label: 'Meio perdida' },
  { value: 'void', label: 'Anulada' },
  { value: 'cashout', label: 'Cashout' },
];

// ---- Status da aposta ----
export const BET_STATUS_LABELS: Record<BetStatusValue, string> = {
  open: 'Aberta',
  partially_settled: 'Parcial',
  settled: 'Liquidada',
  void: 'Anulada',
};

export const BET_STATUS_STYLE: Record<BetStatusValue, string> = {
  open: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  partially_settled: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  settled: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  void: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
};

export const BET_STATUS_OPTIONS: { value: '' | BetStatusValue; label: string }[] = [
  { value: '', label: 'Todos status' },
  { value: 'open', label: 'Abertas' },
  { value: 'partially_settled', label: 'Parciais' },
  { value: 'settled', label: 'Liquidadas' },
  { value: 'void', label: 'Anuladas' },
];

// ---- Períodos (período → from ISO) ----
export type PeriodKey = '7d' | '30d' | '90d' | 'year' | 'all';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'year', label: 'Ano' },
  { key: 'all', label: 'Tudo' },
];

/** Converte um período em { from, to } ISO (to omitido = agora). */
export const periodRange = (p: PeriodKey): { from?: string; to?: string } => {
  if (p === 'all') return {};
  const now = new Date();
  const from = new Date(now);
  if (p === '7d') from.setDate(now.getDate() - 7);
  else if (p === '30d') from.setDate(now.getDate() - 30);
  else if (p === '90d') from.setDate(now.getDate() - 90);
  else if (p === 'year') from.setFullYear(now.getFullYear() - 1);
  return { from: from.toISOString() };
};

/** Bucket sugerido para a série conforme o período. */
export const periodBucket = (p: PeriodKey): 'day' | 'week' | 'month' => {
  if (p === '7d' || p === '30d') return 'day';
  if (p === '90d') return 'week';
  return 'month';
};

/** Desempacota a resposta padrão { result, message, data }. */
export const unwrap = <T>(r: { data?: { result?: number; data?: unknown } } | null | undefined, fallback: T): T =>
  (r?.data?.result === 1 ? (r.data.data as T) : fallback);

// ---- Exibição de uma casa do usuário (catálogo global vs personalizada) ----
export interface HouseDisplay { name: string; logoUrl: string | null; color: string | null }

export const accountDisplay = (
  a: { isCustom: boolean; customName: string | null; customLogoUrl: string | null; customColor: string | null; label: string | null; slug: string },
  bk?: { name?: string; logoUrl?: string | null; color?: string | null } | null,
): HouseDisplay => {
  if (a.isCustom) return { name: a.customName || a.label || a.slug, logoUrl: a.customLogoUrl, color: a.customColor };
  return { name: a.label || bk?.name || a.slug, logoUrl: bk?.logoUrl ?? null, color: bk?.color ?? null };
};

export const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Depósito', withdrawal: 'Saque', adjustment: 'Ajuste', bonus: 'Bônus/Promoção', partner_payout: 'Repasse a parceiro', bet_result: 'Resultado',
};
