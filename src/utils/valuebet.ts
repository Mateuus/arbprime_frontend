// Helpers de value bet (apostas de valor): cor do edge, selo de tier/ref,
// rótulo de seleção e adaptador p/ reusar OpenInHouse (tipado em SurebetOdd).
import { ValuebetEmission, ValuebetGroup } from '@/interfaces/valuebet.interface';
import { SurebetData, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { marketLabel, optionLabel } from '@/utils/surebet';

// Cor do badge de edge por faixa (doc §6.4): 2–5% amarelo, 5–10% verde,
// 10–15% verde forte. O teto é 15% (acima é descartado na origem como erro).
export const edgeTone = (pct: number): string => {
  if (pct >= 10) return 'text-emerald-300 bg-emerald-500/20 ring-emerald-500/40';
  if (pct >= 5) return 'text-emerald-300 bg-emerald-500/12 ring-emerald-500/30';
  if (pct >= 2) return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
  return 'text-gray-300 bg-white/5 ring-white/10';
};

// Selo de origem da "verdade" (doc §6.1): T1 Pinnacle, T2 Pinnacle·sec., T3 Consenso.
export const tierMeta = (tier: number, _ref?: string): { label: string; className: string } => {
  if (tier === 1) return { label: 'Pinnacle', className: 'text-emerald-300 bg-emerald-500/12 ring-emerald-500/30' };
  if (tier === 2) return { label: 'Pinnacle · sec.', className: 'text-sky-300 bg-sky-500/12 ring-sky-500/30' };
  return { label: 'Consenso', className: 'text-gray-300 bg-white/5 ring-white/15' };
};

// Cor do juice/margem da casa (doc 11 §6.1). ATENÇÃO: escala INVERTIDA do edge —
// MENOR é melhor (mercado mais honesto). Recebe FRAÇÃO (0.0669); <6% verde,
// 6–9% amarelo, >9% vermelho.
export const houseVigTone = (frac: number): string => {
  const pct = frac * 100;
  if (pct < 6) return 'text-emerald-300 bg-emerald-500/12 ring-emerald-500/30';
  if (pct <= 9) return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
  return 'text-rose-300 bg-rose-500/15 ring-rose-500/30';
};

// Juice/vig (fração 0..1) → "6,7%". Vírgula decimal (pt-BR).
export const fmtVigPct = (frac: number, digits = 1): string => `${(frac * 100).toFixed(digits).replace('.', ',')}%`;

// Cor da confiança (0..1): combina com o tier (T1 alta, T3 baixa).
export const confidenceTone = (c: number): string => {
  if (c >= 0.6) return 'bg-emerald-400';
  if (c >= 0.4) return 'bg-amber-400';
  return 'bg-rose-400';
};

// Rótulo da seleção: prefere o nome cru da casa (rawSelection) quando vier;
// senão traduz o canônico (home/away/draw, Mais/Menos…) com a linha (handicap).
export const valuebetSelectionLabel = (vb: ValuebetEmission, home?: string, away?: string): string => {
  const raw = (vb.rawSelection || '').trim();
  if (raw) return raw;
  return optionLabel(vb.selection, home, away, vb.handicap ?? null);
};

// Nome do mercado: prefere rawMarket da casa; senão o catálogo.
export const valuebetMarketLabel = (vb: ValuebetEmission): string => {
  const raw = (vb.rawMarket || '').trim();
  if (raw) return raw;
  return marketLabel(vb.market);
};

/**
 * Adapta uma emissão de value bet (+grupo) para os formatos SurebetOdd/SurebetData
 * que o OpenInHouse espera, reaproveitando deep-link/extensão sem forkar o componente.
 * É aposta única, então `historyPrice`/`otherOdds` ficam vazios.
 */
export const toSurebetLeg = (vb: ValuebetEmission): SurebetOdd => ({
  option: vb.selection,
  price: vb.odd,
  bookmaker: vb.bookmaker,
  eventId: vb.eventId,
  market: vb.market,
  rawMarket: vb.rawMarket,
  rawSelection: vb.rawSelection,
  handicap: vb.handicap ?? null,
  link: vb.link,
  historyPrice: [],
  otherOdds: [],
});

export const toSurebetEvent = (g: ValuebetGroup): SurebetData => ({
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
