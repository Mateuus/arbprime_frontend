// Contrato dos MIDDLES (apostas de intervalo) — espelha o emissor do
// arbbetting_master (process-middle.static.wk.ts) e as interfaces do backend
// (data.interface.ts). Fonte: WS método `middles` (Redis HASH
// `ArbBetting:MiddleListPrematch`). Produto IRMÃO das surebets: aposta-se Over
// numa linha MENOR + Under numa linha MAIOR, deixando uma FOLGA (gap). Se o
// resultado cai no miolo, AS DUAS pernas ganham; fora, ganha uma e perde a
// outra (perda limitada). NÃO é garantido — é +EV (ou "free middle", EV≈0) de
// alta variância. Todos os números já vêm PRONTOS do robô.

export type MiddleLineType = 'whole' | 'half' | 'quarter' | 'other' | 'mixed';

export interface MiddleLeg {
  side: 'over' | 'under' | 'home' | 'away'; // over/under (totals) ou home/away (handicap)
  option: string;           // seleção canônica ("Mais de 1", "H1(-0.5)")
  line: number;             // linha da perna (gols: 1, 2.5; handicap: -0.5, 1.5 — com sinal)
  price: number;            // odd da perna
  stakePct: number;         // % da banca sugerida nessa perna
  bookmaker: string;        // casa onde apostar
  eventId: string;          // id do evento na casa
  link?: string;            // deep link p/ apostar
  market: string;           // mercado canônico `{id}:{subId}`
  rawMarket?: string;       // nome do mercado como a casa mostra
  rawSelection?: string;    // nome da seleção como a casa mostra (pode faltar)
  size?: number;            // limite/stake máximo informado pela casa
}

export interface Middle {
  id: string;               // hash estável do middle (key/dedupe)
  kind?: 'totals' | 'handicap'; // totals = Over/Under de gols; handicap = asiático time-a-time
  market: string;           // mercado canônico `{id}:{subId}`
  lambda: number;           // gols esperados (Poisson) inferido do mercado
  lineType: MiddleLineType; // paridade das linhas
  gap: number[];            // placares (nº de gols) que ganham AS DUAS pernas (o miolo)
  gapFull: boolean;         // true = miolo CHEIO; false = soft/asiático (meia-vitória)
  ev: number;               // valor esperado em % da banca (pode ser ~0 = free middle)
  pGap: number;             // % de chance de acertar o miolo
  pProfit: number;          // % de chance de resultado líquido positivo
  profitIfHit: number;      // % da banca se o middle bate (melhor caso)
  lossIfMiss: number;       // % da banca se erra (pior caso, geralmente negativo)
  coefficient: number;      // Σ(1/odd) das duas pernas
  legs: MiddleLeg[];
  lambdaHome?: number;      // só em middles de handicap (compat futura)
  lambdaAway?: number;
  supremacy?: number;
}

export interface MiddleData {
  id: string;               // groupId
  sport: string;
  league: string;
  country?: string | null;
  home: string;
  away: string;
  date: string;             // início do jogo (GMT-3, já pré-jogo)
  middles: Middle[];
  bestEv?: number;          // maior EV do grupo
  update_at: string;
  create_at: string;
}
