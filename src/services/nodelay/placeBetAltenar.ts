/**
 * Disparo REAL da aposta numa casa biahosted (Altenar) — CLIENT-SIDE.
 *
 * O 403 NUNCA foi WAF/origin — era TOKEN errado: o `placeWidget` exige um **SB2
 * token do Altenar** (`iss:SB2`), não o JWT do login. Provado: com o SB2 token o
 * gateway responde 200 (até de origin=localhost). Então o BROWSER dispara direto
 * (residencial, sem hop no backend, IP-consistente com o SB2). O SB2 vem cacheado
 * do `sb2Token` (cadeia openSportsBook+SignIn, 1x por ~25min) → o fire é só o POST.
 *
 * Devolve o MESMO `BetResult` do disparo fssb, pra o slip tratar igual.
 */
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { BetResult } from '@/services/nodelay/placeBet';
import { getSb2Token, invalidateSb2, biaBetUrl } from '@/services/nodelay/sb2Token';

// dbId não vem no read API (confirmado nos dois sentidos do placeWidget) → constante.
const ALTENAR_DB_ID = 10;

/** Ticket do placeWidget (1 seleção) — o `betMarket`. */
export interface AltenarTicket {
  eventId: number;
  dbId: number;
  sportName: string;
  eventName: string;
  catName: string;
  champName: string;
  sportTypeId: number;
  selection: {
    selectionId: number;
    marketId: number;
    price: number;
    marketName: string;
    marketTypeId: number;
    selectionTypeId: number;
    selectionName: string;
    /** Linha (over/under/handicap) = `sv` da odd. Só em mercado com linha (ex.: "1.5"). */
    sPOV?: string;
  };
}

/** Monta o ticket Altenar a partir do detalhe + mercado + seleção (odd da casa). */
export function buildAltenarTicket(detail: LiveGameDetail, m: LiveMarket, s: LiveSelection, price: number): AltenarTicket {
  return {
    eventId: Number(detail.id),
    dbId: ALTENAR_DB_ID,
    sportName: detail.sportName,
    eventName: `${detail.home} vs. ${detail.away}`,
    catName: detail.regionName,
    champName: detail.competitionName,
    sportTypeId: detail.sportOrder, // = sport.typeId (1 = futebol)
    selection: {
      selectionId: Number(s.id),
      marketId: Number(m.id),
      price,
      marketName: m.name,
      marketTypeId: Number(m.marketTypeId),
      selectionTypeId: s.selectionTypeId ?? 0,
      selectionName: s.name,
      sPOV: s.line ?? undefined,
    },
  };
}

const reqId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);

/** Monta o corpo do placeWidget (omite sPOV quando não há linha). */
function bodyOf(ticket: AltenarTicket, integration: string, stake: number): Record<string, unknown> {
  const s = ticket.selection;
  return {
    culture: 'pt-BR', timezoneOffset: 180, integration, deviceType: 1, numFormat: 'en-GB', countryCode: 'BR',
    betType: 0, isAutoCharge: false, stakes: [stake], oddsChangeAction: 3,
    betMarkets: [{
      id: ticket.eventId, isBanker: false, dbId: ticket.dbId, sportName: ticket.sportName, rC: false,
      eventName: ticket.eventName, catName: ticket.catName, champName: ticket.champName, sportTypeId: ticket.sportTypeId,
      odds: [{
        id: s.selectionId,
        ...(s.sPOV ? { sPOV: s.sPOV } : {}),
        marketId: s.marketId, price: s.price, marketName: s.marketName, marketTypeId: s.marketTypeId,
        mostBalanced: false, selectionTypeId: s.selectionTypeId, selectionName: s.selectionName,
        widgetInfo: { widget: 12, page: 4, tabIndex: 2, tipsterId: null, suggestionType: null },
      }],
    }],
    eachWays: [false], requestId: reqId(), confirmedByClient: false, device: 0,
  };
}

/** Dispara pelo browser (nunca REJEITA — devolve BetResult(ok:false) em erro). */
export async function placeBetAltenar(account: NoDelayAccount, house: NoDelayBookmaker, ticket: AltenarTicket, stake: number): Promise<BetResult> {
  const started = performance.now();
  const fallbackOdds = ticket.selection.price;
  const fail = (error: string): BetResult => ({ ok: false, elapsedMs: performance.now() - started, stake, odds: fallbackOdds, partial: false, oddsChanged: false, error });

  const betUrl = biaBetUrl(house);
  const integration = house.integration || house.slug;
  if (!betUrl) return fail('Casa sem gateway de apostas configurado.');

  const doPost = async (token: string) => fetch(`${betUrl}/api/widget/placeWidget`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(bodyOf(ticket, integration, stake)),
    cache: 'no-store',
  });

  try {
    let sb2 = await getSb2Token(account, house);
    let res = await doPost(sb2);
    // Token vencido/inválido → invalida o cache, pega um novo e tenta 1x.
    if (res.status === 401 || res.status === 403) {
      invalidateSb2(account.id);
      sb2 = await getSb2Token(account, house, true);
      res = await doPost(sb2);
    }
    const elapsedMs = performance.now() - started;

    const parsed = (await res.json().catch(() => null)) as
      | { bets?: Array<{ id?: number | string; totalStake?: number; totalOdds?: number }>; error?: { errorStringCode?: string }; message?: string }
      | null;
    const bet = parsed?.bets?.[0];
    if (!res.ok || !bet || bet.id == null) {
      const msg = parsed?.error?.errorStringCode || parsed?.message || `aposta falhou (status ${res.status})`;
      return { ok: false, elapsedMs, stake, odds: fallbackOdds, partial: false, oddsChanged: false, error: String(msg).slice(0, 200) };
    }
    return { ok: true, elapsedMs, stake: bet.totalStake ?? stake, odds: bet.totalOdds ?? fallbackOdds, partial: false, oddsChanged: false, receiptId: String(bet.id) };
  } catch (e) {
    return fail((e as Error)?.message || 'Falha de rede.');
  }
}
