// Contrato da MÚLTIPLA (arbitragem de acumulada) — espelha o emissor do
// arbbetting_master (process-multipla.static.wk.ts) e as interfaces do backend
// (data.interface.ts). Fonte: WS método `multipla` (Redis HASH
// `ArbBetting:MultiArbitrageListPrematch`). Diferente das surebets, o "evento" é
// um PAR de jogos independentes: cada bilhete (ticket) é uma múltipla de 2 pernas
// (uma seleção de cada jogo) colocada numa ÚNICA casa; o conjunto dos bilhetes
// cobre todos os desfechos → arbitragem garantida. Todos os números já vêm
// PRONTOS do robô (o front só exibe e distribui stake por 1/combinedOdd).

export interface MultiLeg {
  groupId: string;          // grupo (jogo) canônico a que esta perna pertence
  eventId: string;          // id do evento na casa
  option: string;           // seleção canônica ("home", "Mais de 2.5")
  price: number;            // odd da perna na casa do bilhete
  link?: string;            // deep link p/ apostar
  market: string;           // mercado canônico `{id}:{subId}`
  rawMarket?: string;       // nome do mercado como a casa mostra (exibição)
  rawSelection?: string;    // nome da seleção como a casa mostra (pode faltar)
}

export interface MultiTicket {
  combo: string[];          // [seleção jogo A, seleção jogo B] (display)
  bookmaker: string;        // casa ÚNICA onde a acumulada é colocada
  combinedOdd: number;      // odd combinada (produto das 2 pernas)
  stakePct: number;         // % do stake total nesse bilhete (∝ 1/combinedOdd)
  legs: MultiLeg[];         // as 2 pernas (uma de cada jogo)
}

export interface MultiGame {
  groupId: string;          // grupo (jogo) canônico
  home: string;             // nome canônico do mandante
  away: string;             // nome canônico do visitante
  league: string;
  date: string;             // início do jogo (GMT-3 tagueado Z, como as surebets)
  cover: string;            // chave da cobertura usada neste jogo
}

export interface MultiArbData {
  id: string;               // `groupIdA|groupIdB`
  sport: string;
  covers: string[];         // [coverA, coverB]
  games: MultiGame[];       // os 2 jogos do par
  coefficient: number;      // Σ(1/combinedOdd) dos bilhetes (< 1 = arbitragem)
  profitMargin: number;     // lucro garantido em % (= (1/coefficient - 1)*100)
  tickets: MultiTicket[];   // bilhetes (acumuladas) que cobrem todos os desfechos
  update_at: string;
  create_at: string;
}
