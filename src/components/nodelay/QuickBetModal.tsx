import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { useNowTick } from '@/hooks/useNowTick';
import { useUserContext } from '@/context/UserContext';
import { NoDelaySettings } from '@/hooks/useNoDelaySettings';
import { placeBet, BetTicket } from '@/services/nodelay/placeBet';
import { placeBetReal, warmAccountTokens, tokensWarm } from '@/services/nodelay/placeBetReal';
import { buildAltenarTicket, placeBetAltenar, AltenarTicket } from '@/services/nodelay/placeBetAltenar';
import { maxStakeOf, cachedK, getAccountK, pickCalibrationSample } from '@/services/nodelay/maxStake';
import { SlipView } from '@/components/nodelay/BetSlipCard';
import { BetSlipDrawer } from '@/components/nodelay/BetSlipDrawer';
import { NoDelayBoard } from '@/components/nodelay/NoDelayBoard';
import { LiveStatsPanel } from '@/components/nodelay/LiveStatsPanel';
import { selectionLabel, scoreOf, clockOf, fmtOdd, filterMarkets } from '@/utils/nodelayLive';
import { formatMoney } from '@/utils/nodelayUi';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { X, Zap, Star, Minus, Plus, Users, Settings, Check, ChevronDown, Lock, RefreshCw, Loader2 } from 'lucide-react';

/**
 * Aposta Rápida — o "cockpit" de trade ao vivo. Tudo mora aqui: seleção de
 * contas, stake, configurações e os favoritos (1 toque dispara). Os bilhetes
 * abrem numa gaveta separada no rodapé. Feito assim para funcionar igual no
 * desktop e no CELULAR (onde a lateral não é prática).
 *
 * MULTI-CASA: cada conta faz o SEU post, em paralelo, na rogue da SUA casa e com
 * a odd ESPECÍFICA daquela casa (mesma selectionId — mesmo core fssb). Um toque
 * aposta em todas as casas marcadas de uma vez.
 */
interface Props {
  detail: LiveGameDetail;
  /** Casa por slug (p/ achar o rogueUrl de cada conta). */
  houseBySlug: Map<string, NoDelayBookmaker>;
  /** Preço da seleção NAQUELA casa (odd específica p/ o disparo). */
  getHousePrice: (slug: string, selId: string) => HousePrice | undefined;
  favorites: Set<string>;
  connected: NoDelayAccount[];
  selectedIds: Set<string>;
  onToggleAccount: (id: string) => void;
  settings: NoDelaySettings;
  onUpdateSettings: (patch: Partial<NoDelaySettings>) => void;
  onClose: () => void;
  /** "Atualizar": revalida sessão + saldo das contas sem sair do modal. */
  onRefresh: () => void;
  refreshing: boolean;
  /** Fator do max stake da conta de referência (p/ mostrar o MÁX nos favoritos). */
  k?: number | null;
  /** ids de seleção que acabaram de mudar de preço (piscam ao vivo). */
  changed: Set<string>;
  /** Mercados com Anti Proteção (marketKeyOf) + toggle — segura o mercado na tela. */
  antiProtect: Set<string>;
  onToggleAntiProtect: (key: string) => void;
}

type Panel = 'none' | 'accounts' | 'settings';

// Margem contra alta de odd entre o cálculo do máx e o placeBets (odd pessimista).
const MAX_STAKE_DRIFT = 0.02;
// Aposta mínima da casa (BRL, fixo — ver BRIEF-maxstake). Abaixo disso = rejeição.
const HOUSE_MIN = 1;

export function QuickBetModal({
  detail, houseBySlug, getHousePrice, favorites, connected, selectedIds, onToggleAccount, settings, onUpdateSettings, onClose, onRefresh, refreshing, k, changed, antiProtect, onToggleAntiProtect,
}: Props) {
  const [slips, setSlips] = useState<SlipView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [pending, setPending] = useState<{ m: LiveMarket; s: LiveSelection } | null>(null);
  const [tokensReady, setTokensReady] = useState(false);
  const fireSeq = useRef(0);
  const { user } = useUserContext();
  const isAdmin = user?.role === 'admin';

  const betting = useMemo(() => connected.filter((a) => selectedIds.has(a.id)), [connected, selectedIds]);

  // TUDO PRONTO NA ABERTURA: minta o token de cada conta marcada JÁ ao abrir o
  // modal e mantém quente (re-verifica a cada 15s, re-mint em background quem
  // está perto de vencer). Assim o disparo é SÓ o placeBets — zero latência de
  // mint no caminho crítico. Cada ms conta.
  useEffect(() => {
    // SÓ o swarm (fssb) pré-aquece rogue token; biahosted (Altenar) aposta com a
    // sessão/JWT própria — sem rogue token. Sem esse filtro, o warming batia no
    // rogue-token da conta biahosted em loop (495) e o chip ficava "preparando".
    const ids = betting.filter((a) => houseBySlug.get(a.bookmakerSlug)?.platform === 'swarm').map((a) => a.id);
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTokensReady(true);
      return;
    }
    let alive = true;
    const tick = async () => {
      await warmAccountTokens(ids);
      if (alive) setTokensReady(tokensWarm(ids));
    };
    void tick();
    const iv = window.setInterval(() => { void tick(); }, 15_000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [betting, houseBySlug]);

  // Calibra o K (max stake) de CADA conta marcada ao abrir + a cada 5min — assim
  // "os limites das contas" já ficam prontos na abertura (getAccountK cacheia por
  // conta; é 1 calculateBets, não por seleção nem por tick). O MaxBet vem da SSE.
  const kSample = useMemo(() => pickCalibrationSample(detail), [detail]);
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
  const score = scoreOf(detail);
  const clock = clockOf(detail);
  const eventName = `${detail.home} x ${detail.away}`;
  // Tick de tempo p/ reavaliar o "suspenso há >10s some" sem depender de delta.
  const tick = useNowTick(2000);
  // Favoritos: mostra o mercado suspenso com cadeado (por até 10s, via
  // filterMarkets); passado disso some e volta sozinho quando a odd reabre.
  const favMarkets = useMemo(
    () => filterMarkets(detail.markets.filter((m) => favorites.has(m.name)), {
      delayTradeOnly: settings.delayTradeOnly,
      hidePriceless: settings.hidePriceless,
      stickyKeys: antiProtect, // Anti Proteção: não some no suspenso/retirada
    }),
    // tick força reavaliar o corte por tempo; detail cobre os deltas de odd.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail.markets, favorites, settings.delayTradeOnly, settings.hidePriceless, antiProtect, tick],
  );

  const setStake = (v: number) => onUpdateSettings({ defaultStake: Math.max(HOUSE_MIN, +v.toFixed(2)) });
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? 'none' : p));

  // Monta o bilhete de UMA conta usando a odd ESPECÍFICA da casa dela (mesma
  // selectionId — mesmo core fssb). Sem preço da casa ainda → cai no da tela.
  const ticketFor = useCallback((a: NoDelayAccount, m: LiveMarket, s: LiveSelection): BetTicket => {
    const hp = getHousePrice(a.bookmakerSlug, s.id);
    return {
      eventId: detail.id,
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
  }, [detail.id, eventName, score, clock, getHousePrice]);

  // Marca um slip como resolvido (falha) — usado p/ suspenso e rejeição de rede.
  const failSlip = (key: string, ticket: BetTicket, error: string) =>
    setSlips((prev) => prev && prev.map((sl) => (sl.key === key
      ? { ...sl, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: ticket.odds, partial: false, oddsChanged: false, error } }
      : sl)));

  // Stake DAQUELA conta: K próprio (fallback p/ o K de referência do display), teto
  // com odd pessimista (drift). MÁX = min(teto, saldo) em reais inteiros; fixo =
  // min(defaultStake, teto−0,01). É a MESMA conta usada no confirm e no disparo.
  const stakeForAccount = useCallback((a: NoDelayAccount, m: LiveMarket, s: LiveSelection): number => {
    const kAcc = cachedK(a.id) ?? k ?? null;
    const hardMax = kAcc ? maxStakeOf(s, m, kAcc, MAX_STAKE_DRIFT) : null;
    if (settings.maxStakeMode) {
      if (hardMax == null) return settings.defaultStake;
      return Math.max(0, Math.floor(Math.min(hardMax, a.balance ?? hardMax)));
    }
    return hardMax != null ? Math.min(settings.defaultStake, +(hardMax - 0.01).toFixed(2)) : settings.defaultStake;
  }, [settings.maxStakeMode, settings.defaultStake, k]);

  // Dispara de verdade (mock ou real), sem porteiro. Cada conta → SUA casa, com a
  // odd DAQUELA casa. Conta cuja casa suspendeu o mercado NÃO dispara (evita cupom
  // com odd 0). Slips montados e submetidos numa passada só.
  const doFire = useCallback((m: LiveMarket, s: LiveSelection) => {
    const round = ++fireSeq.current;
    const slips: SlipView[] = [];
    const toSubmit: { key: string; a: NoDelayAccount; ticket: BetTicket; stake: number; rogueUrl?: string; isBia: boolean; altenarTicket: AltenarTicket | null; house?: NoDelayBookmaker }[] = [];

    for (const a of betting) {
      const key = `${round}:${a.id}`;
      const house = houseBySlug.get(a.bookmakerSlug);
      const label = `${a.label || a.username}${house ? ` · ${house.name}` : ''}`;
      const ticket = ticketFor(a, m, s);
      const hp = getHousePrice(a.bookmakerSlug, s.id);
      // Suspenso/sem preço NAQUELA casa (hp existe mas morto) → não aposta lá.
      // (hp === undefined = ainda não chegou o preço → usa o da tela via ticketFor.)
      if (hp && (hp.disabled || hp.price <= 0)) {
        slips.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: settings.defaultStake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: 'Suspenso nesta casa' } });
        continue;
      }
      const stake = stakeForAccount(a, m, s);
      // Abaixo do mínimo da casa (R$1) = rejeição certa (saldo/teto baixo). Não dispara.
      if (stake < HOUSE_MIN) {
        slips.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'done', result: { ok: false, elapsedMs: 0, stake: 0, odds: 0, partial: false, oddsChanged: false, error: 'Abaixo do mínimo da casa (R$ 1)' } });
        continue;
      }
      // biahosted (Altenar) → disparo server-side com ticket próprio; swarm → rogue.
      const isBia = house?.platform === 'biahosted';
      const altenarTicket = isBia ? buildAltenarTicket(detail, m, s, ticket.odds) : null;
      slips.push({ key, accountId: a.id, accountLabel: label, ticket, stakeRequested: stake, status: 'placing' });
      toSubmit.push({ key, a, ticket, stake, rogueUrl: house?.rogueUrl || undefined, isBia, altenarTicket, house });
    }
    setSlips(slips);

    const opts = { allowPartial: settings.allowPartial, acceptOddsChange: settings.acceptOddsChange };
    for (const it of toSubmit) {
      // biahosted + REAL → placeBetAltenar (CLIENT-SIDE: browser faz a cadeia SB2 +
      // posta o placeWidget direto); senão mock/placeBetReal (fssb).
      const p = it.isBia && settings.realBets && it.altenarTicket && it.house
        ? placeBetAltenar(it.a, it.house, it.altenarTicket, it.stake)
        : (settings.realBets && !it.isBia ? placeBetReal : placeBet)(it.a, it.ticket, { stake: it.stake, ...opts, rogueUrl: it.rogueUrl });
      p
        .then((result) => {
          setSlips((prev) => prev && prev.map((sl) => (sl.key === it.key ? { ...sl, status: 'done', result } : sl)));
        })
        .catch(() => failSlip(it.key, it.ticket, 'Falha de rede — confira o histórico da casa.'));
    }
  }, [betting, houseBySlug, ticketFor, getHousePrice, stakeForAccount, settings, detail]);

  // Porteiro: valida contas e decide se confirma (modal) ou dispara direto.
  const fire = useCallback((m: LiveMarket, s: LiveSelection) => {
    if (betting.length === 0) { setError('Marque ao menos uma conta para apostar.'); setPanel('accounts'); return; }
    setError(null);
    // Modo real sem "disparo direto" → confirma no mini-modal (não window.confirm).
    if (settings.realBets && !settings.instantFire) { setPending({ m, s }); return; }
    doFire(m, s);
  }, [betting.length, settings.realBets, settings.instantFire, doFire]);

  return (
    <>
      {/* Tela cheia — o modal É a tela (trade precisa de espaço). */}
      <div className="fixed inset-0 z-[9990] flex flex-col bg-brand-dark">
          {/* Cabeçalho */}
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-500/15 ring-1 ring-lime-500/30">
              <Zap size={16} className="text-lime-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">Aposta rápida</div>
              <div className="flex items-center gap-1.5 truncate text-[11px] text-gray-400">
                <span className="truncate">{eventName}</span>
                {clock && <span className="shrink-0 font-semibold text-lime-300">{clock}</span>}
                {score && <span className="shrink-0 text-gray-300">{score.home}-{score.away}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 transition hover:text-white"><X size={18} /></button>
          </div>

          {/* Barra de controle: contas · stake · config */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2 sm:px-4">
            <button
              onClick={() => togglePanel('accounts')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ring-1 transition ${
                panel === 'accounts' ? 'bg-lime-500/15 text-lime-200 ring-lime-500/40' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'
              }`}
            >
              <Users size={13} />
              <span className="font-semibold text-white">{betting.length}</span>/{connected.length} contas
              <ChevronDown size={12} className={`transition ${panel === 'accounts' ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-60"
              title="Revalidar sessão e saldo das contas"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Atualizando…' : 'Atualizar'}</span>
            </button>

            {/* Token pré-aquecido: disparo sem latência de mint. */}
            {betting.length > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium ring-1 ${
                  tokensReady ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-amber-500/10 text-amber-300 ring-amber-500/30'
                }`}
                title={tokensReady ? 'Tokens prontos — o disparo é só o placeBets (sem mint no caminho)' : 'Preparando os tokens de aposta…'}
              >
                {tokensReady ? <><Zap size={11} /> pronto</> : <><Loader2 size={11} className="animate-spin" /> preparando</>}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-[11px] text-gray-400 sm:inline">Stake</span>
              <div className={`flex items-center rounded-lg bg-black/30 ring-1 ring-white/10 transition ${settings.maxStakeMode ? 'opacity-40' : ''}`}>
                <button onClick={() => setStake(settings.defaultStake - 1)} disabled={settings.maxStakeMode} className="grid h-7 w-7 place-items-center text-gray-400 hover:text-white disabled:cursor-not-allowed"><Minus size={13} /></button>
                <input
                  value={settings.defaultStake}
                  onChange={(e) => setStake(parseFloat(e.target.value.replace(',', '.')) || 0)}
                  inputMode="decimal"
                  disabled={settings.maxStakeMode}
                  className="w-16 bg-transparent text-center text-sm font-bold tabular-nums text-white focus:outline-none"
                />
                <button onClick={() => setStake(settings.defaultStake + 1)} disabled={settings.maxStakeMode} className="grid h-7 w-7 place-items-center text-gray-400 hover:text-white disabled:cursor-not-allowed"><Plus size={13} /></button>
              </div>
              <button
                onClick={() => onUpdateSettings({ maxStakeMode: !settings.maxStakeMode })}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                  settings.maxStakeMode ? 'bg-lime-500 text-slate-900 ring-lime-400' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'
                }`}
                title="Apostar SEMPRE o máximo permitido de cada conta (limitado pelo saldo, em reais inteiros)"
              >
                MÁX
              </button>
              <button
                onClick={() => togglePanel('settings')}
                className={`grid h-7 w-7 place-items-center rounded-lg ring-1 transition ${
                  panel === 'settings' ? 'bg-lime-500/15 text-lime-300 ring-lime-500/40' : 'bg-white/5 text-gray-400 ring-white/10 hover:bg-white/10'
                }`}
                title="Configurações"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* Painel expansível: contas OU configurações */}
          {panel === 'accounts' && (
            <div className="shrink-0 border-b border-white/10 bg-black/20 px-3 py-2.5 sm:px-4">
              {connected.length === 0 ? (
                <p className="text-[11px] text-gray-500">Nenhuma conta conectada.</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {connected.map((a) => {
                    const on = selectedIds.has(a.id);
                    const h = houseBySlug.get(a.bookmakerSlug);
                    return (
                      <button
                        key={a.id}
                        onClick={() => onToggleAccount(a.id)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ring-1 transition ${
                          on ? 'bg-lime-500/10 ring-lime-500/30' : 'bg-white/[0.03] ring-white/5 hover:bg-white/5'
                        }`}
                      >
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ring-1 ${on ? 'bg-lime-500 ring-lime-500 text-slate-900' : 'ring-white/20'}`}>
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        {h && <BookmakerLogo name={h.name} slug={h.slug} logoUrl={h.logoUrl} color={h.color} size={16} />}
                        <span className={`min-w-0 flex-1 truncate text-[11px] ${on ? 'text-white' : 'text-gray-400'}`}>{a.label || a.username}</span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white">{formatMoney(a.balance, a.currency)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {panel === 'settings' && (
            <div className="shrink-0 space-y-2.5 border-b border-white/10 bg-black/20 px-3 py-3 sm:px-4">
              <SettingToggle
                label="Modo Delay Trade (só entradas de Mais)"
                hint="Esconde as seleções 'Menos de' (Under). Mercado suspenso (cadeado) continua aparecendo — é o sinal do lance."
                on={settings.delayTradeOnly}
                onToggle={() => onUpdateSettings({ delayTradeOnly: !settings.delayTradeOnly })}
              />
              <SettingToggle
                label="Ocultar mercados sem odd"
                hint="Some com o que está '—' por natureza. O suspenso NÃO some (cadeado = lance perigoso); aparece a odd quando destrava."
                on={settings.hidePriceless}
                onToggle={() => onUpdateSettings({ hidePriceless: !settings.hidePriceless })}
              />
              <div className="border-t border-white/5 pt-2.5">
                <SettingToggle
                  label="Aceitar mudança de odd"
                  hint="Se a odd variar no envio, aposta mesmo assim (recomendado no ao vivo)."
                  on={settings.acceptOddsChange}
                  onToggle={() => onUpdateSettings({ acceptOddsChange: !settings.acceptOddsChange })}
                />
              </div>
              <SettingToggle
                label="Aceitar valor parcial"
                hint="Se a casa não pegar o valor todo, aposta o máximo que ela aceitar."
                on={settings.allowPartial}
                onToggle={() => onUpdateSettings({ allowPartial: !settings.allowPartial })}
              />
              {/* Mock vs REAL — SÓ admin (todo o resto aposta sempre real). */}
              {isAdmin && (
                <div className="mt-1 rounded-lg border border-rose-500/40 bg-rose-500/[0.06] p-2.5">
                  <label className="flex cursor-pointer items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-rose-300">⚠️ Aposta REAL (admin)</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-rose-300/70">
                        Desligue para testar no mock (sem gastar). Usuários normais apostam sempre de verdade.
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ realBets: !settings.realBets })}
                      className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${settings.realBets ? 'bg-rose-500' : 'bg-white/15'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.realBets ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </label>
                </div>
              )}
              <SettingToggle
                label="Disparo direto (sem confirmar)"
                hint="Ao tocar na odd, aposta na hora — sem o modal de confirmação. Mais rápido, menos rede de segurança."
                on={settings.instantFire}
                onToggle={() => onUpdateSettings({ instantFire: !settings.instantFire })}
              />
            </div>
          )}

          {/* Banner: modo real ligado */}
          {settings.realBets && (
            <div className="shrink-0 bg-rose-500/15 px-4 py-1.5 text-center text-[11px] font-bold text-rose-200">
              ⚠️ APOSTA REAL LIGADA — cada disparo gasta dinheiro de verdade
            </div>
          )}

          {/* Estatística ao vivo (placar + escanteios/cartões/chutes) — colapsável */}
          <LiveStatsPanel game={detail} />

          {/* Favoritos — sempre à vista (as odds continuam). Quando a gaveta de
              bilhetes abre, o padding no fim deixa rolar acima dela. */}
          <div className={`flex-1 overflow-y-auto p-3 sm:p-4 ${slips ? 'pb-[48dvh]' : ''}`}>
            {error && (
              <div className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">{error}</div>
            )}

            {favMarkets.length === 0 ? (
              <div className="grid place-items-center py-10 text-center">
                <Star className="text-gray-600" size={30} />
                {favorites.size > 0 ? (
                  <>
                    <p className="mt-3 text-sm text-gray-400">Favoritos suspensos ou sem odd agora.</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-gray-600">Voltam sozinhos assim que a casa reabrir a odd.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-gray-400">Nenhum mercado favoritado ainda.</p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-gray-600">
                      Toque na <Star size={11} className="inline text-lime-300" /> de um mercado (nas odds) para deixá-lo aqui.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <NoDelayBoard markets={favMarkets} changed={changed} k={k} onFire={fire} antiProtect={antiProtect} onToggleAntiProtect={onToggleAntiProtect} />
            )}
          </div>
      </div>

      {slips && <BetSlipDrawer slips={slips} onClose={() => setSlips(null)} />}

      {/* Mini-modal de confirmação (modo real, sem disparo direto). */}
      {pending && (
        <ConfirmBetPanel
          pending={pending}
          detail={detail}
          bettingCount={betting.length}
          total={betting.reduce((sum, a) => sum + stakeForAccount(a, pending.m, pending.s), 0)}
          maxMode={settings.maxStakeMode}
          onCancel={() => setPending(null)}
          onConfirm={() => { const p = pending; setPending(null); doFire(p.m, p.s); }}
        />
      )}
    </>
  );
}

function SettingToggle({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-gray-200">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-gray-500">{hint}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? 'bg-lime-500' : 'bg-white/15'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}


/**
 * Confirmação da aposta real. A odd é RECALCULADA do feed vivo (`detail`) a cada
 * render — é a que vai de fato ser apostada, não a congelada do toque. Se o
 * mercado suspendeu entre o toque e a confirmação, bloqueia (não dispara morto).
 */
function ConfirmBetPanel({
  pending, detail, bettingCount, total, maxMode, onCancel, onConfirm,
}: {
  pending: { m: LiveMarket; s: LiveSelection };
  detail: LiveGameDetail;
  bettingCount: number;
  total: number;
  maxMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const liveMkt = detail.markets.find((mm) => mm.id === pending.m.id);
  const liveSel = liveMkt?.selections.find((ss) => ss.id === pending.s.id);
  const shownOdd = liveSel?.price ?? pending.s.price;
  const dead = !liveSel || !!liveMkt?.suspended || liveSel.disabled || liveSel.price <= 0;

  return (
    <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-xs rounded-2xl border border-rose-500/40 bg-brand-dark p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-rose-300">⚠️ Confirmar aposta real</div>
        <div className="rounded-lg bg-white/[0.04] p-3 text-center">
          <div className="text-sm font-bold text-white">{selectionLabel(pending.s.name, pending.s.points)}</div>
          <div className="text-[11px] text-gray-500">{pending.m.name}</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-lime-300">
            {dead ? <span className="inline-flex items-center gap-1 text-rose-300"><Lock size={16} /> Suspenso</span> : fmtOdd(shownOdd)}
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
          <span className="font-semibold text-white">{bettingCount}</span> conta{bettingCount === 1 ? '' : 's'}
          {maxMode && <span className="font-bold text-lime-300">· MÁX de cada</span>}
          · total <span className="font-bold text-white">{formatMoney(total)}</span>
        </div>
        {dead && <p className="mt-1.5 text-center text-[10px] text-rose-300/80">Mercado suspendeu — feche e toque de novo quando reabrir.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="rounded-lg bg-white/5 py-2.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10">
            Cancelar
          </button>
          <button disabled={dead} onClick={onConfirm} className="rounded-lg bg-rose-500 py-2.5 text-sm font-bold text-white transition hover:bg-rose-400 disabled:opacity-40">
            Apostar
          </button>
        </div>
      </div>
    </div>
  );
}
