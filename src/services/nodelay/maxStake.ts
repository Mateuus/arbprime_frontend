/**
 * Max stake (teto apostável) por seleção — derivado LOCALMENTE da SSE, sem chamar
 * API por tick. O `MaxBet` vem do `TemplateGroupSettings` da própria stream; o `K`
 * (fator do cliente: moeda/nível/grupo do JWT) sai de UMA calibração logada
 * (`calculateBets`) cacheada por conta.
 *
 * Fórmula (verbatim do bundle da casa — ver BRIEF-maxstake):
 *   W        = MaxBet × K                                   // teto de LUCRO líquido
 *   MaxStake = floor( W / (TrueOdds − 1) × 100 ) / 100      // o que a casa aceita
 * Usa TrueOdds (precisa), não DisplayOdds. O −0,01 de margem fica na UI/disparo.
 */
import { LiveMarket, LiveSelection, LiveGameDetail } from './rogueModel';
import { accountToken } from './placeBetReal';

/**
 * Teto apostável de uma seleção. null = sem limite conhecido / single bloqueado.
 * `driftPct` (0..1) infla a odd usada no cálculo → um teto CONSERVADOR que ainda
 * é aceito se a odd SUBIR até `driftPct` entre o cálculo e o placeBets (odd sobe
 * ⇒ teto da casa cai). 0 = teto exato (p/ exibir); ~0,02 no disparo.
 */
export function maxStakeOf(sel: LiveSelection, market: LiveMarket, k: number, driftPct = 0): number | null {
  const tgs = market.tplGroups[sel.tplIndex ?? 0];
  if (!tgs || tgs.singleEnabled === false) return null;
  if (!(sel.trueOdds > 1) || sel.disabled || market.suspended) return null;
  if (!(tgs.maxBet > 0) || !(k > 0)) return null;
  const odd = sel.trueOdds * (1 + driftPct);
  if (!(odd > 1)) return null;
  return Math.floor((tgs.maxBet * k) / (odd - 1) * 100) / 100;
}

/** Uma seleção ativa com MaxBet conhecido — amostra p/ calibrar o K. */
export function pickCalibrationSample(detail: LiveGameDetail | null): { sel: LiveSelection; market: LiveMarket } | null {
  if (!detail) return null;
  for (const m of detail.markets) {
    if (m.suspended || m.tplGroups.length === 0) continue;
    for (const s of m.selections) {
      const tgs = m.tplGroups[s.tplIndex ?? 0];
      if (tgs && tgs.singleEnabled !== false && tgs.maxBet > 0 && s.trueOdds > 1 && !s.disabled) {
        return { sel: s, market: m };
      }
    }
  }
  return null;
}

// K por conta (o limite é por-cliente). Recalibra a cada K_TTL.
const K_TTL_MS = 5 * 60_000;
const kCache = new Map<string, { k: number; at: number }>();

/** K já calibrado da conta (síncrono, p/ o cap no disparo). null = ainda não tem. */
export function cachedK(accountId: string): number | null {
  return kCache.get(accountId)?.k ?? null;
}

/**
 * K da conta: 1 `calculateBets` logado numa seleção ativa.
 *   K = MaxStake_api × (TrueOdds_api − 1) / MaxBet_da_SSE
 * Cacheado por conta (TTL 5min). Devolve o K anterior (ou null) se falhar — nunca
 * derruba um K bom por uma falha de rede.
 */
export async function getAccountK(
  rogueUrl: string,
  accountId: string,
  sample: { sel: LiveSelection; market: LiveMarket },
): Promise<number | null> {
  const cached = kCache.get(accountId);
  if (cached && Date.now() - cached.at < K_TTL_MS) return cached.k;

  const tgs = sample.market.tplGroups[sample.sel.tplIndex ?? 0];
  if (!tgs || !(tgs.maxBet > 0)) return cached?.k ?? null;

  let token: string;
  try {
    token = await accountToken(accountId);
  } catch {
    return cached?.k ?? null; // sessão caiu → mantém o K anterior
  }

  try {
    const res = await fetch(`${rogueUrl}/api/rogue/v1/betting/calculateBets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ Selections: [{ Id: sample.sel.id }], OddsStyle: 'decimal', Locale: 'br-pt' }),
    });
    const json = await res.json().catch(() => null);
    const bet = json?.Bets?.[0];
    const apiOdds = Number(bet?.TrueOdds);
    const apiMax = Number(bet?.MaxStake);
    if (apiOdds > 1 && apiMax > 0) {
      const k = (apiMax * (apiOdds - 1)) / tgs.maxBet;
      if (k > 0 && Number.isFinite(k)) {
        kCache.set(accountId, { k, at: Date.now() });
        return k;
      }
    }
  } catch {
    /* rede/challenge — mantém o K anterior */
  }
  return cached?.k ?? null;
}
