// Contrato dos value bets (apostas de valor) — espelha o doc 10 do
// arbbetting_master e as interfaces do backend (data.interface.ts).
// Fonte: WS método `valuebet` (Redis HASH `ArbBetting:ValuebetListPrematch`).
// Aposta ÚNICA, em UMA casa (betano/bet365/superbet); lucro ESPERADO, não garantido.

export interface ValuebetEmission {
  id: string;             // hash estável (jogo+mercado+seleção+casa+eventId) — key/dedupe
  market: string;         // mercado canônico {id}:{subId}
  rawMarket?: string;     // nome do mercado p/ exibir (fallback: catálogo)
  selection: string;      // seleção apostada (home/draw/away, "Mais de 9.5", ...)
  selKey?: string;        // chave interna (home / over:2.5)
  rawSelection?: string;  // nome da seleção como a casa mostra
  bookmaker: string;      // casa ONDE apostar
  eventId: string;        // id do evento na casa
  selectionId?: string;   // ID da seleção NA CASA (betano selection.id) — o que o betslip/aposta precisa; só casas instrumentadas (hoje betano)
  refEventId?: string;    // INTERNO (âncora do CLV) — NÃO exibir
  handicap?: string;      // linha (over/under); "" quando não se aplica
  link?: string;          // deep link p/ apostar
  odd: number;            // odd OFERECIDA pela casa
  pFair: number;          // probabilidade justa estimada (0..1)
  fairOdd: number;        // odd justa = 1/pFair
  edge: number;           // valor (EV por unidade) em fração
  edgePct: number;        // valor em % (badge principal)
  confidence: number;     // confiança da estimativa (0..1)
  tier: number;           // 1=Pinnacle núcleo, 2=Pinnacle secundário, 3=consenso
  ref: string;            // "pinnacle" | "consensus"
  houseVig?: number | null; // JUICE/margem da casa onde se aposta (fração; null=não medível) — doc 11
  refVig?: number;        // margem da referência (Pinnacle/consenso)
  devig?: string;         // método de de-vig
  stakeFraction?: number; // stake sugerido (fração da banca, Kelly ¼)
  update_at: string;
  create_at: string;
}

export interface ValuebetGroup {
  id: string;             // groupId
  sport: string;
  league: string;
  home: string;
  away: string;
  date: string;           // início do jogo (GMT-3, já pré-jogo)
  valuebets: ValuebetEmission[];
  bestEdge?: number;      // maior edgePct do grupo
  update_at: string;
  create_at: string;
}
