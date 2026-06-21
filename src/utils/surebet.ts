// Helpers de surebet compartilhados (rótulos de mercado/seleção e calculadora).
import { MARKET_NAMES, MARKET_NAMES_BY_SLUG } from './marketCatalog';

// Nome real do mercado: tenta o id exato ('slug:subId'), depois por slug, senão o cru.
export const marketLabel = (marketId: string): string => {
  if (!marketId) return '—';
  if (MARKET_NAMES[marketId]) return MARKET_NAMES[marketId];
  const slug = marketId.split(':')[0];
  return MARKET_NAMES_BY_SLUG[slug] || marketId;
};

// Categoria do mercado (para filtro/busca), mesma lógica da página de detalhe.
export const marketCategory = (marketId: string): string => {
  const slug = (marketId || '').split(':')[0];
  if (slug.includes('card')) return 'cartoes';
  if (slug.includes('corner')) return 'escanteios';
  if (slug.includes('shot')) return 'chutes';
  if (slug.includes('offside')) return 'impedimentos';
  if (slug.includes('goal') || slug === 'both-teams-to-score') return 'gols';
  if (slug.includes('asian-handicap')) return 'handicap';
  return 'resultado';
};

// Rótulo da seleção (option) no contexto do evento.
export const optionLabel = (option: string, home?: string, away?: string): string => {
  const o = (option || '').trim();
  const low = o.toLowerCase();
  if (low === 'home') return home || 'Casa';
  if (low === 'away') return away || 'Fora';
  if (low === 'draw') return 'Empate';
  if (low === 'yes') return 'Sim';
  if (low === 'no') return 'Não';
  if (low === '1x') return '1X';
  if (low === '12') return '12';
  if (low === 'x2') return 'X2';
  if (low.startsWith('mais')) return o.replace(/^mais\*?/i, 'Mais ').trim();
  if (low.startsWith('menos')) return o.replace(/^menos\*?/i, 'Menos ').trim();
  return o; // handicaps (H1(-0.5)) e demais ficam como estão
};

export interface StakeResult {
  stakes: number[];
  returns: number[];
  expected: number;   // retorno garantido (pior caso)
  profit: number;     // lucro líquido
  profitPct: number;  // lucro %
  sumInverse: number; // coeficiente
}

// Divisão de stakes proporcional a 1/odd (mesma fórmula do backend/arbbetting).
export const calcStakes = (odds: number[], base: number): StakeResult => {
  const valid = odds.map((o) => Number(o)).filter((o) => Number.isFinite(o) && o > 0);
  const inv = valid.map((o) => 1 / o);
  const sumInverse = inv.reduce((a, b) => a + b, 0) || 1;
  const stakes = inv.map((i) => (base * i) / sumInverse);
  const returns = stakes.map((s, i) => s * valid[i]);
  const expected = returns.length ? Math.min(...returns) : 0;
  const profit = expected - base;
  return { stakes, returns, expected, profit, profitPct: base ? (profit / base) * 100 : 0, sumInverse };
};

// Cor do lucro conforme a faixa (verde forte = melhor; negativa = vermelho).
export const profitTone = (pct: number): string => {
  if (pct < 0) return 'text-rose-300 bg-rose-500/15 ring-rose-500/30';
  if (pct >= 3) return 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/30';
  if (pct >= 1) return 'text-teal-300 bg-teal-500/15 ring-teal-500/30';
  if (pct > 0) return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
  return 'text-gray-300 bg-white/5 ring-white/10';
};
