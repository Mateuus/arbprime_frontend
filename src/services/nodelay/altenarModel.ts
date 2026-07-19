/**
 * Modelo das odds ao vivo do Altenar (biahosted) → os MESMOS tipos do rogueModel
 * (LiveGame/LiveGameDetail/LiveMarket/LiveSelection), para a UI (MarketBoard,
 * QuickBetModal, LiveStatsPanel) funcionar igual, trocando só a fonte embaixo.
 *
 * O Altenar entrega um modelo NORMALIZADO (arrays events/markets/odds/competitors/
 * champs/categories ligados por id). Aqui "desnormalizamos" para a árvore aninhada
 * que a UI já usa. A LINHA (over/under/handicap) vem no `sv` de cada odd; o estado
 * vem em `oddStatus` (0=ativa, ≠0=suspensa). O placar NÃO vem no GetEventDetails —
 * só no GetLiveOverview — então é injetado de fora (`score`).
 */
import {
  LiveGame, LiveGameDetail, LiveMarket, LiveSelection, MarketGroupRef, LiveGameInfo,
} from './rogueModel';

type AnyRec = Record<string, unknown>;
const str = (v: unknown, fb = ''): string => (v == null ? fb : String(v));
const num = (v: unknown, fb = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fb;
};

/** typeId → lado (1=casa/2=empate/3=fora); resto = 0 (over/under/etc.). */
const sideOf = (typeId: number): number => (typeId === 1 ? 1 : typeId === 2 ? 2 : typeId === 3 ? 3 : 0);
/** typeId → outcomeType p/ o filtro Delay Trade (12=Mais, 13=Menos). */
const outcomeOf = (typeId: number): string => (typeId === 12 ? 'Over' : typeId === 13 ? 'Under' : '');

/** Uma odd normalizada do Altenar → LiveSelection. */
function toSelection(o: AnyRec, order: number): LiveSelection {
  const price = num(o.price, 0);
  const oddStatus = num(o.oddStatus, -1);
  const typeId = num(o.typeId);
  // Ativa só com oddStatus 0 E odd real (>1). Travada (status 7/price 1) = disabled.
  const disabled = oddStatus !== 0 || price <= 1;
  return {
    id: str(o.id),
    name: str(o.name),
    price,
    trueOdds: price,
    line: o.sv != null ? str(o.sv) : null,
    side: sideOf(typeId),
    // O NOME do Altenar já traz a linha ("Mais de 1.5", "Capalaba (-2.5)"), então
    // NÃO passamos points — senão o selectionLabel anexa e vira "Mais de 1.5 1.5".
    points: null,
    disabled,
    order,
    outcomeType: outcomeOf(typeId),
    tplIndex: null,
    selectionTypeId: typeId, // = odd.typeId cru → selectionTypeId do placeWidget
  };
}

/** Um market do Altenar → LiveMarket (achata a grade desktopOddIds → seleções). */
function toMarket(m: AnyRec, oddById: Map<string, AnyRec>, groupsByMarket: Map<string, MarketGroupRef[]>): LiveMarket {
  // desktopOddIds é grade 2D [[linha...],[linha...]] — achata mantendo a ordem.
  const grid = (m.desktopOddIds as unknown[]) || [];
  const oddIds: string[] = [];
  for (const row of grid) for (const id of (row as unknown[]) || []) oddIds.push(str(id));

  const selections: LiveSelection[] = [];
  oddIds.forEach((oid) => {
    const o = oddById.get(oid);
    if (o) selections.push(toSelection(o, selections.length));
  });

  const id = str(m.id);
  // Altenar não manda "suspenso" no market — deriva: com seleções e TODAS mortas.
  const suspended = selections.length > 0 && selections.every((s) => s.disabled);
  return {
    id,
    name: str(m.name),
    marketTypeId: str(m.typeId),
    groups: groupsByMarket.get(id) ?? [],
    order: num(m.so, 9999),
    suspended,
    suspendedAt: suspended ? Date.now() : null,
    selections,
    tplGroups: [], // sem limite de stake na API de leitura (o MÁX é coisa do fssb)
  };
}

/** Info de placar/relógio. `score` = [casa, fora] (vem do GetLiveOverview). */
function infoOf(d: AnyRec, score?: [number, number] | null): LiveGameInfo {
  const info: LiveGameInfo = {};
  if (score && score.length === 2) { info.score1 = String(score[0]); info.score2 = String(score[1]); }
  const lt = str(d.liveTime); // ex.: "78'"
  const min = lt.replace(/\D/g, '');
  if (min) info.current_game_time = min;
  if (d.ls != null) info.current_game_state = str(d.ls);
  return info;
}

/**
 * GetEventDetails → LiveGameDetail. `score` opcional (injetado do GetLiveOverview,
 * que é onde o placar mora).
 */
export function parseAltenarEvent(d: AnyRec, score?: [number, number] | null): LiveGameDetail | null {
  const id = str(d.id);
  if (!id) return null;
  const comps = (d.competitors as AnyRec[]) || [];
  const sport = (d.sport as AnyRec) || {};
  const champ = (d.champ as AnyRec) || {};
  const cat = (d.category as AnyRec) || {};

  const oddById = new Map<string, AnyRec>();
  for (const o of (d.odds as AnyRec[]) || []) oddById.set(str(o.id), o);

  // marketGroups → abas + índice mercado→grupos (ordem = posição no grupo).
  const rawGroups = (d.marketGroups as AnyRec[]) || [];
  const groups = rawGroups.map((g, i) => ({ id: str(g.id), name: str(g.name), order: num(g.sortOrder, i) }));
  const groupsByMarket = new Map<string, MarketGroupRef[]>();
  rawGroups.forEach((g, gi) => {
    (g.marketIds as unknown[] || []).forEach((mid, order) => {
      const ref: MarketGroupRef = { id: str(g.id), name: str(g.name), order, sortingKey: num(g.sortOrder, gi) };
      const k = str(mid);
      const arr = groupsByMarket.get(k) ?? [];
      arr.push(ref);
      groupsByMarket.set(k, arr);
    });
  });

  // ⚠️ O Altenar manda cada mercado DUPLICADO em d.markets (mesmo id 2x) — dedupe
  // por id, senão o painel mostra cada mercado repetido.
  const seenMarket = new Set<string>();
  const markets = ((d.markets as AnyRec[]) || [])
    .filter((m) => { const mid = str(m.id); if (!mid || seenMarket.has(mid)) return false; seenMarket.add(mid); return true; })
    .map((m) => toMarket(m, oddById, groupsByMarket));

  const base: LiveGame = {
    id,
    sportId: str(sport.id),
    sportName: str(sport.name),
    sportOrder: num(sport.typeId, 9999),
    regionName: str(cat.name),
    competitionId: str(champ.id),
    competitionName: str(champ.name),
    home: str(comps[0]?.name),
    away: str(comps[1]?.name),
    startTs: Date.parse(str(d.startDate)) || 0,
    isBlocked: false,
    marketsCount: markets.length,
    info: infoOf(d, score),
    fsbEventId: id,
  };

  return { ...base, groups, liveStats: null, markets };
}

/** Um evento da GetLiveOverview → LiveGame (lista live). Resolve nomes pelos arrays. */
export function parseAltenarLiveList(lo: AnyRec): LiveGame[] {
  const events = (lo.events as AnyRec[]) || [];
  const byId = (arr: unknown, key = 'id'): Map<string, AnyRec> => {
    const m = new Map<string, AnyRec>();
    for (const x of (arr as AnyRec[]) || []) m.set(str(x[key]), x);
    return m;
  };
  const sportById = byId(lo.sports);
  const catById = byId(lo.categories);
  const champById = byId(lo.champs);
  const compById = byId(lo.competitors);

  return events.map((ev) => {
    const cids = (ev.competitorIds as unknown[]) || [];
    const home = compById.get(str(cids[0]));
    const away = compById.get(str(cids[1]));
    const sc = (ev.score as unknown[]) || [];
    const byName = str(ev.name).split(/\s+vs\.?\s+/i);
    const info: LiveGameInfo = {};
    if (sc.length === 2) { info.score1 = String(sc[0]); info.score2 = String(sc[1]); }
    const min = str(ev.liveTime).replace(/\D/g, '');
    if (min) info.current_game_time = min;
    if (ev.ls != null) info.current_game_state = str(ev.ls);
    const sport = sportById.get(str(ev.sportId)) || {};
    return {
      id: str(ev.id),
      sportId: str(ev.sportId),
      sportName: str(sport.name),
      sportOrder: num(sport.typeId, 9999),
      regionName: str(catById.get(str(ev.catId))?.name),
      competitionId: str(ev.champId),
      competitionName: str(champById.get(str(ev.champId))?.name),
      home: str(home?.name) || str(byName[0]),
      away: str(away?.name) || str(byName[1]),
      startTs: Date.parse(str(ev.startDate)) || 0,
      isBlocked: false,
      marketsCount: num(ev.mc),
      info,
      fsbEventId: str(ev.id),
    };
  });
}

/** Placar [casa, fora] de um evento na GetLiveOverview (p/ injetar no detail). */
export function scoreFromOverview(lo: AnyRec, eventId: string): [number, number] | null {
  for (const ev of (lo.events as AnyRec[]) || []) {
    if (str(ev.id) === eventId) {
      const sc = (ev.score as unknown[]) || [];
      if (sc.length === 2) return [num(sc[0]), num(sc[1])];
    }
  }
  return null;
}
