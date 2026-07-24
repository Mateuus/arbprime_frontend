// Contrato das ODDS AO VIVO de uma casa (hoje bet365) — espelha o backend
// (data.interface.ts: LiveOddsData) e o coletor WS do arbbetting_master
// (bet365.live.collector). NÃO é surebet: é a cotação crua da própria casa no
// in-play, servida por esporte, para a página estilo-casa. Fonte: WS método
// `live_odds` (Redis `ArbBetting:Live:{Esporte}:{casa}` + `...:Markets:Live:...`).

export interface LiveOddSelection {
  name: string;                 // "home" | "draw" | "away" | "over" | "under" | "1X" | ...
  price: number | string;      // odd decimal
  handicap?: number | string;
  team?: string;
  /** dado apostável (NoDelay): { selectionId, mt, odd } quando a casa expõe. */
  placeable?: unknown;
}

export interface LiveOddMarket {
  id: string;                   // "match-winner"
  subId: number;                // 1
  name: string;                 // "Resultado Final"
  nameEn?: string;
  odds: LiveOddSelection[];
}

export interface LiveOddEvent {
  id: string;                   // fi (id do jogo na casa)
  sport: string;
  bookmaker: string;
  league: string;
  home: string;
  away: string;
  score?: string;               // placar ao vivo, quando a casa manda ("1-3")
  clock?: string;               // relógio de jogo ("43:12")
  link?: string;
  markets: LiveOddMarket[];
  update_at: string;
}

/** Uma aba de esporte com a contagem de jogos ao vivo — para o menu por categoria. */
export interface LiveSportTab {
  sport: string;                // "Futebol"
  events: number;               // nº de jogos ao vivo
}

export interface LiveOddsData {
  sport: string;                // esporte selecionado (o que `events` contém)
  bookmaker: string;            // hoje só "bet365"
  sports: LiveSportTab[];       // abas disponíveis (esportes com jogo ao vivo agora)
  events: LiveOddEvent[];       // jogos do esporte selecionado, com mercados embutidos
}
