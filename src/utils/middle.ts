// Helpers de MIDDLE (apostas de intervalo): cor/rótulo do EV, destaque do pGap,
// formatação do gap (miolo) e da linha, rótulos de mercado/seleção, formatação
// em R$ e adaptador p/ reusar OpenInHouse (tipado em SurebetOdd).
import { Middle, MiddleLeg, MiddleData, MiddleLineType } from '@/interfaces/middle.interface';
import { SurebetData, SurebetOdd, Surebet } from '@/interfaces/arbitragem.interface';
import { marketLabel, optionLabel } from '@/utils/surebet';
import { formatEventDateTime } from '@/utils/eventTime';

// EV "≈0" (free middle): |EV%| abaixo deste limiar conta como neutro (âmbar).
export const FREE_MIDDLE_EPS = 0.1;

export type EvKind = 'positive' | 'free' | 'negative';

export const evKind = (ev: number): EvKind => {
  if (ev > FREE_MIDDLE_EPS) return 'positive';
  if (ev < -FREE_MIDDLE_EPS) return 'negative';
  return 'free';
};

// Cor do badge de EV: verde se +EV (forte ≥1%), âmbar se ≈0 (FREE MIDDLE),
// vermelho se −EV. Combina com a semântica pedida no produto.
export const evTone = (ev: number): string => {
  const k = evKind(ev);
  if (k === 'positive') {
    return ev >= 1
      ? 'text-emerald-300 bg-emerald-500/20 ring-emerald-500/40'
      : 'text-emerald-300 bg-emerald-500/12 ring-emerald-500/30';
  }
  if (k === 'free') return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
  return 'text-rose-300 bg-rose-500/15 ring-rose-500/30';
};

// Destaque do pGap (chance de cair no miolo): quanto maior, mais "vivo".
export const pGapTone = (pGap: number): string => {
  if (pGap >= 25) return 'text-emerald-300 bg-emerald-500/12 ring-emerald-500/30';
  if (pGap >= 12) return 'text-sky-300 bg-sky-500/12 ring-sky-500/30';
  return 'text-gray-300 bg-white/5 ring-white/15';
};

// Número com sinal explícito (+0.24 / -26.21). Mantém ponto decimal (consistente
// com os badges de lucro dos outros cards).
export const fmtSigned = (n: number, digits = 2): string => `${n >= 0 ? '+' : ''}${Number(n).toFixed(digits)}`;

// Linha de gols enxuta: 2.5, 2.75, 3 ("3.0" vira "3").
export const fmtLine = (line: number): string => {
  if (!Number.isFinite(line)) return String(line);
  return Number.isInteger(line) ? String(line) : String(line);
};

// Rótulo da paridade da linha (asiática vs cheia).
export const lineTypeLabel = (t: MiddleLineType): string =>
  ({
    whole: 'Linha inteira',
    half: 'Meia linha',
    quarter: 'Linha de quarto (asiática)',
    mixed: 'Linhas mistas',
    other: '—',
  }[t] || '—');

// Descrição amigável do miolo (placares que ganham as duas pernas): um número,
// um range contíguo (2–3) ou uma lista (2, 4).
export const gapLabel = (gap: number[]): string => {
  if (!gap || gap.length === 0) return '—';
  const sorted = [...gap].sort((a, b) => a - b);
  if (sorted.length === 1) return `${sorted[0]}`;
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return contiguous ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(', ');
};

// É um middle de HANDICAP asiático (time-a-time)? Senão é de TOTAIS (over/under).
export const isHandicap = (m: Middle): boolean =>
  m.kind === 'handicap' || m.legs.some((l) => l.side === 'home' || l.side === 'away');

export const middleKindLabel = (m: Middle): string => (isHandicap(m) ? 'Handicap' : 'Totais');

// Linha com sinal (handicap): -0.5, +1.5, 0. (Totais usam fmtLine, sem sinal.)
export const fmtSignedLine = (n: number): string => `${n > 0 ? '+' : ''}${fmtLine(n)}`;

// Rótulo de um valor do miolo: gol total (totais) ou MARGEM com sinal (handicap).
export const gapValueLabel = (value: number, handicap: boolean): string =>
  handicap ? `${value > 0 ? '+' : ''}${value}` : String(value);

/**
 * Separa as duas pernas em "esquerda" (fronteira menor) e "direita" (maior):
 *  - totais:   left = Over (linha menor), right = Under (linha maior);
 *  - handicap: left = Casa (home), right = Visitante (away).
 * Robusto a ordem ou side ausente.
 */
export const splitLegs = (m: Middle): { left: MiddleLeg; right: MiddleLeg; handicap: boolean } => {
  const handicap = isHandicap(m);
  if (handicap) {
    const home = m.legs.find((l) => l.side === 'home') || m.legs[0];
    const away = m.legs.find((l) => l.side === 'away') || m.legs[1] || m.legs[0];
    return { left: home, right: away, handicap };
  }
  const over = m.legs.find((l) => l.side === 'over') || m.legs[0];
  const under = m.legs.find((l) => l.side === 'under') || m.legs[1] || m.legs[0];
  return { left: over, right: under, handicap };
};

// Selo curto da perna por side, com a cor do lado (esquerda=emerald, direita=rose).
export const sideBadge = (side: MiddleLeg['side']): { label: string; cls: string } => {
  switch (side) {
    case 'over': return { label: 'O', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' };
    case 'under': return { label: 'U', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' };
    case 'home': return { label: 'C', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' };
    case 'away': return { label: 'F', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' };
    default: return { label: '·', cls: 'bg-white/5 text-gray-300 ring-white/15' };
  }
};

/**
 * Texto humano do MIOLO (onde as duas pernas ganham):
 *  - totais:   "3 gol(s) no placar" / "2–3 gols no placar";
 *  - handicap: "{mandante} vence por 2" / "{visitante} vence por 1" / "saldo de −1 a +2".
 */
export const mioloText = (m: Middle, home?: string, away?: string): string => {
  const gap = [...(m.gap || [])].sort((a, b) => a - b);
  if (gap.length === 0) return 'sem miolo';
  if (!isHandicap(m)) return `${gapLabel(gap)} gol(s) no placar`;

  const H = home || 'Mandante';
  const A = away || 'Visitante';
  const describe = (v: number) => (v > 0 ? `${H} vence por ${v}` : v < 0 ? `${A} vence por ${-v}` : 'empate (saldo 0)');
  if (gap.length === 1) return describe(gap[0]);
  const lo = gap[0];
  const hi = gap[gap.length - 1];
  if (lo > 0) return `${H} vence por ${lo}–${hi}`;
  if (hi < 0) return `${A} vence por ${-hi}–${-lo}`;
  return `saldo de ${gapValueLabel(lo, true)} a ${gapValueLabel(hi, true)} (casa − fora)`;
};

// Supremacia (handicap): margem esperada da casa. + favorece mandante, − visitante.
export const supremacyText = (m: Middle, home?: string, away?: string): string | null => {
  if (m.supremacy == null || !Number.isFinite(m.supremacy)) return null;
  const s = m.supremacy;
  const abs = Math.abs(s).toFixed(2);
  if (Math.abs(s) < 0.05) return 'jogo equilibrado (sem favorito claro)';
  return s > 0 ? `${home || 'Mandante'} favorito por ~${abs} gol` : `${away || 'Visitante'} favorito por ~${abs} gol`;
};

// Nome do mercado: prefere o cru da casa (rawMarket); senão o catálogo.
export const middleMarketLabel = (m: Middle): string => {
  const raw = (m.legs.find((l) => l.rawMarket)?.rawMarket || '').trim();
  if (raw) return raw;
  return marketLabel(m.market);
};

// Rótulo da seleção de uma perna: prefere rawSelection (ex.: "Casa -0.5"); senão
// compõe pelo lado + linha (totais "Mais/Menos de X"; handicap "{time} {linha}").
export const legSelectionLabel = (leg: MiddleLeg, home?: string, away?: string): string => {
  const raw = (leg.rawSelection || '').trim();
  if (raw) return raw;
  switch (leg.side) {
    case 'home': return `${home || 'Casa'} ${fmtSignedLine(leg.line)}`;
    case 'away': return `${away || 'Visitante'} ${fmtSignedLine(leg.line)}`;
    case 'over': return `Mais de ${fmtLine(leg.line)}`;
    case 'under': return `Menos de ${fmtLine(leg.line)}`;
    default: return optionLabel(leg.option, home, away, leg.line);
  }
};

// Idade ("visto há…") a partir de um ISO (1ª detecção).
export const seenAgo = (iso?: string): string => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
};

// Data/hora curtas pt-BR (dd/mm hh:mm) do kickoff. null se a data não for válida.
// `event.date` é GMT-3 tagueado Z → wallclock verbatim. Ver utils/eventTime.
export const fmtDateTime = (iso?: string): string | null => formatEventDateTime(iso);

// Valor em R$ (pt-BR). Aceita negativo (perda).
export const fmtBRL = (n: number): string =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Adapta uma perna de middle (+grupo) para os formatos SurebetOdd/SurebetData que
 * o OpenInHouse espera, reaproveitando deep-link/extensão sem forkar o componente.
 */
export const toSurebetLeg = (leg: MiddleLeg): SurebetOdd => ({
  option: leg.option,
  price: leg.price,
  size: leg.size,
  bookmaker: leg.bookmaker,
  eventId: leg.eventId,
  market: leg.market,
  rawMarket: leg.rawMarket,
  rawSelection: leg.rawSelection,
  handicap: leg.line,
  link: leg.link,
  historyPrice: [],
  otherOdds: [],
});

export const toSurebetEvent = (g: MiddleData): SurebetData => ({
  id: g.id,
  sport: g.sport,
  league: g.league,
  home: g.home,
  away: g.away,
  date: g.date,
  surebets: [],
  update_at: g.update_at,
  create_at: g.create_at,
});

// Adapta o middle para o shape Surebet (p/ reusar o SurebetActionsMenu: report +
// ocultar + exclusão admin). O backend já honra as exclusões nos middles.
export const toSurebet = (m: Middle): Surebet => ({
  coefficient: m.coefficient,
  profitMargin: m.ev,
  marketTypes: [m.market],
  surebet: m.legs.map(toSurebetLeg),
  update_at: '',
  create_at: '',
});

// Shape de perna que o useHiddenSet espera (handicap = linha). Usado p/ filtrar
// na página com as MESMAS chaves que o menu gera (via toSurebetLeg).
export const toHiddenLeg = (l: MiddleLeg) => ({
  eventId: l.eventId,
  bookmaker: l.bookmaker,
  market: l.market,
  option: l.option,
  handicap: l.line,
});
