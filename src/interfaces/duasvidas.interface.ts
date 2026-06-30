import { SurebetData, SurebetOdd, Surebet } from './arbitragem.interface';

/**
 * Duas Vidas (DV) — surebet condicional. Reusa o shape de SurebetData (chega pelo mesmo
 * WS `arbitrage_betting`, type=`duasvidas`), com campos extras de honestidade no surebet
 * e uma perna PARLAY (a zebra turbinada por um favorito-PA de OUTRO jogo, na MESMA casa).
 */

/** O favorito do 2º jogo que turbina a zebra. */
export interface DuasVidasBooster {
  groupId: string;
  eventId: string;
  bookmaker: string;        // mesma casa da zebra (a múltipla é um bilhete só)
  side: 'home' | 'away';
  price: number;            // odd do favorito-2
  pFair: number;            // pg — prob justa (Pinnacle/consenso)
  fairOdd: number;          // 1/pg
  edge: number;             // % valor próprio do favorito-2 (booster·pg − 1)
  home: string;
  away: string;
  league: string | null;
  date: string;             // kickoff do 2º jogo (pode ser antes do principal)
  link: string;
  market: string;
  rawMarket: string;
  rawSelection: string;
  // Presentes só nas ALTERNATIVAS (boosterOptions):
  parlayOdd?: number;       // zebra × este booster
  zebraPrice?: number;
  apparentMargin?: number;
  trueEV?: number;
  pLoss?: number;
  parlayFairOdd?: number | null;
  parlayEdge?: number | null;
}

export interface DuasVidasLeg extends SurebetOdd {
  isParlay?: boolean;        // true na perna da múltipla (a zebra turbinada)
  zebraPrice?: number;       // odd só da zebra (1ª seleção da múltipla)
  booster?: DuasVidasBooster; // 2ª seleção da múltipla (presente só na perna parlay)
}

export interface DuasVidas extends Omit<Surebet, 'surebet'> {
  id: string;
  apparentMargin: number;        // = profitMargin (gancho)
  trueEV: number;                // EV honesto = M − p_loss(1+M)
  pLoss: number;                 // % (zebra vence, favorito-2 falha)
  parlayOdd: number;             // b = zebra × booster
  parlayFairOdd: number | null;  // 1/(p2·pg)
  parlayEdge: number | null;     // % valor do parlay
  p2: number;                    // prob justa da zebra
  pg: number;                    // prob justa do favorito-2
  zebraSide: 'home' | 'away';
  boosterHouse: string;
  surebet: DuasVidasLeg[];       // [home, draw, away] — uma delas é a parlay
  boosterOptions: DuasVidasBooster[]; // outros 2º jogos (picker / fallback)
}

export interface DuasVidasData extends Omit<SurebetData, 'surebets'> {
  surebets: DuasVidas[];
}
