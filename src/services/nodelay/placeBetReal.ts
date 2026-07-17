/**
 * Disparo REAL da aposta na rogue (FSB) — o browser aposta direto da máquina do
 * usuário, com o token LOGADO da conta (troca swarmAuthToken→internalJwt no nosso
 * backend). Fluxo do site: calculateBets → placeBets (com retry do PotentialReturns).
 *
 * ⚠️ APOSTA DINHEIRO DE VERDADE. Ligado por um toggle temporário de teste. Mesma
 * assinatura do mock (placeBet) para ser drop-in.
 *
 * Endpoints (confirmados na análise do bundle):
 *   POST {rogue}/api/rogue/v1/betting/calculateBets  {Selections:[{Id}],OddsStyle,Locale}
 *   POST {rogue}/api/rogue/v1/betting/placeBets       {Selections,Bets,OddsStyle,AutoAcceptMode}
 */
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { BetTicket, BetPlaceOptions, BetResult } from '@/services/nodelay/placeBet';

// Token logado por conta (evita re-troca a cada aposta na janela de validade).
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function accountToken(accountId: string): Promise<string> {
  const c = tokenCache.get(accountId);
  if (c && c.expiresAt > Date.now() + 5_000) return c.token;
  const r = await apiGateway.getAccountRogueToken(accountId);
  if (r.data?.result !== 1) throw new Error(r.data?.message || 'Sem token da conta.');
  const { token, expiresAt } = r.data.data as { token: string; expiresAt: number };
  tokenCache.set(accountId, { token, expiresAt });
  return token;
}

// Renova o token do backend com esta antecedência do vencimento (mint em
// background, nunca no caminho do disparo).
const WARM_MARGIN_MS = 90_000;

/** Força buscar o token no backend e atualiza o cache (ignora o cache-first). */
async function refreshAccountToken(accountId: string): Promise<void> {
  try {
    const r = await apiGateway.getAccountRogueToken(accountId);
    if (r.data?.result === 1) {
      const { token, expiresAt } = r.data.data as { token: string; expiresAt: number };
      tokenCache.set(accountId, { token, expiresAt });
    }
  } catch { /* mantém o token atual; o disparo re-tenta se precisar */ }
}

/**
 * Pré-aquece/renova os tokens das contas (em paralelo, tolerante a erro). Re-busca
 * no backend os que estão FALTANDO ou perto de vencer (dentro de WARM_MARGIN) —
 * assim o token JÁ está fresco em cache na hora do disparo e o mint sai do caminho
 * crítico da latência. Chamado ao abrir o modal e a cada tick do keeper.
 */
export async function warmAccountTokens(accountIds: string[]): Promise<void> {
  const now = Date.now();
  await Promise.all(accountIds.map((id) => {
    const c = tokenCache.get(id);
    if (c && c.expiresAt > now + WARM_MARGIN_MS) return Promise.resolve();
    return refreshAccountToken(id);
  }));
}

/** Todos os tokens já estão em cache e válidos (p/ o indicador "pronto"). */
export function tokensWarm(accountIds: string[]): boolean {
  const now = Date.now();
  return accountIds.length > 0 && accountIds.every((id) => {
    const c = tokenCache.get(id);
    return !!c && c.expiresAt > now + 5_000;
  });
}

// status 0 = falha de rede (fetch rejeitou). O chamador trata como não-200 e
// NUNCA deixa a rejeição escapar como promise não tratada (slip preso em 'placing').
async function roguePost(base: string, path: string, token: string, body: unknown): Promise<{ status: number; json: any }> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json', seamlessadditionaldata: '' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

async function rogueGet(base: string, path: string, token: string, params: Record<string, string>): Promise<{ status: number; json: any }> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${base}${path}?${qs}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const round2 = (v: number) => Math.round(v * 100) / 100;

/** PotentialReturns: half-to-even sobre (TrueOdds*Stake), como o bundle faz. */
function potentialReturns(trueOdds: number, stake: number): number {
  const x = Number((trueOdds * stake).toFixed(12));
  const scaled = x * 100;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let cents: number;
  if (diff > 0.5) cents = floor + 1;
  else if (diff < 0.5) cents = floor;
  else cents = floor % 2 === 0 ? floor : floor + 1; // empate → par
  return cents / 100;
}

/** Extrai o betId do recibo (campo varia; procura em locais comuns). */
function receiptBetId(json: any): string | null {
  if (!json) return null;
  const b = json.betId ?? json.BetId ?? json.id ?? json.Bets?.[0]?.BetId ?? json.Bets?.[0]?.betId ?? json.Receipt?.BetId;
  return b != null ? String(b) : null;
}

/** Dados mínimos p/ montar o cupom do placeBets (de calc OU do feed ao vivo). */
interface SelData {
  id: string;
  trueOdds: number;
  displayOdds: string;
  points: number;
  betslipLine: string | null;
  type: string;              // "Single"
  selectionsMapped: unknown; // [{Id}]
  numberOfBets: number;
}

function buildBody(sel: SelData, stake: number, potentialReturns: number, acceptOddsChange: boolean): any {
  return {
    Selections: [{ Id: sel.id, TrueOdds: sel.trueOdds, DisplayOdds: sel.displayOdds, Points: sel.points, BetslipLine: sel.betslipLine, Locale: 'br-pt' }],
    Locale: 'br-pt',
    Bets: [{
      Type: sel.type,
      SelectionsMapped: sel.selectionsMapped,
      TrueOdds: sel.trueOdds,
      DisplayOdds: sel.displayOdds,
      Stake: stake,
      PotentialReturns: potentialReturns,
      NumberOfBets: sel.numberOfBets,
    }],
    OddsStyle: 'decimal',
    // AcceptHigher = aceita se a odd subir no delay (valor real que o site usa).
    AutoAcceptMode: acceptOddsChange ? 'AcceptHigher' : 'None',
  };
}

export async function placeBetReal(
  account: NoDelayAccount,
  ticket: BetTicket,
  opts: BetPlaceOptions,
): Promise<BetResult> {
  const startedAt = performance.now();
  const fail = (error: string): BetResult => ({
    ok: false, elapsedMs: performance.now() - startedAt, stake: opts.stake, odds: ticket.odds,
    partial: false, oddsChanged: false, error,
  });

  const base = opts.rogueUrl;
  if (!base) return fail('Casa sem host rogue configurado.');

  let token: string;
  try {
    token = await accountToken(account.id);
  } catch (e) {
    // Backend devolve mensagem clara quando a sessão da conta expirou.
    return fail((e as Error).message || 'Sem token da conta.');
  }

  // MODO RÁPIDO: monta o cupom do dado AO VIVO (SSE), pulando o round-trip do
  // calculateBets. Para um Single, tudo o que o placeBets precisa já veio no
  // feed — selectionId, odd, linha e pontos. Poupa ~1 requisição de latência.
  const liveSel: SelData = {
    id: ticket.selectionId,
    trueOdds: ticket.odds,
    displayOdds: ticket.odds.toFixed(3),
    points: ticket.points ?? 0,
    betslipLine: ticket.line,
    type: 'Single',
    selectionsMapped: [{ Id: ticket.selectionId }],
    numberOfBets: 1,
  };

  const fastRes = await tryPlace(base, token, liveSel, opts, startedAt);
  if (fastRes.result) return fastRes.result;

  // Fallback: o placeBets rápido recusou por algo que não é arredondamento.
  // Pega os dados EXATOS no calculateBets e tenta de novo (mais lento, robusto).
  const calc = await roguePost(base, '/api/rogue/v1/betting/calculateBets', token, {
    Selections: [{ Id: ticket.selectionId }],
    OddsStyle: 'decimal',
    Locale: 'br-pt',
  });
  const bet = calc.json?.Bets?.[0];
  const sel = calc.json?.Selections?.[0];
  if (calc.status !== 200 || !bet || !sel) {
    return fail(fastRes.error || `calculateBets falhou (${calc.status})`);
  }
  const calcSel: SelData = {
    id: ticket.selectionId,
    trueOdds: typeof bet.TrueOdds === 'number' ? bet.TrueOdds : Number(sel.TrueOdds) || ticket.odds,
    displayOdds: sel.DisplayOdds ?? ticket.odds.toFixed(3),
    points: sel.Points ?? ticket.points ?? 0,
    betslipLine: sel.BetslipLine ?? ticket.line,
    type: bet.Type ?? 'Single',
    selectionsMapped: bet.SelectionsMapped ?? [{ Id: ticket.selectionId }],
    numberOfBets: bet.NumberOfBets ?? 1,
  };
  const calcRes = await tryPlace(base, token, calcSel, opts, startedAt);
  return calcRes.result ?? fail(calcRes.error || 'Recusada pela casa');
}

/**
 * Envia o placeBets com o cupom montado + retry do PotentialReturns. Devolve o
 * resultado final (aceita/recusada/delay) OU um erro p/ o chamador decidir o
 * fallback via calculateBets.
 */
async function tryPlace(
  base: string,
  token: string,
  sel: SelData,
  opts: BetPlaceOptions,
  startedAt: number,
): Promise<{ result?: BetResult; error?: string }> {
  // Mudança de odd no happy-path não é detectada aqui (a odd do cupom é a usada);
  // o poll marca oddsChanged quando vem NewOffer (odd caiu no delay).
  const oddsChanged = false;
  const pr = potentialReturns(sel.trueOdds, opts.stake);
  let lastErr = '';

  for (const delta of [0, 0.01, -0.01]) {
    const body = buildBody(sel, opts.stake, round2(pr + delta), opts.acceptOddsChange);
    const place = await roguePost(base, '/api/rogue/v1/betting/placeBets', token, body);

    // AO VIVO: entra na janela de delay (WaitingBetId) — poll confirma.
    const waitingId = place.json?.WaitingBetId;
    if (place.status === 200 && waitingId) {
      return { result: await pollWaiting(base, token, String(waitingId), startedAt, opts.stake, sel.trueOdds, oddsChanged, opts.acceptOddsChange) };
    }
    // Confirmação imediata (prematch): já vem o betId.
    const betId = receiptBetId(place.json);
    if (place.status === 200 && betId) {
      return { result: { ok: true, elapsedMs: performance.now() - startedAt, stake: opts.stake, odds: sel.trueOdds, partial: false, oddsChanged, receiptId: betId } };
    }

    // ⚠️ 200 SEM WaitingBetId e SEM betId reconhecível: a casa ACEITOU o request
    // num formato que não sabemos ler. NUNCA re-postar (re-post = aposta real
    // DUPLICADA). Encerra como AMBÍGUO — o dinheiro pode ter saído; manda conferir.
    if (place.status === 200) {
      return { result: { ok: false, elapsedMs: performance.now() - startedAt, stake: opts.stake, odds: sel.trueOdds, partial: false, oddsChanged, error: 'Enviada, mas a casa não confirmou o bilhete — confira o histórico da casa.' } };
    }

    // ⚠️ status 0 = falha de REDE (não sabemos se a casa recebeu o placeBets).
    // NÃO re-postar nem cair no calculateBets (poderia duplicar). Ambíguo.
    if (place.status === 0) {
      return { result: { ok: false, elapsedMs: performance.now() - startedAt, stake: opts.stake, odds: sel.trueOdds, partial: false, oddsChanged, error: 'Sem resposta da casa no envio — confira o histórico da casa.' } };
    }

    const bodyStr = JSON.stringify(place.json || '');

    // Recusa DEFINITIVA da casa (2002 / "declined"): a seleção suspendeu ou a
    // linha mudou entre o clique e o envio (corrida do ao vivo). calculateBets não
    // adianta — encerra claro, sem gastar round-trip. Extrai o motivo se vier.
    const declineReason = place.json?.Data?.[0]?.declineReasons?.[0]?.name;
    if (place.json?.ErrorCode === 2002 || /declined|bet was declined/i.test(bodyStr)) {
      return { result: { ok: false, elapsedMs: performance.now() - startedAt, stake: opts.stake, odds: sel.trueOdds, partial: false, oddsChanged, error: declineReason ? `Recusada: ${declineReason}` : 'Recusada — seleção suspensa ou a linha mudou' } };
    }

    lastErr = `placeBets ${place.status}: ${bodyStr.slice(0, 160)}`;
    // Só re-posta o MESMO cupom para erro de arredondamento/hash (troca o
    // PotentialReturns). Qualquer outro erro (não-200) → deixa o chamador tentar
    // o calculateBets UMA vez; nunca re-posta às cegas.
    if (!/potentialreturn|hash/i.test(bodyStr)) {
      return { error: lastErr };
    }
  }
  return { error: lastErr };
}

/**
 * Poll da "janela de delay" ao vivo — o mais rápido possível: getPurchases a
 * cada 0,5s. Status: Open = aceita, Declined = recusada, NewOffer = a odd mudou,
 * vazio por vários ciclos = timeout.
 *
 * NewOffer: se "aceitar mudança" está ligado E ainda estamos DENTRO de 5s desde
 * o placeBets, ACEITA a oferta (updatePurchases PurchasesAccepted) e segue
 * pollando até virar Open. Fora da janela / sem aceitar → recusa e reporta.
 */
async function pollWaiting(
  base: string,
  token: string,
  waitingId: string,
  startedAt: number,
  stake: number,
  trueOdds: number,
  oddsChanged: boolean,
  acceptOddsChange: boolean,
): Promise<BetResult> {
  // Poll RÁPIDO no começo (é onde a confirmação quase sempre cai) e afrouxa depois
  // p/ respeitar rate limit em delays longos. 3 contas × 200ms = ~15 req/s de pico
  // nos 1os 4s, caindo p/ ~7,5 req/s — o próprio site já polla getPurchases assim.
  const POLL_FAST_MS = 200;     // 0,2s no começo (confirma antes)
  const POLL_SLOW_MS = 400;     // afrouxa depois dos 1os segundos
  const FAST_WINDOW_MS = 4000;  // janela rápida
  const OFFER_WINDOW_MS = 5000; // aceita NewOffer só nos 1os 5s
  const MAX_MS = 25_000;        // teto duro
  const EMPTY_MAX_MS = 8000;    // sem nenhuma purchase por 8s contínuos → timeout
  const pollStart = performance.now();
  let lastSeenAt = performance.now();
  let curId = waitingId;
  let changed = oddsChanged;
  const acceptedOffers = new Set<string>();

  const done = (ok: boolean, error?: string, receiptId?: string): BetResult => ({
    ok, elapsedMs: performance.now() - startedAt, stake, odds: trueOdds, partial: false, oddsChanged: changed, receiptId, error,
  });

  while (performance.now() - pollStart < MAX_MS) {
    await sleep(performance.now() - pollStart < FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    const upd = await rogueGet(base, '/api/rogue/v1/betting/getPurchases', token, { Ids: curId });
    const purchases: any[] = upd.json?.Purchases ?? [];
    if (!purchases.length) {
      if (performance.now() - lastSeenAt > EMPTY_MAX_MS) return done(false, 'Tempo esgotado (verifique o histórico)');
      continue;
    }
    lastSeenAt = performance.now();

    const p = purchases.find((x) => String(x.WaitingBetId) === curId) ?? purchases[0];
    const st = String(p?.Status || '');
    const offerId = String(p?.WaitingBetId ?? curId);

    if (st === 'Open' || st === 'Accepted' || st === 'Placed') {
      return done(true, undefined, String(p?.Id ?? p?.BetId ?? p?.betId ?? offerId));
    }
    if (st === 'Declined' || st === 'Rejected') {
      return done(false, p?.DeclineReasonName || p?.DeclineReason || 'Recusada no delay');
    }
    if (st === 'NewOffer') {
      const withinWindow = performance.now() - pollStart < OFFER_WINDOW_MS;
      if (acceptOddsChange && withinWindow && !acceptedOffers.has(offerId)) {
        acceptedOffers.add(offerId);
        changed = true;
        await roguePost(base, '/api/rogue/v1/betting/updatePurchases', token, { PurchasesAccepted: [offerId] }).catch(() => {});
        curId = offerId; // segue pollando até resolver
        continue;
      }
      // fora da janela de 5s ou não aceita mudança → recusa a oferta.
      await roguePost(base, '/api/rogue/v1/betting/updatePurchases', token, { PurchasesDeclined: [offerId] }).catch(() => {});
      return { ...done(false, withinWindow ? 'Odd mudou' : 'Odd mudou (fora da janela de 5s)'), oddsChanged: true };
    }
    // outros status → continua
  }
  return done(false, 'Tempo esgotado (verifique o histórico)');
}
