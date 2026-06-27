export interface Arbitragem {
    id?: string;
    profit: number;
    sport: string;
    timer: string;
    bets: {
      bookmaker: string;
      match: string;
      league: string;
      market: string;
      odd: number;
      direction?: 'up' | 'down' | string;
    }[];
}

export interface SurebetOdd {
    option: string;
    price: number;
    size?: number;
    bookmaker: string;
    eventId: string;
    market: string;
    rawMarket?: string;   // nome do mercado COMO A CASA mostra no site (ajuda a achar lá); pode faltar
    rawSelection?: string; // nome da seleção/option como a casa mostra (opcional)
    handicap?: number | string | null; // linha de gols dos mercados combinados (ex.: btts-and-total-goals)
    pa?: boolean; // Duplo Green: perna casa/fora com Pagamento Antecipado (early payout)
    link?: string;
    historyPrice: { timestamp: number; price: number }[];
    otherOdds: { eventId: string; bookmaker: string; price: number, size?: number }[];
}

export interface Surebet {
    coefficient: number;
    profitMargin: number;
    marketTypes: string[];
    surebet: SurebetOdd[];
    update_at: string;
    create_at: string;
}

export interface SurebetData {
    id: string;
    sport: string;
    league: string;
    home: string;
    away: string;
    date: string;
    surebets: Surebet[];
    bestProfit?: number;
    update_at: string;
    create_at: string;
}
