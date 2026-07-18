/**
 * Modelo das odds ao vivo — fonte ROGUE (FSB), a MESMA que o site 7games usa.
 *
 * Trocamos o swarm por isto porque o swarm dava odd DIFERENTE (livro pior) e
 * nomes genéricos "W1/W2". A rogue traz a odd real, o nome do time e as
 * categorias nativas do site (Todos/Principais/Gols/…), além do `_id` apostável.
 *
 * Estes tipos são consumidos pela UI (LiveScoreboard/MarketBoard/LiveGamesList);
 * os nomes de campo são os mesmos que a UI já usava, então os componentes não
 * mudam — só a fonte embaixo.
 */

export interface LiveGameInfo {
  score1?: string;
  score2?: string;
  current_game_state?: string;
  current_game_time?: string;
  [k: string]: unknown;
}

export interface LiveGame {
  id: string; // eventId da FSB — é a chave do radar também
  sportId: string;
  sportName: string;
  sportOrder: number;
  regionName: string;
  competitionId: string;
  competitionName: string;
  home: string;
  away: string;
  startTs: number;
  isBlocked: boolean;
  marketsCount: number;
  info: LiveGameInfo;
  fsbEventId: string; // = id (mantido p/ compat com MatchRadar)
}

export interface LiveSelection {
  id: string; // _id APOSTÁVEL da rogue (ex.: 0ML…H)
  name: string; // "Vitória" / "Empate" / "Mais de" …
  price: number;
  trueOdds: number; // odd COM precisão (a casa calcula o max stake com esta, não a display)
  line: string | null; // BetslipLine ("Mais de 0.5")
  side: number; // 1=home 2=draw 3=away
  points: number | null;
  disabled: boolean;
  order: number;
  outcomeType: string; // "Over" / "Under" / "Home" … (p/ filtro Delay Trade)
  tplIndex: number | null; // TemplateGroupSettingsIndex → aponta pro limite do mercado
}

/** Limite de aposta do mercado (TemplateGroupSettings). MaxBet = teto de LUCRO/K. */
export interface TplGroup {
  minBet: number;
  maxBet: number;
  singleEnabled: boolean;
}

/** Cada mercado sabe em QUE abas (categorias) ele entra e com que ordem. */
export interface MarketGroupRef {
  id: string; // "Principais" / "Gols" / "Todos" …
  name: string;
  order: number; // MarketOrder DENTRO daquela aba
  sortingKey: number; // ordena as abas entre si
}

export interface LiveMarket {
  id: string;
  name: string;
  marketTypeId: string;
  groups: MarketGroupRef[];
  order: number;
  suspended: boolean;
  /** epoch ms de quando entrou em suspenso (p/ sumir depois de X s). null = ativo. */
  suspendedAt: number | null;
  selections: LiveSelection[];
  /** TemplateGroupSettings do mercado (1-2 entradas). Resolver por sel.tplIndex. */
  tplGroups: TplGroup[];
}

export interface LiveGameDetail extends LiveGame {
  /** Abas na ordem do site (MarketGroups do evento). */
  groups: { id: string; name: string; order: number }[];
  stats: Record<string, { team1_value?: number | string; team2_value?: number | string }> | null;
  markets: LiveMarket[];
}

type AnyRec = Record<string, unknown>;
const str = (v: unknown, fb = ''): string => (v == null ? fb : String(v));
const num = (v: unknown, fb = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fb;
};

/** DisplayOdds decimal → número. "0.00" = suspenso. */
function oddOf(sel: AnyRec): number {
  const d = sel.DisplayOdds as AnyRec | undefined;
  const dec = d?.Decimal ?? sel.TrueOdds;
  return num(dec, 0);
}

/** Seleção morta? Mesma regra no initial e no delta (senão os dois divergem). */
function isSelectionDisabled(s: AnyRec): boolean {
  return s.IsDisabled === true || s.Status === 1 || oddOf(s) <= 0;
}

/**
 * Info de placar/relógio a partir de Score + LiveGameState. SÓ inclui as chaves
 * que REALMENTE vieram — nunca `undefined`. Isso é crucial: os updates são
 * parciais (um traz só relógio, outro só placar) e, no merge `{...info,...novo}`,
 * uma chave `undefined` apagaria o valor bom (era o "placar some às vezes").
 */
export function gameStateToInfo(ev: AnyRec): LiveGameInfo {
  const score = ev.Score as AnyRec | undefined;
  const lgs = ev.LiveGameState as AnyRec | undefined;
  const info: LiveGameInfo = {};
  if (score?.HomeScore != null) info.score1 = String(score.HomeScore);
  if (score?.AwayScore != null) info.score2 = String(score.AwayScore);
  if (lgs?.GameTime != null) {
    const secs = num(lgs.GameTime);
    if (secs > 0) info.current_game_time = String(Math.floor(secs / 60));
  }
  return info;
}

/**
 * Um changeset É um snapshot completo de evento? (tem os dados p/ montar o card.)
 * Os updates parciais (placar, market) NÃO têm — tratá-los como evento criaria
 * cards vazios que sobrescrevem os bons. Ver useLiveGames.
 */
export function isFullEvent(cs: AnyRec): boolean {
  return Array.isArray(cs.Participants) || !!cs.EventName;
}

/** Um evento da LISTA (Changeset completo) → LiveGame. */
export function eventToLiveGame(ev: AnyRec): LiveGame | null {
  const id = str(ev._id);
  if (!id) return null;
  const parts = (ev.Participants as AnyRec[]) || [];
  // EventName "A vs B" como fallback quando Participants não vier separado.
  const byName = str(ev.EventName).split(/\s+vs\.?\s+|\s+x\s+/i);
  return {
    id,
    sportId: str(ev.SportId),
    sportName: str(ev.SportName),
    sportOrder: num(ev.SportOrder, 9999),
    regionName: str(ev.RegionName),
    competitionId: str(ev.LeagueId),
    competitionName: str(ev.LeagueName),
    home: str(parts[0]?.Name) || str(byName[0]),
    away: str(parts[1]?.Name) || str(byName[1]),
    startTs: num(ev.StartEventDate),
    isBlocked: ev.IsSuspended === true,
    marketsCount: num(ev.TotalActiveMarketsCount ?? ev.TotalMarketsCount),
    info: gameStateToInfo(ev),
    fsbEventId: id,
  };
}

/**
 * Aplica um update PARCIAL de evento (Type:"event": placar/estado) num LiveGame
 * já existente — sem tocar em nome/liga/esporte (que o parcial não traz).
 */
export function patchLiveGame(prev: LiveGame, cs: AnyRec): LiveGame {
  const patch = gameStateToInfo(cs);
  return {
    ...prev,
    isBlocked: cs.IsSuspended != null ? cs.IsSuspended === true : prev.isBlocked,
    info: { ...prev.info, ...patch },
  };
}

/** Uma selection da rogue → LiveSelection. */
function toSelection(s: AnyRec): LiveSelection {
  return {
    id: str(s._id),
    name: str(s.Name),
    price: oddOf(s),
    trueOdds: num(s.TrueOdds, oddOf(s)),
    line: s.BetslipLine != null ? str(s.BetslipLine) : null,
    side: num(s.Side),
    points: typeof s.Points === 'number' ? s.Points : null,
    disabled: isSelectionDisabled(s),
    order: num(s.Group),
    outcomeType: str(s.OutcomeType),
    tplIndex: typeof s.TemplateGroupSettingsIndex === 'number' ? s.TemplateGroupSettingsIndex : null,
  };
}

/** TemplateGroupSettings cru → TplGroup[] (limites do mercado). */
export function parseTplGroups(raw: unknown): TplGroup[] {
  return ((raw as AnyRec[]) || []).map((g) => ({
    minBet: num(g.MinBet),
    maxBet: num(g.MaxBet),
    singleEnabled: g.SingleBetIsEnabled !== false,
  }));
}

/** Um market da rogue → LiveMarket. */
function toMarket(m: AnyRec): LiveMarket {
  const inGroups = (m.InMarketGroups as AnyRec[]) || [];
  const groups: MarketGroupRef[] = inGroups.map((g) => ({
    id: str(g._id ?? g.Name),
    name: str(g.Name),
    order: num(g.MarketOrder, 9999),
    sortingKey: num(g.SortingKey, 9999),
  }));
  const mt = m.MarketType as AnyRec | undefined;
  const suspended = m.IsSuspended === true;
  return {
    id: str(m._id),
    name: str(m.Name),
    marketTypeId: str(mt?._id),
    groups,
    order: num(m.MarketOrder, 9999),
    suspended,
    suspendedAt: suspended ? Date.now() : null,
    selections: ((m.Selections as AnyRec[]) || []).map(toSelection),
    tplGroups: parseTplGroups(m.TemplateGroupSettings),
  };
}

/** O evento COMPLETO (Changeset.event do initial) → LiveGameDetail. */
export function eventToDetail(ev: AnyRec): LiveGameDetail | null {
  const base = eventToLiveGame(ev);
  if (!base) return null;

  const rawGroups = (ev.MarketGroups as unknown[]) || [];
  // MarketGroups é lista de strings (nomes). A ordem da lista É a ordem das abas.
  const groups = rawGroups.map((g, i) => ({ id: String(g), name: String(g), order: i }));

  const markets = ((ev.Markets as AnyRec[]) || []).map(toMarket);

  return {
    ...base,
    groups,
    stats: null, // rogue traz stats fora do market; ligamos depois se precisar
    markets,
  };
}

/**
 * Aplica um delta de market (Operation:"update", Type:"market") no detalhe.
 * O delta traz `Reference.MarketId` + `Changeset.Selections:[{_id,TrueOdds,DisplayOdds}]`.
 * Merge por selection `_id`. Devolve objeto novo + ids que mudaram (p/ piscar).
 */
export function applyRogueDelta(
  detail: LiveGameDetail,
  op: AnyRec,
): { next: LiveGameDetail; changed: Set<string> } {
  const changed = new Set<string>();
  const ref = op.Reference as AnyRec | undefined;
  const cs = op.Changeset as AnyRec | undefined;
  if (!ref || !cs) return { next: detail, changed };

  const marketId = str(ref.MarketId);
  const selPatch = new Map<string, { price: number; trueOdds: number; disabled: boolean }>();
  for (const s of (cs.Selections as AnyRec[]) || []) {
    const id = str(s._id);
    if (id) selPatch.set(id, { price: oddOf(s), trueOdds: num(s.TrueOdds, oddOf(s)), disabled: isSelectionDisabled(s) });
  }
  // Flag de suspensão só quando o delta REALMENTE traz IsSuspended — senão um
  // delta só-de-odd zeraria o "Suspenso" (o sinal do lance perigoso). Igual ao
  // patchLiveGame. null = não veio no delta → preserva o cacheado.
  const suspendedFlag = ref.IsSuspended != null ? ref.IsSuspended === true : null;
  // MaxBet só vem em ~1/6 dos deltas — MERGE: só troca os limites se o delta os
  // trouxer NÃO-VAZIOS, senão preserva (array vazio não deve apagar o MÁX).
  const tplGroups = Array.isArray(cs.TemplateGroupSettings) && (cs.TemplateGroupSettings as unknown[]).length > 0
    ? parseTplGroups(cs.TemplateGroupSettings)
    : null;

  let hit = false;
  const markets = detail.markets.map((m) => {
    if (m.id !== marketId) return m;
    hit = true;
    const selections = m.selections.map((s) => {
      const p = selPatch.get(s.id);
      if (!p) return s;
      const priceChanged = p.price !== s.price;
      if (priceChanged || p.disabled !== s.disabled || p.trueOdds !== s.trueOdds) {
        if (priceChanged) changed.add(s.id);
        return { ...s, price: p.price, trueOdds: p.trueOdds, disabled: p.disabled };
      }
      return s;
    });
    // DES-SUSPENDE SOZINHO quando a odd volta: mercado com seleção viva (odd>0) é
    // apostável, logo não está suspenso — mesmo que o delta de reabrir não traga
    // IsSuspended=false (às vezes só as odds voltam; sem isto ficava preso em
    // suspenso até o F5). Sem seleção viva: o flag explícito manda, senão preserva
    // (não deixa um tick de odd 0 apagar o cadeado do lance perigoso).
    const nowHasActive = selections.some((s) => !s.disabled && s.price > 0);
    const nextSuspended = nowHasActive ? false : (suspendedFlag ?? m.suspended);
    // Carimba QUANDO entrou em suspenso (p/ sumir após X s). Mantém o carimbo se
    // continua suspenso; zera ao voltar a ativar.
    const nextSuspendedAt = nextSuspended ? (m.suspended ? m.suspendedAt : Date.now()) : null;
    return { ...m, selections, suspended: nextSuspended, suspendedAt: nextSuspendedAt, ...(tplGroups ? { tplGroups } : {}) };
  });

  if (!hit) return { next: detail, changed };
  return { next: { ...detail, markets }, changed };
}

/** Remove um mercado do detalhe (op `delete` de market — mercado encerrado/some). */
export function removeMarket(detail: LiveGameDetail, marketId: string): LiveGameDetail {
  if (!marketId) return detail;
  const markets = detail.markets.filter((m) => m.id !== marketId);
  return markets.length === detail.markets.length ? detail : { ...detail, markets };
}

/**
 * Adiciona/substitui um mercado (op `add` de market). A fssb move a LINHA
 * trocando o mercado inteiro: deleta o velho (ex.: Total 2.5) e envia um `add`
 * com o novo COMPLETO (ex.: Total 3.5) — mesmos campos do initial, então
 * toMarket parseia direto. Sem tratar isto, a linha velha ficava travada.
 */
export function upsertMarket(detail: LiveGameDetail, cs: AnyRec): LiveGameDetail {
  const m = toMarket(cs);
  if (!m.id) return detail;
  const has = detail.markets.some((x) => x.id === m.id);
  const markets = has ? detail.markets.map((x) => (x.id === m.id ? m : x)) : [...detail.markets, m];
  return { ...detail, markets };
}

/**
 * Aplica um delta de EVENTO (placar/relógio). A rogue manda updates de
 * `Type:"event"` com o LiveGameState/Score no Changeset.
 */
export function applyEventDelta(detail: LiveGameDetail, op: AnyRec): LiveGameDetail {
  const cs = op.Changeset as AnyRec | undefined;
  if (!cs) return detail;
  const ev = (cs.event as AnyRec) ?? cs;
  if (!ev.Score && !ev.LiveGameState) return detail;
  return { ...detail, info: { ...detail.info, ...gameStateToInfo(ev) } };
}
