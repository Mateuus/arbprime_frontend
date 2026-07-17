// Helpers de exibição das odds ao vivo do NoDelay (fonte rogue).
import { LiveGame, LiveMarket, LiveGameDetail, LiveSelection } from '@/services/nodelay/rogueModel';

/** Placar a partir do info (score1/score2 já normalizados no rogueModel). */
export function scoreOf(g: { info?: { score1?: string; score2?: string } }): { home: string; away: string } | null {
  const s1 = g.info?.score1;
  const s2 = g.info?.score2;
  if (s1 == null || s2 == null) return null;
  return { home: String(s1), away: String(s2) };
}

/** Minuto do jogo (rogue manda current_game_time = minuto limpo). */
export function clockOf(g: { info?: { current_game_time?: string; current_game_state?: string } }): string {
  const t = g.info?.current_game_time;
  if (t != null && String(t).trim() !== '' && String(t) !== '0') return `${t}'`;
  const st = g.info?.current_game_state;
  return st ? st : '';
}

/**
 * Abas por categoria = as MarketGroups nativas do site (Todos, Principais, Gols,
 * Escanteios, Cartões, Handicap Asiático, Especiais…), na ordem que a casa manda.
 * Cada aba lista os mercados que a declaram em `market.groups`, ordenados pela
 * ordem DENTRO daquela aba (o mesmo critério do site).
 */
export interface CategoryTab {
  id: string;
  name: string;
  markets: LiveMarket[];
}

/**
 * Uma seleção é do lado "Menos"/Under? Usa o OutcomeType da rogua (robusto,
 * independe de idioma) e cai no nome como reforço.
 */
export function isUnder(sel: LiveSelection): boolean {
  if (sel.outcomeType) return /under/i.test(sel.outcomeType);
  return /(^|\s)(menos|abaixo|under)\b/i.test(sel.name);
}

export interface MarketFilterOpts {
  delayTradeOnly?: boolean; // esconde as seleções "Menos de"
  hidePriceless?: boolean;  // esconde seleções sem odd ("—")
}

/**
 * Aplica os filtros de Delay Trade aos mercados.
 *
 * REGRA-CHAVE do trade: mercado SUSPENSO (`m.suspended`, IsSuspended) = a casa
 * travou por um lance perigoso. Isso é SINAL, não ruído — fica SEMPRE visível
 * (com cadeado), mesmo com "ocultar sem odd" ligado. O que some é o sem-odd
 * "por natureza": mercado/linha que a casa não oferece (— e NÃO suspenso).
 *
 * Como as odds chegam pelo SSE, quando um preço aparece o item volta sozinho.
 */
export function filterMarkets(markets: LiveMarket[], opts: MarketFilterOpts): LiveMarket[] {
  if (!opts.delayTradeOnly && !opts.hidePriceless) return markets;
  const out: LiveMarket[] = [];
  for (const m of markets) {
    let sels = m.selections;
    if (opts.delayTradeOnly) sels = sels.filter((s) => !isUnder(s));
    // Só corta os sem-odd quando o mercado NÃO está suspenso (senão perderíamos
    // o cadeado, que é o sinal do lance perigoso).
    if (opts.hidePriceless && !m.suspended) sels = sels.filter((s) => s.price > 0);
    if (sels.length === 0) continue; // mercado sem seleção visível → some
    out.push(sels === m.selections ? m : { ...m, selections: sels });
  }
  return out;
}

export function categorize(groups: LiveGameDetail['groups'], markets: LiveMarket[]): CategoryTab[] {
  const tabs: CategoryTab[] = groups.map((g) => ({ id: g.id, name: g.name, markets: [] }));
  const byId = new Map(tabs.map((t) => [t.id, t]));

  // Fallback: se o evento não declarou abas, cria "Todos" com tudo.
  if (tabs.length === 0) {
    return [{ id: 'Todos', name: 'Todos', markets: [...markets].sort((a, b) => a.order - b.order) }];
  }

  // Cada market entra em cada aba que ele declara, com a ordem daquela aba.
  const orderInTab = new Map<string, Map<string, number>>(); // tabId -> marketId -> order
  for (const m of markets) {
    for (const gref of m.groups) {
      const tab = byId.get(gref.id);
      if (!tab) continue;
      tab.markets.push(m);
      const om = orderInTab.get(gref.id) ?? new Map();
      om.set(m.id, gref.order);
      orderInTab.set(gref.id, om);
    }
  }

  for (const tab of tabs) {
    const om = orderInTab.get(tab.id);
    tab.markets.sort((a, b) => (om?.get(a.id) ?? a.order) - (om?.get(b.id) ?? b.order));
  }

  // Some abas vazias (ex.: Escalações quando não há mercado).
  return tabs.filter((t) => t.markets.length > 0);
}

/**
 * Rótulo do mercado. A rogue já manda o nome pronto e traduzido; a linha
 * (over/under, handicap) fica na própria seleção (BetslipLine), então o nome do
 * mercado não precisa de sufixo.
 */
export function marketTitle(m: LiveMarket): string {
  return m.name;
}

/** Rótulo da seleção — usa o Name; a linha (0.5, +1) fica ao lado quando útil. */
export function selectionLabel(name: string, points: number | null): string {
  if (points == null || points === 0) return name;
  // "Mais de" / "Menos de" ganham a linha; nome de time não.
  if (/mais|menos|acima|abaixo|over|under/i.test(name)) {
    const p = points > 0 ? points : Math.abs(points);
    return `${name} ${p}`;
  }
  return name;
}

/** Agrupa os jogos por esporte (a lista pode vir de vários esportes). */
export interface SportBucket { id: string; name: string; games: LiveGame[] }

export function groupBySport(games: LiveGame[]): SportBucket[] {
  const by = new Map<string, SportBucket>();
  for (const g of games) {
    const key = g.sportName || g.sportId || '—';
    const b = by.get(key);
    if (b) b.games.push(g);
    else by.set(key, { id: g.sportId || key, name: g.sportName || 'Esporte', games: [g] });
  }
  return [...by.values()]
    .map((b) => ({ ...b, games: b.games.sort((x, y) => x.competitionName.localeCompare(y.competitionName) || x.home.localeCompare(y.home)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const fmtOdd = (p: number): string => (p <= 0 ? '—' : p >= 100 ? String(Math.round(p)) : p.toFixed(2));

/** Max stake compacto p/ a célula da odd: 340 · 4.442 · 12,9k · 1,2M. Sempre floor
 * (nunca arredonda pra cima — superestimaria o teto). */
export const fmtMaxStake = (v: number): string => {
  if (v >= 1_000_000) return `${(Math.floor(v / 100_000) / 10).toFixed(1).replace('.0', '').replace('.', ',')}M`;
  if (v >= 10_000) return `${(Math.floor(v / 100) / 10).toFixed(1).replace('.0', '').replace('.', ',')}k`;
  return Math.floor(v).toLocaleString('pt-BR');
};
