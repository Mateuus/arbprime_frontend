import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { useInstanceLiveEvent } from '@/hooks/useInstanceLiveEvent';
import { useNoDelaySessionKeeper } from '@/hooks/useNoDelaySessionKeeper';
import { useNoDelayMaxStake } from '@/hooks/useNoDelayMaxStake';
import { useNoDelaySettings, effectiveSelected } from '@/hooks/useNoDelaySettings';
import { useNoDelayFavorites } from '@/hooks/useNoDelayFavorites';
import { useNoDelayAntiProtect } from '@/hooks/useNoDelayAntiProtect';
import { refreshAllAccounts, errorText } from '@/services/nodelay/connect';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { LiveScoreboard } from '@/components/nodelay/LiveScoreboard';
import { MatchRadar } from '@/components/nodelay/MatchRadar';
import { EventBoard } from '@/components/nodelay/EventBoard';
import { BetSlip } from '@/components/nodelay/BetSlip';
import { BetSlipDrawer } from '@/components/nodelay/BetSlipDrawer';
import { useNoDelayFire } from '@/hooks/useNoDelayFire';
import { LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { useAltenarLiveEvent } from '@/hooks/useAltenarLiveEvent';
import { useSuperbetLiveEvent } from '@/hooks/useSuperbetLiveEvent';
import { BetSettingsPopover } from '@/components/nodelay/BetSettingsPopover';
import { QuickBetModal } from '@/components/nodelay/QuickBetModal';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { formatMoney } from '@/utils/nodelayUi';
import { ArrowLeft, Loader2, AlertTriangle, Users, Wallet, Wifi, WifiOff, Zap, Check } from 'lucide-react';

/**
 * Página do evento ao vivo: radar + placar em cima, odds por mercado embaixo (de
 * UMA casa só — a primária), e as contas de TODAS as casas da instância sempre à
 * vista (a aposta sai de todas de uma vez).
 *
 * O MESMO evento é assinado em todas as casas prontas (mesmo `_id` — mesmo core
 * fssb); o disparo pega a odd específica de cada casa. Um clique = aposta em
 * todas as contas marcadas, em todas as casas.
 */
export default function NoDelayEventPage() {
  const router = useRouter();
  const instanceId = typeof router.query.instanceId === 'string' ? router.query.instanceId : '';
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const gameId = typeof router.query.id === 'string' ? router.query.id : '';

  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { bookmakers, accounts, denied, reload: reloadNd } = useNoDelay(isAuthenticated);

  // Casas da instância (carrega uma vez para saber onde disparar).
  const [houseSlugs, setHouseSlugs] = useState<string[]>([]);
  useEffect(() => {
    if (!isAuthenticated || !instanceId) return;
    let alive = true;
    apiGateway.getNoDelayInstance(instanceId)
      .then((r) => { if (alive && r.data?.result === 1) setHouseSlugs((r.data.data as NoDelayInstance).houseSlugs || []); })
      .catch(() => { /* instância pode ter sumido — segue sem casas extras */ });
    return () => { alive = false; };
  }, [isAuthenticated, instanceId]);

  const primary = useMemo(() => bookmakers.find((b) => b.slug === slug), [bookmakers, slug]);
  // Casa primária é biahosted (Altenar)? → renderiza o branch de polling (odds via
  // REST), não o fluxo fssb/SSE. As duas árvores de hooks convivem (a fssb no-opa
  // sem casa rogue), então dá pra fazer early-return depois de TODOS os hooks.
  const isBiaPrimary = primary?.platform === 'biahosted' && !!primary?.oddsUrl;
  const isSuperbetPrimary = primary?.platform === 'superbet';
  const houseBySlug = useMemo(() => {
    const m = new Map<string, NoDelayBookmaker>();
    for (const b of bookmakers) m.set(b.slug, b);
    return m;
  }, [bookmakers]);

  // Casas a assinar: a primária (exibida) na frente, depois as demais da instância.
  const subHouses = useMemo(() => {
    const inst = bookmakers.filter((b) => houseSlugs.includes(b.slug) && b.ready && b.rogueUrl);
    const rest = inst.filter((h) => h.slug !== slug);
    return primary?.ready && primary.rogueUrl ? [primary, ...rest] : inst;
  }, [bookmakers, houseSlugs, slug, primary]);

  const { favorites, toggle: toggleFavorite } = useNoDelayFavorites();
  const { antiProtect, toggle: toggleAntiProtect } = useNoDelayAntiProtect();
  // Fonte do evento POR PLATAFORMA, mesmo layout embaixo: fssb (SSE) ou biahosted
  // (Altenar/polling). As duas rodam (a inativa recebe input vazio e no-opa) e a
  // gente escolhe o resultado — assim a página do evento é IGUAL nas duas.
  const serverSidePrimary = isBiaPrimary || isSuperbetPrimary;
  const fssbEvent = useInstanceLiveEvent(serverSidePrimary ? [] : subHouses, gameId, antiProtect);
  const biaEvent = useAltenarLiveEvent(isBiaPrimary ? primary : undefined, gameId);
  const sbEvent = useSuperbetLiveEvent(isSuperbetPrimary ? primary : undefined, gameId);
  const { detail, loading, error, changed, live, getHousePrice } =
    isSuperbetPrimary ? sbEvent : isBiaPrimary ? biaEvent : fssbEvent;

  // Mantém as sessões vivas + reconecta as que caírem, sozinho.
  useNoDelaySessionKeeper(subHouses, reloadNd, isAuthenticated);

  const { settings, update, toggleAccount } = useNoDelaySettings();
  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // "Atualizar" as contas (sessão + saldo) sem sair do evento.
  const refreshAccounts = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshAllAccounts(subHouses, undefined);
      await reloadNd();
    } catch (e) {
      alert(errorText(e, 'Não foi possível atualizar as contas.'));
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, subHouses, reloadNd]);

  // Contas conectadas de TODAS as casas da instância (o disparo é multi-casa).
  const connected = useMemo(
    () => accounts.filter((a) => a.status === 'connected' && (houseSlugs.length === 0 ? a.bookmakerSlug === slug : houseSlugs.includes(a.bookmakerSlug))),
    [accounts, houseSlugs, slug],
  );
  const connectedIds = useMemo(() => connected.map((a) => a.id), [connected]);
  const selectedIds = useMemo(
    () => new Set(effectiveSelected(settings.selectedAccountIds, connectedIds)),
    [settings.selectedAccountIds, connectedIds],
  );
  const bettingAccounts = useMemo(() => connected.filter((a) => selectedIds.has(a.id)), [connected, selectedIds]);
  const caixa = connected.reduce((s, a) => s + (a.balance ?? 0), 0);
  const temSaldo = connected.some((a) => a.balance != null);
  const multiHouse = new Set(connected.map((a) => a.bookmakerSlug)).size > 1;

  // K (fator do max stake) calibrado numa conta DA CASA PRIMÁRIA (a exibida). Se
  // não houver conta conectada nessa casa, não calibra pelo display (o token de
  // OUTRA casa não vale na rogue da primária) — o disparo calibra por conta.
  const refAccount = useMemo(() => connected.find((a) => a.bookmakerSlug === slug), [connected, slug]);
  const maxStakeK = useNoDelayMaxStake(primary?.rogueUrl ?? null, refAccount?.id ?? null, detail);

  // Betslip (tap-to-bet no quadro): tocar na odd SEMPRE abre o CUPOM. O "Disparo
  // direto" NÃO existe aqui — é exclusivo do modal Aposta Rápida. O resultado do
  // disparo (feito pelo cupom) aparece no BetSlipDrawer.
  const [slipPick, setSlipPick] = useState<{ m: LiveMarket; s: LiveSelection } | null>(null);
  const fire = useNoDelayFire({ detail, houseBySlug, getHousePrice, betting: bettingAccounts, settings, k: maxStakeK });
  const onPickOdd = useCallback((m: LiveMarket, s: LiveSelection) => setSlipPick({ m, s }), []);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        <button
          onClick={() => router.push(`/nodelay/${instanceId}?tab=live`)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-lime-300"
        >
          <ArrowLeft size={14} /> Eventos ao vivo
        </button>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
            <Loader2 className="animate-spin" size={18} /> Carregando o jogo…
          </div>
        ) : error || !detail ? (
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <AlertTriangle className="mx-auto text-amber-400" size={26} />
            <p className="mt-3 text-sm text-gray-300">{error || 'Jogo indisponível.'}</p>
            <button
              onClick={() => router.push(`/nodelay/${instanceId}?tab=live`)}
              className="mt-4 rounded-lg bg-white/5 px-4 py-2 text-xs text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              Voltar aos jogos
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Coluna principal */}
            <div className="min-w-0 space-y-4">
              {primary && !serverSidePrimary && (
                <MatchRadar house={primary} fsbEventId={detail.fsbEventId} sportId={detail.sportId} />
              )}
              <LiveScoreboard game={detail} />
              <EventBoard
                detail={detail}
                changed={changed}
                onPick={onPickOdd}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                delayTradeOnly={settings.delayTradeOnly}
                hidePriceless={settings.hidePriceless}
                k={maxStakeK}
              />
            </div>

            {/* Lateral: contas prontas para disparar (todas as casas) */}
            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <Users size={12} /> Contas prontas
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
                        live ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-white/5 text-gray-400 ring-white/10'
                      }`}
                      title={live ? 'Recebendo odds em tempo real' : 'Sem conexão ao vivo'}
                    >
                      {live ? <Wifi size={9} /> : <WifiOff size={9} />} {live ? 'tempo real' : 'offline'}
                    </span>
                    <BetSettingsPopover settings={settings} onUpdate={update} />
                  </div>
                </div>

                {connected.length === 0 ? (
                  <p className="text-[11px] text-gray-500">
                    Nenhuma conta conectada. Conecte em{' '}
                    <button onClick={() => router.push(`/nodelay/${instanceId}?tab=live`)} className="text-lime-300 hover:underline">
                      Casas e contas
                    </button>{' '}
                    para poder disparar.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex items-baseline gap-1.5">
                      <Wallet size={12} className="text-gray-500" />
                      <span className="text-lg font-bold tabular-nums text-white">
                        {temSaldo ? formatMoney(caixa) : '—'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        · {bettingAccounts.length}/{connected.length} marcada{bettingAccounts.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Marcar quais contas apostam — com a casa de cada uma */}
                    <ul className="space-y-1.5">
                      {connected.map((a) => {
                        const on = selectedIds.has(a.id);
                        const h = houseBySlug.get(a.bookmakerSlug);
                        return (
                          <li key={a.id}>
                            <button
                              onClick={() => toggleAccount(a.id, connectedIds)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ring-1 transition ${
                                on ? 'bg-lime-500/10 ring-lime-500/30' : 'bg-black/20 ring-white/5 hover:bg-white/5'
                              }`}
                            >
                              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ring-1 transition ${
                                on ? 'bg-lime-500 ring-lime-500 text-slate-900' : 'bg-transparent ring-white/20'
                              }`}>
                                {on && <Check size={11} strokeWidth={3} />}
                              </span>
                              {h && <BookmakerLogo name={h.name} slug={h.slug} logoUrl={h.logoUrl} color={h.color} size={16} />}
                              <span className={`min-w-0 flex-1 truncate text-[11px] ${on ? 'text-white' : 'text-gray-400'}`}>{a.label || a.username}</span>
                              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white">
                                {formatMoney(a.balance, a.currency)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      onClick={() => setQuickOpen(true)}
                      disabled={bettingAccounts.length === 0}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-lime-500 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-lime-400 disabled:opacity-40"
                    >
                      <Zap size={16} /> Aposta rápida
                    </button>
                    <p className="mt-1.5 text-center text-[10px] text-gray-600">
                      {multiHouse ? 'Um toque aposta em todas as casas marcadas. ' : ''}Favorite mercados na <span className="text-lime-300">★</span> para a entrada em 1 toque.
                    </p>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Botão flutuante no MOBILE: na tela pequena a lateral fica lá embaixo,
            então o acesso ao trade (contas + config + disparo) vem por aqui. */}
        {!loading && detail && connected.length > 0 && (
          <button
            onClick={() => setQuickOpen(true)}
            className="fixed bottom-[76px] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-lime-500 px-5 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-lime-500/20 transition hover:bg-lime-400 lg:hidden"
          >
            <Zap size={18} /> Aposta rápida
          </button>
        )}

        {quickOpen && detail && (
          <QuickBetModal
            detail={detail}
            houseBySlug={houseBySlug}
            getHousePrice={getHousePrice}
            favorites={favorites}
            connected={connected}
            selectedIds={selectedIds}
            onToggleAccount={(id) => toggleAccount(id, connectedIds)}
            settings={settings}
            onUpdateSettings={update}
            onClose={() => setQuickOpen(false)}
            onRefresh={refreshAccounts}
            refreshing={refreshing}
            k={maxStakeK}
            changed={changed}
            antiProtect={antiProtect}
            onToggleAntiProtect={toggleAntiProtect}
          />
        )}

        {/* Betslip (Disparo direto desligado) + resultado do disparo (drawer). */}
        {slipPick && detail && (
          <BetSlip
            pick={slipPick}
            detail={detail}
            fire={fire}
            houseBySlug={houseBySlug}
            getHousePrice={getHousePrice}
            connected={connected}
            selectedIds={selectedIds}
            onToggleAccount={(id) => toggleAccount(id, connectedIds)}
            settings={settings}
            onUpdateSettings={update}
            onClose={() => setSlipPick(null)}
          />
        )}
        {fire.slips && <BetSlipDrawer slips={fire.slips} onClose={fire.reset} />}
      </div>
    </NoDelayGate>
  );
}
