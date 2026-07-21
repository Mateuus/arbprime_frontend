import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { BetTicket, BetResult } from '@/services/nodelay/placeBet';
import { apiGateway } from '@/gateways/api.gateway';

/**
 * Aposta na SUPERBET — SERVER-SIDE (≠ swarm/Altenar que são client-side). O host de
 * aposta (betler) é WAF e a sessão (cookies+device) mora no cofre do backend, então
 * o browser NÃO consegue postar direto. Aqui só chamamos a rota
 * `POST /nodelay/accounts/:id/superbet-bet` — o backend reidrata a sessão, resolve o
 * WAF e submete o ticket (submitTicket). `ticket.selectionId` = o `uuid` da odd.
 */
export async function placeBetSuperbet(
  account: NoDelayAccount,
  ticket: BetTicket,
  opts: { stake: number; betType: 'prematch' | 'live'; acceptOddsChange: boolean },
): Promise<BetResult> {
  const start = performance.now();
  try {
    const res = await apiGateway.placeSuperbetBet(account.id, {
      eventId: ticket.eventId,
      oddUuid: ticket.selectionId,
      stake: opts.stake,
      betType: opts.betType,
      autoAccept: opts.acceptOddsChange,
    });
    const elapsedMs = Math.round(performance.now() - start);
    const d = res?.data as { result?: number; message?: string; data?: { ok?: boolean; placedOdds?: number; ticketId?: string; error?: string } } | undefined;
    const data = d?.data || {};
    if (d?.result === 1 && data.ok) {
      const placed = Number(data.placedOdds) || ticket.odds;
      return { ok: true, elapsedMs, stake: opts.stake, odds: placed, partial: false, oddsChanged: placed !== ticket.odds, receiptId: data.ticketId };
    }
    return { ok: false, elapsedMs, stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error: d?.message || data.error || 'Aposta recusada pela Superbet.' };
  } catch (e) {
    return { ok: false, elapsedMs: Math.round(performance.now() - start), stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error: (e as Error)?.message || 'Falha de rede ao apostar na Superbet.' };
  }
}
