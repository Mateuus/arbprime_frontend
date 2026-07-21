import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { NoDelaySettings } from '@/hooks/useNoDelaySettings';
import { placeBet, BetTicket } from '@/services/nodelay/placeBet';
import { placeBetReal, warmAccountTokens, tokensWarm } from '@/services/nodelay/placeBetReal';
import { buildAltenarTicket, placeBetAltenar, AltenarTicket } from '@/services/nodelay/placeBetAltenar';
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
}

export function useNoDelayFire({ detail, houseBySlug, getHousePrice, betting, settings, k }: Params) {
  const [slips, setSlips] = useState<SlipView[] | null>(null);
  const [tokensReady, setTokensReady] = useState(false);
  const fireSeq = useRef(0);

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
    const kAcc = cachedK(a.id) ?? k ?? null;
    const hardMax = kAcc ? maxStakeOf(s, m, kAcc, MAX_STAKE_DRIFT) : null;
    if (settings.maxStakeMode) {
      if (hardMax == null) return settings.defaultStake;
      return Math.max(0, Math.floor(Math.min(hardMax, a.balance ?? hardMax)));
    }
    return hardMax != null ? Math.min(settings.defaultStake, +(hardMax - 0.01).toFixed(2)) : settings.defaultStake;
  }, [settings.maxStakeMode, settings.defaultStake, k]);

  /** Linhas por conta (casa, odd, stake, retorno) — pro cupom mostrar antes de confirmar. */
  const preview = useCallback((m: LiveMarket, s: LiveSelection): FirePreviewRow[] => {
    return betting.map((a) => {
      const house = houseBySlug.get(a.bookmakerSlug);
      const hp = getHousePrice(a.bookmakerSlug, s.id);
      const odd = hp?.price ?? s.price;
      const stake = stakeForAccount(a, m, s);
      let blocked = false; let reason: string | undefined;
      if (hp && (hp.disabled || hp.price <= 0)) { blocked = true; reason = 'Suspenso nesta casa'; }
      else if (stake < HOUSE_MIN) { blocked = true; reason = 'Abaixo do mínimo (R$ 1)'; }
      return { account: a, house, odd, stake, blocked, reason, potential: blocked ? 0 : +(stake * odd).toFixed(2) };
    });
  }, [betting, houseBySlug, getHousePrice, stakeForAccount]);

  const failSlip = (key: string, ticket: BetTicket, error: string) =>
    setSlips((prev) => prev && prev.map((sl) => (sl.key === key
      ? { ...sl, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error } }
      : sl)));

  /** Dispara de verdade (mock/real). Cada conta → SUA casa, odd DAQUELA casa. */
  const doFire = useCallback((m: LiveMarket, s: LiveSelection) => {
    if (!detail) return;
    const round = ++fireSeq.current;
    const slipList: SlipView[] = [];
    const toSubmit: { key: string; a: NoDelayAccount; ticket: BetTicket; stake: number; rogueUrl?: string; isBia: boolean; altenarTicket: AltenarTicket | null; house?: NoDelayBookmaker }[] = [];

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
      if (stake < HOUSE_MIN) {
        slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: 'Abaixo do mínimo da casa (R$ 1)' } });
        continue;
      }
      const isBia = house?.platform === 'biahosted';
      const altenarTicket = isBia ? buildAltenarTicket(detail, m, s, ticket.odds) : null;
      slipList.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'placing' });
      toSubmit.push({ key, a, ticket, stake, rogueUrl: house?.rogueUrl || undefined, isBia, altenarTicket, house });
    }
    setSlips(slipList);

    const opts = { allowPartial: settings.allowPartial, acceptOddsChange: settings.acceptOddsChange };
    for (const it of toSubmit) {
      const p = it.isBia && settings.realBets && it.altenarTicket && it.house
        ? placeBetAltenar(it.a, it.house, it.altenarTicket, it.stake)
        : (settings.realBets && !it.isBia ? placeBetReal : placeBet)(it.a, it.ticket, { stake: it.stake, ...opts, rogueUrl: it.rogueUrl });
      p
        .then((result) => { setSlips((prev) => prev && prev.map((sl) => (sl.key === it.key ? { ...sl, status: 'done', result } : sl))); })
        .catch(() => failSlip(it.key, it.ticket, 'Falha de rede — confira o histórico da casa.'));
    }
  }, [betting, houseBySlug, ticketFor, getHousePrice, stakeForAccount, settings, detail]);

  const reset = useCallback(() => setSlips(null), []);

  return { slips, tokensReady, preview, doFire, reset };
}
