import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { BetTicket, BetResult } from '@/services/nodelay/placeBet';
import { apiGateway } from '@/gateways/api.gateway';
import { captureBet365UserContext } from '@/utils/bet365UserContext';

/**
 * Aposta na BET365 — SERVER-SIDE (≠ swarm/Altenar client-side). O disparo é addbet→placebet
 * 100% headless no backend (mint do token nst + curl_cffi; ver @arbprime/bet365-nst): o browser
 * não consegue montar o token nem passar o Cloudflare. Aqui só chamamos
 * `POST /nodelay/accounts/:id/bet365-bet` com o `placeable` da odd ({ selectionId=fp, mt, odd })
 * + o eventId da casa + a linha (handicap). Mercados apostáveis hoje: 1X2 e Total de Gols.
 */
export async function placeBetBet365(
  account: NoDelayAccount,
  ticket: BetTicket,
  opts: {
    stake: number;
    placeable: Record<string, unknown>;
    eventId: string;
    line?: string;
    acceptOddsChange: boolean;
  },
): Promise<BetResult> {
  const start = performance.now();
  try {
    // ipv6 (WebRTC) + geo (geolocation) REAIS do usuário → o nst da aposta fica autêntico (cacheado/rápido)
    const userCtx = await captureBet365UserContext();
    const res = await apiGateway.placeBet365Bet(account.id, {
      eventId: opts.eventId,
      placeable: opts.placeable,
      line: opts.line,
      stake: opts.stake,
      acceptOddsChange: opts.acceptOddsChange,
      ipv6: userCtx.ipv6,
      geo: userCtx.geo,
    });
    const elapsedMs = Math.round(performance.now() - start);
    const d = res?.data as { result?: number; message?: string; data?: { betId?: string; placedOdds?: string; error?: string } } | undefined;
    const data = d?.data || {};
    if (d?.result === 1) {
      return { ok: true, elapsedMs, stake: opts.stake, odds: ticket.odds, partial: false, oddsChanged: false, receiptId: data.betId };
    }
    // result === 2 → a odd MUDOU e o usuário não tinha aceitado: pede confirmação (mostra de X → Y).
    const dd = data as { oddsChanged?: boolean; oldOdds?: string | number; newOdds?: string | number; error?: string };
    if (d?.result === 2 && dd.oddsChanged) {
      return { ok: false, elapsedMs, stake: 0, odds: ticket.odds, partial: false, oddsChanged: true, needsOddsConfirm: true, oldOdds: dd.oldOdds, newOdds: dd.newOdds, error: `Odd mudou de ${dd.oldOdds} para ${dd.newOdds}` };
    }
    return { ok: false, elapsedMs, stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error: d?.message || dd.error || 'Aposta recusada pela bet365.' };
  } catch (e) {
    return { ok: false, elapsedMs: Math.round(performance.now() - start), stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error: (e as Error)?.message || 'Falha de rede ao apostar na bet365.' };
  }
}
