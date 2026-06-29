// Recálculo do MIDDLE com COMISSÃO de exchange (ex.: Betbra/Betfair). O robô
// calcula tudo com odd BRUTA e não conhece comissão; aqui refletimos a comissão
// (incide só sobre o LUCRO da perna que vence → "odd efetiva") nas métricas.
//
// É um port fiel da matemática do arbbetting_master (utils/middle.ts): liquidação
// over/under (totais, Poisson) e handicap asiático (margem, Skellam por convolução),
// usando o λ/λ_casa/λ_fora que JÁ vêm no payload. As stakes seguem o stakePct do
// robô (distribuídas pela odd bruta) — a comissão só reduz o RETORNO, igual à
// calculadora das surebets. Sem comissão, devolvemos os números do robô (sem drift).
import { Middle, MiddleLeg } from '@/interfaces/middle.interface';
import { isHandicap } from '@/utils/middle';

type LineKind = 'whole' | 'half' | 'quarter' | 'other';

function lineKind(line: number): LineKind {
  if (!Number.isFinite(line)) return 'other';
  const f = Math.abs(line) % 1;
  if (f < 1e-9) return 'whole';
  if (Math.abs(f - 0.5) < 1e-9) return 'half';
  if (Math.abs(f - 0.25) < 1e-9 || Math.abs(f - 0.75) < 1e-9) return 'quarter';
  return 'other';
}

function settleWholeOrHalf(side: 'over' | 'under', line: number, goals: number): 'win' | 'loss' | 'push' {
  if (lineKind(line) === 'whole' && goals === line) return 'push';
  const overWins = goals > line;
  if (side === 'over') return overWins ? 'win' : 'loss';
  return overWins ? 'loss' : 'win';
}

function settleTotals(side: 'over' | 'under', line: number, goals: number): { won: number; lost: number } {
  if (lineKind(line) === 'quarter') {
    let won = 0;
    let lost = 0;
    for (const hl of [line - 0.25, line + 0.25]) {
      const r = settleWholeOrHalf(side, hl, goals);
      if (r === 'win') won += 0.5;
      else if (r === 'loss') lost += 0.5;
    }
    return { won, lost };
  }
  const r = settleWholeOrHalf(side, line, goals);
  if (r === 'win') return { won: 1, lost: 0 };
  if (r === 'loss') return { won: 0, lost: 1 };
  return { won: 0, lost: 0 };
}

function settleAdvantage(a: number): { won: number; lost: number } {
  if (lineKind(a) === 'quarter') {
    let won = 0;
    let lost = 0;
    for (const h of [a - 0.25, a + 0.25]) {
      if (h > 1e-9) won += 0.5;
      else if (h < -1e-9) lost += 0.5;
    }
    return { won, lost };
  }
  if (a > 1e-9) return { won: 1, lost: 0 };
  if (a < -1e-9) return { won: 0, lost: 1 };
  return { won: 0, lost: 0 };
}

function poissonPmfArray(lambda: number, kmax: number): number[] {
  const arr = new Array(kmax + 1);
  let p = Math.exp(-lambda);
  arr[0] = p;
  for (let k = 1; k <= kmax; k++) {
    p = (p * lambda) / k;
    arr[k] = p;
  }
  return arr;
}

function marginPmf(lambdaHome: number, lambdaAway: number): { mMin: number; probs: number[] } {
  const kh = Math.max(15, Math.ceil(lambdaHome + 12 * Math.sqrt(lambdaHome + 1)));
  const ka = Math.max(15, Math.ceil(lambdaAway + 12 * Math.sqrt(lambdaAway + 1)));
  const ph = poissonPmfArray(lambdaHome, kh);
  const pa = poissonPmfArray(lambdaAway, ka);
  const mMin = -ka;
  const probs = new Array(kh - mMin + 1).fill(0);
  for (let h = 0; h <= kh; h++) for (let a = 0; a <= ka; a++) probs[h - a - mMin] += ph[h] * pa[a];
  return { mMin, probs };
}

/** Odd efetiva: comissão (fração 0..1) incide só sobre o lucro. */
export const effOdd = (odd: number, frac: number): number => (odd > 0 ? 1 + (odd - 1) * (1 - frac) : 0);

type Dist = { kind: 'totals'; lambda: number } | { kind: 'handicap'; lambdaHome: number; lambdaAway: number };

function buildDist(m: Middle): Dist | null {
  if (isHandicap(m)) {
    if (m.lambdaHome == null || m.lambdaAway == null) return null;
    return { kind: 'handicap', lambdaHome: m.lambdaHome, lambdaAway: m.lambdaAway };
  }
  if (!(m.lambda > 0)) return null;
  return { kind: 'totals', lambda: m.lambda };
}

interface EvalLeg { stake: number; odd: number; frac: number; side: MiddleLeg['side']; line: number }
export interface EvalResult { ev: number; pGap: number; pProfit: number; best: number; worst: number }

/**
 * Núcleo: dado o conjunto de pernas (stake na unidade que quiser — % ou R$),
 * a odd, a comissão (fração) e a linha de cada uma, e a distribuição (λ), devolve
 * EV / P(miolo) / P(lucro) / melhor caso / pior caso na MESMA unidade das stakes.
 */
function evaluate(legs: EvalLeg[], dist: Dist): EvalResult {
  const eff = legs.map((l) => effOdd(l.odd, l.frac));
  let ev = 0;
  let pGap = 0;
  let pProfit = 0;
  let best = -Infinity;
  let worst = Infinity;

  const accumulate = (p: number, wons: number[], losts: number[]) => {
    let net = 0;
    let allWin = true;
    for (let j = 0; j < legs.length; j++) {
      net += legs[j].stake * wons[j] * (eff[j] - 1) - legs[j].stake * losts[j];
      if (!(wons[j] > 1e-9)) allWin = false;
    }
    ev += p * net;
    if (net > 1e-9) pProfit += p;
    if (allWin) pGap += p;
    if (net > best) best = net;
    if (net < worst) worst = net;
  };

  if (dist.kind === 'totals') {
    const kmax = Math.max(20, Math.ceil(dist.lambda + 12 * Math.sqrt(dist.lambda + 1)));
    const pmf = poissonPmfArray(dist.lambda, kmax);
    for (let k = 0; k <= kmax; k++) {
      const wons: number[] = [];
      const losts: number[] = [];
      for (const l of legs) {
        const s = settleTotals(l.side === 'under' ? 'under' : 'over', l.line, k);
        wons.push(s.won);
        losts.push(s.lost);
      }
      accumulate(pmf[k], wons, losts);
    }
  } else {
    const { mMin, probs } = marginPmf(dist.lambdaHome, dist.lambdaAway);
    for (let i = 0; i < probs.length; i++) {
      const M = mMin + i;
      const wons: number[] = [];
      const losts: number[] = [];
      for (const l of legs) {
        const adv = l.side === 'home' ? M + l.line : -M + l.line;
        const s = settleAdvantage(adv);
        wons.push(s.won);
        losts.push(s.lost);
      }
      accumulate(probs[i], wons, losts);
    }
  }
  return { ev, pGap, pProfit, best, worst };
}

const clampFrac = (pct: number) => Math.max(0, Math.min(0.99, (pct || 0) / 100));

export interface MiddleMetrics {
  ev: number;
  pGap: number;
  pProfit: number;
  profitIfHit: number;
  lossIfMiss: number;
  adjusted: boolean; // true = recalculado por comissão de alguma casa
}

/**
 * Métricas (% da banca) ajustadas pela comissão das casas. Sem comissão em
 * nenhuma perna, devolve os números do robô (passthrough — zero drift).
 * `commPct(slug)` → comissão da casa em PERCENTUAL (ex.: 4.5), 0/undefined = sem.
 */
export function commissionAdjustedMetrics(m: Middle, commPct: (slug: string) => number | null | undefined): MiddleMetrics {
  const fracs = m.legs.map((l) => clampFrac(Number(commPct(l.bookmaker)) || 0));
  const adjusted = fracs.some((f) => f > 0);
  const passthrough: MiddleMetrics = {
    ev: m.ev, pGap: m.pGap, pProfit: m.pProfit, profitIfHit: m.profitIfHit, lossIfMiss: m.lossIfMiss, adjusted: false,
  };
  if (!adjusted) return passthrough;
  const dist = buildDist(m);
  if (!dist) return passthrough;

  const legs: EvalLeg[] = m.legs.map((l, i) => ({ stake: l.stakePct, odd: l.price, frac: fracs[i], side: l.side, line: l.line }));
  const r = evaluate(legs, dist);
  return { ev: r.ev, pGap: r.pGap * 100, pProfit: r.pProfit * 100, profitIfHit: r.best, lossIfMiss: r.worst, adjusted: true };
}

export interface MiddleMoney { ev: number; profitIfHit: number; lossIfMiss: number }

/**
 * Resultado em R$ (ou na unidade das stakes) usando as stakes REAIS (já
 * arredondadas, se for o caso) e a comissão. Para a calculadora.
 */
export function evaluateMoney(m: Middle, stakes: number[], commPct: (slug: string) => number | null | undefined): MiddleMoney | null {
  const dist = buildDist(m);
  if (!dist) return null;
  const legs: EvalLeg[] = m.legs.map((l, i) => ({ stake: stakes[i] || 0, odd: l.price, frac: clampFrac(Number(commPct(l.bookmaker)) || 0), side: l.side, line: l.line }));
  const r = evaluate(legs, dist);
  return { ev: r.ev, profitIfHit: r.best, lossIfMiss: r.worst };
}

/** Distribui o total proporcional a 1/odd (mesma divisão do robô; a comissão NÃO
 *  mexe na distribuição, só no retorno da casa que vence). */
export function balancedStakes(odds: number[], total: number): number[] {
  const inv = odds.map((o) => (o > 0 ? 1 / o : 0));
  const s = inv.reduce((a, b) => a + b, 0) || 1;
  return inv.map((i) => (total * i) / s);
}

/** Resultado em R$ para pernas EXPLÍCITAS (odd/comissão/stake já definidos) — usado
 *  quando o usuário TROCA a casa de uma perna na calculadora (odds diferentes do
 *  robô). O lado/linha continua o do middle (mesma seleção, casa diferente).
 *  `frac` é a comissão em FRAÇÃO (0..1). */
export function evaluateMiddleLegs(
  m: Middle,
  legs: { odd: number; frac: number; stake: number; side: MiddleLeg['side']; line: number }[],
): MiddleMoney | null {
  const dist = buildDist(m);
  if (!dist) return null;
  const r = evaluate(legs.map((l) => ({ stake: l.stake, odd: l.odd, frac: Math.max(0, Math.min(0.99, l.frac || 0)), side: l.side, line: l.line })), dist);
  return { ev: r.ev, profitIfHit: r.best, lossIfMiss: r.worst };
}
