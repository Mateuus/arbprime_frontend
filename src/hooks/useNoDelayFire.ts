import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { NoDelaySettings, acceptOddsChangeFor } from '@/hooks/useNoDelaySettings';
import { placeBet, BetTicket, BetResult } from '@/services/nodelay/placeBet';
import { placeBetReal, warmAccountTokens, tokensWarm } from '@/services/nodelay/placeBetReal';
import { buildAltenarTicket, placeBetAltenar, AltenarTicket } from '@/services/nodelay/placeBetAltenar';
import { placeBetSuperbet } from '@/services/nodelay/placeBetSuperbet';
import { placeBetBet365 } from '@/services/nodelay/placeBetBet365';
import { maxStakeOf, cachedK, getAccountK, pickCalibrationSample } from '@/services/nodelay/maxStake';
import { SlipView } from '@/components/nodelay/BetSlipCard';
import { selectionLabel, scoreOf, clockOf } from '@/utils/nodelayLive';

/**
 * Motor de disparo do NoDelay — a MESMA lógica multi-casa do QuickBetModal, extraída
 * para ser reusada pelo Betslip (tap-to-bet no quadro). Cada conta marcada faz o SEU
 * post, em paralelo, na SUA casa e com a odd ESPECÍFICA daquela casa (mesma
 * selectionId). Um disparo = aposta em todas as contas marcadas de uma vez.
 *
 * - `preview(m, s)` → linhas por conta (casa, odd, stake, retorno) pro cupom mostrar.
 * - `doFire(m, s)` → dispara de verdade (mock/real) e alimenta `slips`.
 * - pré-aquece token (swarm) e calibra o K das contas marcadas (disparo sem latência).
 */

// Margem contra alta de odd entre o cálculo do máx e o place (odd pessimista).
const MAX_STAKE_DRIFT = 0.02;
// Aposta mínima da casa (BRL). Abaixo disso = rejeição certa.
export const HOUSE_MIN = 1;

// bet365 PRÉ-JOGO: LIGADO. O addbet bate byte-a-byte com 2 capturas reais pré-jogo (1X2 + O/U,
// cs:1) — o bug era mt=7 (in-play); pré-jogo 1X2/O-U = mt=13, corrigido no coletor. Ver [[bet365-nodelay-betting]].
const BET365_PREMATCH_ENABLED = true;
// bet365: seleção apostável = placeable com fp(selectionId) + mt + odd (só 1X2/Total de Gols).
const bet365Bettable = (hp?: HousePrice): boolean =>
  BET365_PREMATCH_ENABLED && !!(hp?.placeable && hp.placeable.selectionId && hp.placeable.mt && hp.placeable.odd);
// Pré-jogo: a casa tem adapter + dado apostável? (Superbet c/ oddUuid OU bet365 c/ placeable.)
const prematchBettable = (platform: string | null | undefined, hp?: HousePrice): boolean =>
  (platform === 'superbet' && !!hp?.placeable?.oddUuid) || (platform === 'bet365' && bet365Bettable(hp));

export interface FirePreviewRow {
  account: NoDelayAccount;
  house?: NoDelayBookmaker;
  odd: number;
  stake: number;
  /** Não vai disparar nesta casa (suspenso / abaixo do mínimo). */
  blocked: boolean;
  reason?: string;
  /** Retorno potencial (stake × odd). */
  potential: number;
}

interface Params {
  /** null enquanto o evento carrega — o motor no-opa até o detail chegar. */
  detail: LiveGameDetail | null;
  houseBySlug: Map<string, NoDelayBookmaker>;
  getHousePrice: (slug: string, selId: string) => HousePrice | undefined;
  /** Contas marcadas (connected ∩ selecionadas). */
  betting: NoDelayAccount[];
  settings: NoDelaySettings;
  k?: number | null;
  /** Stake = exatamente o valor digitado (ignora MÁX e o teto do fornecedor de odd).
   * O limite REAL é o da casa. Usado pelo Betslip. */
  forceFixedStake?: boolean;
  /** Superbet: 'live' (evento ao vivo) ou 'prematch'. Default 'live'. */
  betType?: 'prematch' | 'live';
}

export function useNoDelayFire({ detail, houseBySlug, getHousePrice, betting, settings, k, forceFixedStake, betType }: Params) {
  const [slips, setSlips] = useState<SlipView[] | null>(null);
  const [tokensReady, setTokensReady] = useState(false);
  const fireSeq = useRef(0);
  // guarda o que precisa p/ RE-APOSTAR uma seleção bet365 na odd nova (quando a odd muda e o usuário confirma)
  const refireRef = useRef<Record<string, { a: NoDelayAccount; ticket: BetTicket; stake: number; betPlaceable?: Record<string, unknown> | null; betEventId?: string; betLine?: string }>>({});

  const eventName = detail ? `${detail.home} x ${detail.away}` : '';
  const score = detail ? scoreOf(detail) : null;
  const clock = detail ? clockOf(detail) : '';

  // Pré-aquece o rogue token das contas swarm marcadas (biahosted/superbet apostam
  // com sessão própria) — o disparo real vira só o place, sem mint no caminho.
  useEffect(() => {
    const ids = betting.filter((a) => houseBySlug.get(a.bookmakerSlug)?.platform === 'swarm').map((a) => a.id);
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokensReady(true);
      return;
    }
    let alive = true;
    const tick = async () => { await warmAccountTokens(ids); if (alive) setTokensReady(tokensWarm(ids)); };
    void tick();
    const iv = window.setInterval(() => { void tick(); }, 15_000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [betting, houseBySlug]);

  // Calibra o K (max stake) de cada conta marcada — 1 calculateBets por conta, não
  // por seleção; deixa o MÁX/limite pronto.
  const kSample = useMemo(() => (detail ? pickCalibrationSample(detail) : null), [detail]);
  const kSampleId = kSample?.sel.id ?? '';
  const kSampleRef = useRef(kSample);
  useEffect(() => { kSampleRef.current = kSample; });
  useEffect(() => {
    if (betting.length === 0 || !kSampleId) return;
    const calibrate = () => {
      const s = kSampleRef.current;
      if (!s) return;
      for (const a of betting) {
        const rogueUrl = houseBySlug.get(a.bookmakerSlug)?.rogueUrl;
        if (rogueUrl) void getAccountK(rogueUrl, a.id, s);
      }
    };
    calibrate();
    const iv = window.setInterval(calibrate, 5 * 60_000);
    return () => window.clearInterval(iv);
  }, [betting, houseBySlug, kSampleId]);

  const ticketFor = useCallback((a: NoDelayAccount, m: LiveMarket, s: LiveSelection): BetTicket => {
    const hp = getHousePrice(a.bookmakerSlug, s.id);
    return {
      eventId: detail?.id ?? '',
      eventName,
      marketName: m.name,
      selectionId: s.id,
      selectionName: selectionLabel(s.name, s.points),
      odds: hp?.price ?? s.price,
      line: hp?.line ?? s.line,
      points: hp?.points ?? s.points,
      score: score ? `${score.home} - ${score.away}` : undefined,
      clock: clock || undefined,
    };
  }, [detail?.id, eventName, score, clock, getHousePrice]);

  const stakeForAccount = useCallback((a: NoDelayAccount, m: LiveMarket, s: LiveSelection): number => {
    // Betslip: stake = exatamente o digitado. Sem MÁX, sem cortar pelo teto do
    // fornecedor de odd (que às vezes é MENOR que o limite real da casa).
    if (forceFixedStake) return settings.defaultStake;
    const kAcc = cachedK(a.id) ?? k ?? null;
    const hardMax = kAcc ? maxStakeOf(s, m, kAcc, MAX_STAKE_DRIFT) : null;
    if (settings.maxStakeMode) {
      if (hardMax == null) return settings.defaultStake;
      return Math.max(0, Math.floor(Math.min(hardMax, a.balance ?? hardMax)));
    }
    return hardMax != null ? Math.min(settings.defaultStake, +(hardMax - 0.01).toFixed(2)) : settings.defaultStake;
  }, [forceFixedStake, settings.maxStakeMode, settings.defaultStake, k]);

  /** Linhas por conta (casa, odd, stake, retorno) — pro cupom mostrar antes de confirmar. */
  const preview = useCallback((m: LiveMarket, s: LiveSelection): FirePreviewRow[] => {
    return betting.map((a) => {
      const house = houseBySlug.get(a.bookmakerSlug);
      const hp = getHousePrice(a.bookmakerSlug, s.id);
      const odd = hp?.price ?? s.price;
      const stake = stakeForAccount(a, m, s);
      const min = house?.minStake ?? HOUSE_MIN;
      let blocked = false; let reason: string | undefined;
      if (hp && (hp.disabled || hp.price <= 0)) { blocked = true; reason = 'Suspenso nesta casa'; }
      else if (stake < min) { blocked = true; reason = `Abaixo do mínimo (R$ ${min.toFixed(2).replace('.', ',')})`; }
      // Pré-jogo: só casas com adapter + dado apostável (Superbet c/ oddUuid OU bet365 c/ placeable).
      else if (betType === 'prematch' && !prematchBettable(house?.platform, hp)) { blocked = true; reason = 'Pré-jogo em breve nesta casa'; }
      return { account: a, house, odd, stake, blocked, reason, potential: blocked ? 0 : +(stake * odd).toFixed(2) };
    });
  }, [betting, houseBySlug, getHousePrice, stakeForAccount, betType]);

  const failSlip = (key: string, ticket: BetTicket, error: string) =>
    setSlips((prev) => prev && prev.map((sl) => (sl.key === key
      ? { ...sl, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error } }
      : sl)));

  /** Dispara de verdade (mock/real). Cada conta → SUA casa, odd DAQUELA casa. */
  const doFire = useCallback((m: LiveMarket, s: LiveSelection) => {
    if (!detail) return;
    const round = ++fireSeq.current;
    const slipList: SlipView[] = [];
    const toSubmit: { key: string; a: NoDelayAccount; ticket: BetTicket; stake: number; rogueUrl?: string; isBia: boolean; isSuperbet: boolean; isBet365: boolean; altenarTicket: AltenarTicket | null; house?: NoDelayBookmaker; betEventId?: string; betOddUuid?: string; betPlaceable?: Record<string, unknown> | null; betLine?: string }[] = [];

    for (const a of betting) {
      const key = `${round}:${a.id}`;
      const house = houseBySlug.get(a.bookmakerSlug);
      const label = `${a.label || a.username}${house ? ` · ${house.name}` : ''}`;
      const ticket = ticketFor(a, m, s);
      const hp = getHousePrice(a.bookmakerSlug, s.id);
      if (hp && (hp.disabled || hp.price <= 0)) {
        slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: settings.defaultStake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: 'Suspenso nesta casa' } });
        continue;
      }
      const stake = stakeForAccount(a, m, s);
      const min = house?.minStake ?? HOUSE_MIN;
      if (stake < min) {
        slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: `Abaixo do mínimo da casa (R$ ${min.toFixed(2).replace('.', ',')})` } });
        continue;
      }
      const isBia = house?.platform === 'biahosted';
      const isSuperbet = house?.platform === 'superbet';
      const isBet365 = house?.platform === 'bet365';
      // Pré-jogo: só casa com adapter + dado apostável (Superbet c/ oddUuid OU bet365 c/ placeable).
      // (as demais casas entram no passo 2 — instrumentar os workers delas.)
      if (betType === 'prematch' && !prematchBettable(house?.platform, hp)) {
        slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: 'Pré-jogo em breve nesta casa' } });
        continue;
      }
      const altenarTicket = isBia ? buildAltenarTicket(detail, m, s, ticket.odds) : null;
      slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'placing' });
      // Superbet/bet365 prematch: usa o eventId + dado apostável (placeable) DAQUELA casa.
      toSubmit.push({ key, a, ticket, stake, rogueUrl: house?.rogueUrl || undefined, isBia, isSuperbet, isBet365, altenarTicket, house, betEventId: hp?.eventId, betOddUuid: hp?.placeable?.oddUuid, betPlaceable: hp?.placeable, betLine: hp?.line ?? ticket.line ?? undefined });
    }
    setSlips(slipList);
    // guarda os dados das apostas bet365 p/ poder RE-APOSTAR na odd nova se ela mudar
    refireRef.current = {};
    for (const it of toSubmit) if (it.isBet365 && it.betPlaceable) refireRef.current[it.key] = { a: it.a, ticket: it.ticket, stake: it.stake, betPlaceable: it.betPlaceable, betEventId: it.betEventId, betLine: it.betLine };

    for (const it of toSubmit) {
      // "Aceitar mudança de odd" é POR CASA (override) — cai no global se não setado.
      const opts = { allowPartial: settings.allowPartial, acceptOddsChange: acceptOddsChangeFor(settings, it.a.bookmakerSlug) };
      let p: Promise<BetResult>;
      if (!settings.realBets) {
        p = placeBet(it.a, it.ticket, { stake: it.stake, ...opts, rogueUrl: it.rogueUrl }); // mock
      } else if (it.isSuperbet) {
        // Superbet = server-side (backend cycletls). Ao vivo: selectionId do ticket já é
        // o uuid + eventId=detail.id. Pré-jogo: sobrescreve com o oddUuid/eventId da casa.
        const t = it.betOddUuid ? { ...it.ticket, eventId: it.betEventId || it.ticket.eventId, selectionId: it.betOddUuid } : it.ticket;
        p = placeBetSuperbet(it.a, t, { stake: it.stake, betType: betType || 'live', acceptOddsChange: opts.acceptOddsChange });
      } else if (it.isBet365 && it.betPlaceable) {
        // bet365 = server-side (backend nst). Manda o placeable ({fp,mt,od}) + eventId + linha da casa.
        p = placeBetBet365(it.a, it.ticket, { stake: it.stake, placeable: it.betPlaceable, eventId: it.betEventId || it.ticket.eventId, line: it.betLine, acceptOddsChange: opts.acceptOddsChange });
      } else if (it.isBia && it.altenarTicket && it.house) {
        p = placeBetAltenar(it.a, it.house, it.altenarTicket, it.stake);
      } else {
        p = placeBetReal(it.a, it.ticket, { stake: it.stake, ...opts, rogueUrl: it.rogueUrl });
      }
      p
        .then((result) => { setSlips((prev) => prev && prev.map((sl) => (sl.key === it.key ? { ...sl, status: 'done', result } : sl))); })
        .catch(() => failSlip(it.key, it.ticket, 'Falha de rede — confira o histórico da casa.'));
    }
  }, [betting, houseBySlug, ticketFor, getHousePrice, stakeForAccount, settings, detail, betType]);

  const reset = useCallback(() => setSlips(null), []);

  /** Confirma a odd NOVA e re-aposta a seleção bet365 daquela conta (aa=y). Chamado do botão "apostar na nova odd". */
  const confirmOddsAndRefire = useCallback((key: string) => {
    const it = refireRef.current[key];
    if (!it || !it.betPlaceable) return;
    setSlips((prev) => prev && prev.map((sl) => (sl.key === key ? { ...sl, status: 'placing', result: undefined } : sl)));
    placeBetBet365(it.a, it.ticket, { stake: it.stake, placeable: it.betPlaceable, eventId: it.betEventId || it.ticket.eventId, line: it.betLine, acceptOddsChange: true })
      .then((result) => setSlips((prev) => prev && prev.map((sl) => (sl.key === key ? { ...sl, status: 'done', result } : sl))))
      .catch(() => failSlip(key, it.ticket, 'Falha ao reapostar na odd nova.'));
  }, []);

  return { slips, tokensReady, preview, doFire, reset, confirmOddsAndRefire };
}
