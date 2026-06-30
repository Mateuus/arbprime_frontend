// Matemática do Duas Vidas (frontend) — espelha o robô (arbbetting_master: valuebet.ts +
// process-duasvidas). Tudo puro: a calculadora usa p/ RECOMPUTAR ao editar odds/stakes ou
// escolher outro 2º jogo no picker.

export type DevigMethod = 'multiplicative' | 'power';

/** De-vig multiplicativo (proporcional): p_i = (1/odd_i) / Σ(1/odd_j). */
export function devigMultiplicative(odds: number[]): { probs: number[]; vig: number } {
  const inv = odds.map((o) => 1 / o);
  const sum = inv.reduce((a, b) => a + b, 0) || 1;
  return { probs: inv.map((x) => x / sum), vig: sum - 1 };
}

/** De-vig power: acha k com Σ(1/odd)^k = 1 (corrige viés favorito-zebra). Bisseção. */
export function devigPower(odds: number[]): { probs: number[]; vig: number } {
  const inv = odds.map((o) => 1 / o);
  const f = (k: number) => inv.reduce((s, x) => s + Math.pow(x, k), 0) - 1;
  const f1 = f(1);
  if (!Number.isFinite(f1) || Math.abs(f1) < 1e-9) return devigMultiplicative(odds);
  let lo: number, hi: number;
  if (f1 > 0) {
    lo = 1; hi = 2; let it = 0;
    while (f(hi) > 0 && it < 60) { hi *= 2; it++; }
  } else { hi = 1; lo = 1e-6; }
  let mid = 1;
  for (let i = 0; i < 80; i++) {
    mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-12) break;
    if (fm > 0) lo = mid; else hi = mid;
  }
  const p0 = inv.map((x) => Math.pow(x, mid));
  const s = p0.reduce((a, b) => a + b, 0) || 1;
  return { probs: p0.map((p) => p / s), vig: f1 };
}

export function devig(odds: number[], method: DevigMethod = 'power') {
  return method === 'power' ? devigPower(odds) : devigMultiplicative(odds);
}

/** Favorito de um 1X2 (home/away mais provável) + sua prob justa (empate ignorado). */
export function favoriteOf(o1: number, oX: number, o2: number, method: DevigMethod = 'power') {
  const { probs } = devig([o1, oX, o2], method);
  const pHome = probs[0] ?? 0;
  const pAway = probs[2] ?? 0;
  return pHome >= pAway
    ? { side: 'home' as const, prob: pHome }
    : { side: 'away' as const, prob: pAway };
}

export interface DvMetricsInput {
  coverFavOdd: number; // favorito do jogo principal (cobertura)
  drawOdd: number;     // empate (cobertura)
  zebraOdd: number;    // zebra (1ª seleção da múltipla)
  boosterOdd: number;  // favorito-2 (2ª seleção da múltipla)
  p2: number;          // prob justa da zebra
  pg: number;          // prob justa do favorito-2
}

export interface DvMetrics {
  parlayOdd: number;            // b = zebra × booster
  coefficient: number;          // S = Σ 1/odd
  apparentMargin: number;       // M % (o gancho)
  pLoss: number;                // % — zebra vence, favorito-2 falha
  trueEV: number;               // % — EV = M − p_loss(1+M)
  parlayFairOdd: number | null; // 1/(p2·pg) — a odd justa da múltipla
  parlayEdge: number | null;    // % — (b·p2·pg − 1)
  boosterEdge: number | null;   // % — (booster·pg − 1)
}

/**
 * Núcleo do Duas Vidas. EV honesto: a margem aparente trata a múltipla como perna única,
 * mas ela só paga se zebra E favorito-2 vencerem; o resto perde. (O PA do favorito-2 só
 * joga a favor — pg real ≥ pg, então este p_loss é o PIOR caso.)
 */
export function dvMetrics(inp: DvMetricsInput): DvMetrics {
  const { coverFavOdd, drawOdd, zebraOdd, boosterOdd, p2, pg } = inp;
  const parlayOdd = zebraOdd * boosterOdd;
  const S = 1 / coverFavOdd + 1 / drawOdd + 1 / parlayOdd;
  const m = 1 / S - 1;
  const pLossFrac = p2 * (1 - pg);
  const trueEV = m - pLossFrac * (1 + m);
  const denom = p2 * pg;
  return {
    parlayOdd,
    coefficient: S,
    apparentMargin: m * 100,
    pLoss: pLossFrac * 100,
    trueEV: trueEV * 100,
    parlayFairOdd: denom > 0 ? 1 / denom : null,
    parlayEdge: denom > 0 ? (parlayOdd * denom - 1) * 100 : null,
    boosterEdge: pg > 0 ? (boosterOdd * pg - 1) * 100 : null,
  };
}

/**
 * Hedge / janela de seguro: se o 2º jogo começa ANTES e o favorito-2 está perdendo, dá p/
 * recuperar o total `T` comprometido apostando no principal AO VIVO. h_i = T / odd_live.
 * Recupera 100% se 1/H + 1/D ≤ 1; senão trava uma perda controlada.
 */
export function hedgeStakes(total: number, liveHomeOdd: number, liveDrawOdd: number) {
  const h1 = liveHomeOdd > 0 ? total / liveHomeOdd : 0;
  const hX = liveDrawOdd > 0 ? total / liveDrawOdd : 0;
  const outlay = h1 + hX;
  return { h1, hX, outlay, net: total - outlay, recovers: outlay <= total + 1e-9 };
}

// ── Tons (cores) ──
/** Margem aparente: gancho. >=0 verde, perto de zero âmbar, negativo rose. */
export const apparentTone = (pct: number): string => {
  if (pct >= 0) return 'text-emerald-300 bg-emerald-500/15 ring-emerald-500/30';
  if (pct >= -2) return 'text-amber-300 bg-amber-500/15 ring-amber-500/30';
  return 'text-rose-300 bg-rose-500/15 ring-rose-500/30';
};
/** EV honesto: realista. */
export const evTone = (pct: number): string => {
  if (pct >= 1) return 'text-emerald-300';
  if (pct >= -1) return 'text-amber-300';
  return 'text-rose-300';
};
/** Probabilidade de perda: menor = melhor (verde). */
export const lossTone = (pct: number): string => {
  if (pct <= 3) return 'text-emerald-300';
  if (pct <= 7) return 'text-amber-300';
  return 'text-rose-300';
};
/** Valor (edge do booster / parlay): >0 verde. */
export const valueTone = (pct: number | null | undefined): string => {
  if (pct == null) return 'text-gray-400';
  if (pct >= 2) return 'text-emerald-300';
  if (pct >= 0) return 'text-teal-300';
  return 'text-rose-300';
};
