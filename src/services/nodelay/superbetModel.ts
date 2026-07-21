/**
 * Modelo das odds ao vivo da Superbet → os MESMOS tipos do rogueModel
 * (LiveGame/LiveGameDetail/LiveMarket/LiveSelection), pra UI (EventBoard,
 * LiveScoreboard, QuickBetModal) funcionar igual — troca só a fonte embaixo.
 *
 * Cada odd da Superbet é AUTO-CONTIDA: `{marketId, marketUuid, marketName, code,
 * name, info (label humano c/ a linha embutida), price, status, marketGroupOrder}`.
 * Agrupamos as odds por `marketUuid` (cada marketUuid = 1 card/linha; um mesmo
 * marketId pode ter vários marketUuid = várias linhas). O placar/relógio vem no
 * `metadata` do próprio evento. Nomes de esporte/país/liga vêm do `struct`; as
 * abas (grupos) do `market-groups` (índice marketId→grupos).
 */
import {
  LiveGame, LiveGameDetail, LiveMarket, LiveSelection, MarketGroupRef, LiveGameInfo,
} from './rogueModel';
import { SuperbetStruct, GroupsByMarket } from './superbetClient';

type AnyRec = Record<string, unknown>;
const str = (v: unknown, fb = ''): string => (v == null ? fb : String(v));
const num = (v: unknown, fb = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fb;
};

/** code → lado (1=casa/2=empate/3=fora); resto = 0 (over/under/handicap/etc.). */
const sideOf = (code: string): number => {
  const c = code.trim().toUpperCase();
  if (c === '1') return 1;
  if (c === 'X') return 2;
  if (c === '2') return 3;
  return 0;
};

/**
 * Detecta Over/Under de uma seleção pelo texto ("Mais de 6.5" / "Menos de 6.5") e
 * extrai a LINHA (6.5) — a Superbet quebra cada linha num marketUuid diferente, mas
 * todas compartilham o mesmo marketId; agrupamos por marketId e o EventBoard pareia
 * os dois lados por linha (`points`) numa única linha "Mais de | Menos de".
 */
function overUnderOf(text: string): { type: string; line: number | null } {
  const t = text.toLowerCase();
  let type = '';
  if (/(^|\s)(menos de|abaixo|under)\b/.test(t)) type = 'Under';
  else if (/(^|\s)(mais de|acima|over)\b/.test(t)) type = 'Over';
  if (!type) return { type: '', line: null };
  const m = text.match(/(\d+(?:[.,]\d+)?)/);
  return { type, line: m ? parseFloat(m[1].replace(',', '.')) : null };
}

/** Quebra "A·B" / "A x B" / "A - B" / "A vs B" em [casa, fora]. */
function splitTeams(matchName: string): [string, string] {
  const m = str(matchName);
  const sep = /\s*·\s*|\s+x\s+|\s+vs\.?\s+|\s+-\s+/i;
  const parts = m.split(sep);
  if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join(' ').trim()];
  return [m, ''];
}

/** Placar/relógio do evento (metadata.homeTeamScore/awayTeamScore + matchTime). */
function infoOf(ev: AnyRec): LiveGameInfo {
  const info: LiveGameInfo = {};
  const meta = (ev.metadata as AnyRec) || {};
  if (meta.homeTeamScore != null) info.score1 = str(meta.homeTeamScore);
  if (meta.awayTeamScore != null) info.score2 = str(meta.awayTeamScore);
  const min = str(meta.matchTime ?? meta.time).replace(/\D/g, '');
  if (min) info.current_game_time = min;
  return info;
}

/** Uma odd da Superbet → LiveSelection. */
function toSelection(o: AnyRec, order: number): LiveSelection {
  const price = num(o.price, 0);
  const active = str(o.status, 'active') === 'active';
  const disabled = !active || price <= 1;
  const cleanName = str(o.name); // "Mais de 6.5" / "1" / "Inter de Milão"
  const infoTxt = str(o.info); // "Mais de 6.5 gols marcados na partida" / "Inter vence"
  const ou = overUnderOf(cleanName || infoTxt);
  const isOu = ou.type !== '';
  // O/U: nome já é curto e COMPLETO ("Mais de 6.5"). A linha vai no `line` (p/ o
  //   board parear os dois lados), NÃO em `points` — senão o selectionLabel repete
  //   ("Menos de 6.5 6.5"). Resto (1X2/BTTS/handicap): `info` é o rótulo descritivo.
  const label = isOu ? cleanName : (infoTxt || cleanName || str(o.code));
  return {
    id: str(o.uuid) || `${str(o.marketUuid)}:${str(o.outcomeId)}`,
    name: label,
    price,
    trueOdds: price,
    line: isOu && ou.line != null ? String(ou.line) : null,
    side: sideOf(str(o.code)),
    points: null,
    disabled,
    order,
    outcomeType: ou.type,
    tplIndex: null,
  };
}

/**
 * Detalhe do evento (`/events/<id>` → data[0]) → LiveGameDetail.
 * `struct` resolve esporte/país/liga; `groupsByMarket`+`tabs` montam as abas.
 */
export function parseSuperbetEvent(
  raw: AnyRec,
  struct: SuperbetStruct,
  groupsByMarket: GroupsByMarket,
  tabs: { id: string; name: string; order: number }[],
): LiveGameDetail | null {
  const ev = ((raw.data as AnyRec[]) || [])[0];
  if (!ev) return null;
  const id = str(ev.eventId);
  if (!id) return null;

  const odds = (ev.odds as AnyRec[]) || [];
  // Agrupa por marketId (= 1 card por TIPO de mercado). A Superbet quebra cada linha
  // O/U num marketUuid diferente, mas todos partilham o marketId — então juntar por
  // marketId reúne as linhas (6.5, 7.5…) num card só; o board as pareia por `points`.
  // Team-totals ("Inter - Total de Gols") têm marketId próprio → ficam separados.
  const byMarket = new Map<string, AnyRec[]>();
  const orderKeep: string[] = [];
  for (const o of odds) {
    const mid = str(o.marketId);
    if (!byMarket.has(mid)) { byMarket.set(mid, []); orderKeep.push(mid); }
    byMarket.get(mid)!.push(o);
  }

  const markets: LiveMarket[] = orderKeep.map((marketId) => {
    const group = byMarket.get(marketId)!;
    const first = group[0];
    // dedupe por odd (uuid) — evita seleção repetida no card.
    const seen = new Set<string>();
    const selections: LiveSelection[] = [];
    for (const o of group) {
      const key = str(o.uuid) || `${str(o.marketUuid)}:${str(o.outcomeId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selections.push(toSelection(o, selections.length));
    }
    const suspended = selections.length > 0 && selections.every((s) => s.disabled);
    const groups: MarketGroupRef[] = groupsByMarket.get(marketId) ?? [];
    // ordem = menor marketGroupOrder do grupo (mercado "preselected" sobe).
    const order = Math.min(...group.map((o) => num(o.marketGroupOrder, 9999)));
    return {
      id: marketId,
      name: str(first.marketName),
      marketTypeId: marketId,
      groups,
      order,
      suspended,
      suspendedAt: suspended ? Date.now() : null,
      selections,
      tplGroups: [],
    };
  });

  // abas presentes: só os grupos que têm ao menos 1 market na tela.
  const present = new Set<string>();
  for (const mk of markets) for (const g of mk.groups) present.add(g.id);
  const groups = tabs
    .filter((t) => present.has(t.id))
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ id: t.id, name: t.name, order: t.order }));

  const sportId = str(ev.sportId);
  const [home, away] = splitTeams(str(ev.matchName));
  const base: LiveGame = {
    id,
    sportId,
    sportName: struct.sports.get(sportId) || '',
    sportOrder: struct.sportOrder.get(sportId) ?? 9999,
    regionName: struct.categories.get(str(ev.categoryId)) || '',
    competitionId: str(ev.tournamentId),
    competitionName: struct.tournaments.get(str(ev.tournamentId)) || '',
    home,
    away,
    startTs: num(ev.unixDateMillis) || Date.parse(str(ev.matchDate)) || 0,
    isBlocked: false,
    marketsCount: markets.length,
    info: infoOf(ev),
    fsbEventId: id,
  };

  return { ...base, groups, liveStats: null, markets };
}

/** Lista `by-date` (`data[]`) → LiveGame[] (lista live). Resolve nomes pelo struct. */
export function parseSuperbetLiveList(raw: AnyRec, struct: SuperbetStruct): LiveGame[] {
  const events = (raw.data as AnyRec[]) || [];
  return events.map((ev) => {
    const sportId = str(ev.sportId);
    const [home, away] = splitTeams(str(ev.matchName));
    return {
      id: str(ev.eventId),
      sportId,
      sportName: struct.sports.get(sportId) || '',
      sportOrder: struct.sportOrder.get(sportId) ?? 9999,
      regionName: struct.categories.get(str(ev.categoryId)) || '',
      competitionId: str(ev.tournamentId),
      competitionName: struct.tournaments.get(str(ev.tournamentId)) || '',
      home,
      away,
      startTs: num(ev.unixDateMillis) || Date.parse(str(ev.matchDate)) || 0,
      isBlocked: false,
      marketsCount: num(ev.marketCount),
      info: infoOf(ev),
      fsbEventId: str(ev.eventId),
    };
  });
}
