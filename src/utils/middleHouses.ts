// "Outras casas com esta seleção" para os middles. O payload do middle NÃO traz
// otherOdds (diferente das surebets); então buscamos sob demanda o GRUPO do
// evento (GET /external/events/group/:bm/:eid → todas as casas, mercados mesclados
// por seleção) e casamos cada perna à sua seleção. Uma única chamada (por qualquer
// perna) cobre o grupo inteiro, logo serve as DUAS pernas do middle.
import { useEffect, useState } from 'react';
import { apiGateway, EventGroupDetail, EventGroupMarket, EventGroupSelection } from '@/gateways/api.gateway';
import { MiddleLeg } from '@/interfaces/middle.interface';

export interface HouseOpt {
  bookmaker: string;
  eventId: string;
  price: number;
  size: number | null;
  used: boolean; // é a casa atual da perna?
}

export interface LegHouses {
  houses: HouseOpt[];
  marketId: string | null;   // p/ buscar histórico (getExternalEventHistory)
  selectionName: string | null;
}

// A linha bate? Comparamos pelo módulo (over/under na mesma linha têm o mesmo
// |handicap|; o lado é desambiguado por casa+preço). Tolerante a sinal/ruído.
const lineMatches = (handicap: string, line: number): boolean => {
  const h = parseFloat(String(handicap));
  if (!Number.isFinite(h)) return !Number.isFinite(line) || line === 0;
  return Math.abs(Math.abs(h) - Math.abs(line)) < 0.001;
};

/**
 * Acha a seleção do grupo que corresponde à perna do middle: procura, em todos os
 * mercados, a seleção que tem um preço da PRÓPRIA casa da perna com o MESMO preço
 * (±0.02) — e, de preferência, a mesma linha. Isso identifica o lado certo sem
 * depender de casar texto "over/under".
 */
export function matchLegSelection(markets: EventGroupMarket[], leg: MiddleLeg): { market: EventGroupMarket; selection: EventGroupSelection } | null {
  let fallback: { market: EventGroupMarket; selection: EventGroupSelection } | null = null;
  const slug = leg.bookmaker.toLowerCase();
  for (const mk of markets) {
    for (const sel of mk.selections) {
      const own = sel.prices.find((p) => (p.bookmaker || '').toLowerCase() === slug && Math.abs(p.price - leg.price) < 0.02);
      if (!own) continue;
      if (lineMatches(sel.handicap, leg.line)) return { market: mk, selection: sel };
      if (!fallback) fallback = { market: mk, selection: sel };
    }
  }
  return fallback;
}

// Lista de casas (dedupe por casa) que oferecem esta seleção: a própria perna +
// alternativas, ordenadas pela melhor odd. Garante a casa atual presente.
export function housesFromSelection(selection: EventGroupSelection, leg: MiddleLeg): HouseOpt[] {
  const m = new Map<string, HouseOpt>();
  m.set(leg.bookmaker.toLowerCase(), { bookmaker: leg.bookmaker, eventId: leg.eventId, price: leg.price, size: leg.size ?? null, used: true });
  for (const p of selection.prices) {
    const k = (p.bookmaker || '').toLowerCase();
    if (!m.has(k)) m.set(k, { bookmaker: p.bookmaker, eventId: p.eventId, price: p.price, size: p.size ?? null, used: false });
  }
  return Array.from(m.values()).sort((a, b) => b.price - a.price);
}

const onlySelf = (leg: MiddleLeg): LegHouses => ({
  houses: [{ bookmaker: leg.bookmaker, eventId: leg.eventId, price: leg.price, size: leg.size ?? null, used: true }],
  marketId: leg.market,
  selectionName: null,
});

/**
 * Busca (sob demanda) o grupo do evento e devolve, por perna, as casas que têm a
 * mesma seleção (+ o marketId/seleção p/ histórico). Uma chamada cobre todas as
 * pernas. `enabled` controla o fetch (só quando o modal/seletor abre).
 */
export function useMiddleHouses(legs: MiddleLeg[], enabled: boolean) {
  const [legInfo, setLegInfo] = useState<LegHouses[]>([]);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<EventGroupDetail['event'] | null>(null);

  const sig = legs.map((l) => `${l.bookmaker}:${l.eventId}:${l.price}:${l.line}`).join('|');

  useEffect(() => {
    if (!enabled || legs.length === 0) {
      setLegInfo(legs.map(onlySelf));
      return;
    }
    let active = true;
    setLoading(true);
    apiGateway
      .getEventGroup(legs[0].bookmaker, legs[0].eventId)
      .then((res) => {
        if (!active) return;
        const detail: EventGroupDetail | null = res.data?.result === 1 ? (res.data.data as EventGroupDetail) : null;
        const markets = detail?.markets || [];
        setEvent(detail?.event ?? null);
        setLegInfo(legs.map((l) => {
          const match = matchLegSelection(markets, l);
          if (!match) return onlySelf(l);
          return { houses: housesFromSelection(match.selection, l), marketId: match.market.marketId, selectionName: match.selection.selection };
        }));
      })
      .catch(() => { if (active) setLegInfo(legs.map(onlySelf)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig]);

  return { legInfo, loading, event };
}
