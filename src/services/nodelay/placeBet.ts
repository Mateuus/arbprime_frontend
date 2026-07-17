/**
 * Disparo da aposta no NoDelay.
 *
 * ⚠️ HOJE É MOCK (por decisão: validar a UI/fluxo antes do place real). O lugar
 * do real está marcado em `placeBet` — troca só o miolo:
 *   POST https://prod20563.fssb.io/api/rogue/v1/betting/placeBets
 *   headers: authorization: Bearer <internalJwt LOGADO da conta>, Origin: <site>
 *   (precede: /betting/calculateBets; body com Selections[{Id}] + Bets[{Stake,…}])
 * O internalJwt logado sai da troca swarmAuthToken→internalJwt no nosso backend,
 * por conta (fase 3). Cada conta faz o SEU post — daí os bilhetes em paralelo.
 */
import { NoDelayAccount } from '@/interfaces/nodelay.interface';

export interface BetTicket {
  eventId: string;
  eventName: string;   // "CA Sarmiento x Boca Juniors"
  marketName: string;  // "Próximo gol (Gol 3)"
  selectionId: string; // _id apostável da rogue
  selectionName: string;
  odds: number;
  line: string | null; // BetslipLine ("Mais de 2.5")
  points: number | null; // linha numérica (2.5) — p/ montar o cupom local (modo rápido)
  score?: string;      // "0 - 2"
  clock?: string;      // "92'"
}

export interface BetPlaceOptions {
  stake: number;
  allowPartial: boolean;
  acceptOddsChange: boolean;
  /** Host da rogue da casa onde a conta aposta (só o place real usa). */
  rogueUrl?: string;
}

export interface BetResult {
  ok: boolean;
  /** Tempo de resposta em MS (o cronômetro converte p/ segundos no fim). */
  elapsedMs: number;
  stake: number;        // efetivo (pode ser menor se fracionou)
  odds: number;         // efetivo (pode ter mudado)
  partial: boolean;     // a casa pegou só uma parte
  oddsChanged: boolean; // a odd mudou entre o clique e o place
  receiptId?: string;
  error?: string;       // preenchido quando ok=false
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * MOCK: simula o place com latência realista (ms) e alguns caminhos reais —
 * odd mudou, casa limitou o stake — para a UI já tratar todos os casos.
 */
export async function placeBet(
  _account: NoDelayAccount,
  ticket: BetTicket,
  opts: BetPlaceOptions,
): Promise<BetResult> {
  const startedAt = performance.now();
  // Latência típica de um place ao vivo (varia por conta/rede).
  const latency = rand(180, 1400);
  await new Promise((r) => setTimeout(r, latency));
  const elapsedMs = performance.now() - startedAt;

  // ~8% a casa recusa por outro motivo.
  if (Math.random() < 0.08) {
    return {
      ok: false, elapsedMs, stake: opts.stake, odds: ticket.odds,
      partial: false, oddsChanged: false, error: 'Recusada pela casa',
    };
  }

  // ~15% a odd muda no momento do place.
  let odds = ticket.odds;
  let oddsChanged = false;
  if (Math.random() < 0.15) {
    oddsChanged = true;
    odds = Math.max(1.01, +(ticket.odds + rand(-0.1, 0.08)).toFixed(2));
    if (!opts.acceptOddsChange) {
      return {
        ok: false, elapsedMs, stake: opts.stake, odds,
        partial: false, oddsChanged: true, error: 'Odd mudou',
      };
    }
  }

  // ~12% a casa limita o stake.
  let stake = opts.stake;
  let partial = false;
  if (Math.random() < 0.12) {
    const cap = +(opts.stake * rand(0.3, 0.85)).toFixed(2);
    if (!opts.allowPartial) {
      return {
        ok: false, elapsedMs, stake: opts.stake, odds,
        partial: false, oddsChanged, error: 'Limite da casa excedido',
      };
    }
    partial = true;
    stake = cap;
  }

  return {
    ok: true, elapsedMs, stake, odds, partial, oddsChanged,
    receiptId: `MOCK-${Math.floor(rand(1e7, 9e7))}`,
  };
}
