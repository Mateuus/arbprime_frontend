import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { useNoDelaySettings, effectiveSelected } from '@/hooks/useNoDelaySettings';
import { useNoDelayFire } from '@/hooks/useNoDelayFire';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { PrematchBoard, PrematchPick } from '@/components/nodelay/PrematchBoard';
import { BetSlip } from '@/components/nodelay/BetSlip';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { Loader2 } from 'lucide-react';

/**
 * Página de PRÉ-JOGO (rota separada da ao vivo). Renderiza o board de pré-jogo com
 * dados reais do catálogo /events, filtrados às casas da INSTÂNCIA. Tocar numa odd
 * abre o Cupom (BetSlip) em modo PREVIEW — o pré-jogo ainda não é apostável (o
 * catálogo não tem os ids apostáveis; virá dos coletores), mas o cupom já mostra a
 * seleção, as Contas Prontas e a odd de cada casa.
 */
export default function NoDelayPrematchEventPage() {
  const router = useRouter();
  const instanceId = typeof router.query.instanceId === 'string' ? router.query.instanceId : '';
  const bookmaker = typeof router.query.bookmaker === 'string' ? router.query.bookmaker : '';
  const eventId = typeof router.query.eventId === 'string' ? router.query.eventId : '';

  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { bookmakers, accounts, denied } = useNoDelay(isAuthenticated);
  const { settings, update, toggleAccount } = useNoDelaySettings();

  const [instance, setInstance] = useState<NoDelayInstance | null>(null);
  const [loadingInst, setLoadingInst] = useState(true);
  const [pick, setPick] = useState<PrematchPick | null>(null);

  const loadInstance = useCallback(async () => {
    if (!instanceId) return;
    try {
      const r = await apiGateway.getNoDelayInstance(instanceId);
      if (r.data?.result === 1) setInstance(r.data.data);
    } finally {
      setLoadingInst(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!isAuthenticated || !instanceId) return;
    void loadInstance();
  }, [isAuthenticated, instanceId, loadInstance]);

  const houseSlugs = useMemo(() => instance?.houseSlugs ?? [], [instance]);

  // Contas conectadas das casas da instância (o cupom é multi-casa).
  const connected = useMemo(
    () => accounts.filter((a) => a.status === 'connected' && (houseSlugs.length === 0 ? a.bookmakerSlug === bookmaker : houseSlugs.includes(a.bookmakerSlug))),
    [accounts, houseSlugs, bookmaker],
  );
  const connectedIds = useMemo(() => connected.map((a) => a.id), [connected]);
  const selectedIds = useMemo(() => new Set(effectiveSelected(settings.selectedAccountIds, connectedIds)), [settings.selectedAccountIds, connectedIds]);
  const bettingAccounts = useMemo(() => connected.filter((a) => selectedIds.has(a.id)), [connected, selectedIds]);
  const houseBySlug = useMemo(() => {
    const m = new Map<string, NoDelayBookmaker>();
    for (const b of bookmakers) m.set(b.slug, b);
    return m;
  }, [bookmakers]);

  // Adapta a seleção tocada no pré-jogo pro formato do cupom (preview).
  const detail = useMemo<LiveGameDetail | null>(() => (pick ? {
    id: eventId, sportId: '', sportName: '', sportOrder: 9999,
    regionName: '', competitionId: '', competitionName: '',
    home: pick.home, away: pick.away, startTs: 0, isBlocked: false,
    marketsCount: 0, info: {}, fsbEventId: eventId, groups: [], liveStats: null, markets: [],
  } : null), [pick, eventId]);

  const getHousePrice = useCallback((slug: string): HousePrice | undefined => {
    if (!pick) return undefined;
    const p = pick.prices.find((x) => x.bookmaker === slug);
    // Carrega o eventId + placeable DAQUELA casa → o disparo server-side (Superbet)
    // aposta com o oddUuid/eventId corretos da casa.
    return p ? { price: p.price, points: null, line: null, disabled: false, eventId: p.eventId, placeable: p.placeable ?? null } : undefined;
  }, [pick]);

  const fire = useNoDelayFire({ detail, houseBySlug, getHousePrice, betting: bettingAccounts, settings, k: null, forceFixedStake: true, betType: 'prematch' });

  const slipPick = useMemo(() => {
    if (!pick) return null;
    const price = pick.prices[0]?.price ?? 0;
    const m: LiveMarket = { id: pick.marketId, name: pick.marketName, marketTypeId: pick.marketId, groups: [], order: 0, suspended: false, suspendedAt: null, selections: [], tplGroups: [] };
    const s: LiveSelection = { id: `${pick.marketId}:${pick.selectionLabel}`, name: pick.selectionLabel, price, trueOdds: price, line: null, side: 0, points: null, disabled: false, order: 0, outcomeType: '', tplIndex: null };
    return { m, s };
  }, [pick]);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        {loadingInst ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="animate-spin" size={18} /> Carregando…
          </div>
        ) : (
          <PrematchBoard
            bookmaker={bookmaker}
            eventId={eventId}
            houseSlugs={houseSlugs}
            onPick={setPick}
            onBack={() => router.push(`/nodelay/${instanceId}?tab=prematch`)}
            onOpenEvent={(bm, id) => router.push(`/nodelay/${instanceId}/prematch/${bm}/${id}`)}
          />
        )}

        {pick && detail && slipPick && (
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
            onClose={() => setPick(null)}
          />
        )}
      </div>
    </NoDelayGate>
  );
}
