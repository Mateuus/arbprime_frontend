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
    bookmaker: string;
    eventId: string;
    historyPrice: { timestamp: number; price: number }[];
    otherOdds: { eventId: string; bookmaker: string; price: number }[];
}

export interface Surebet {
    coefficient: number;
    profitMargin: number;
    marketTypes: string[];
    surebet: SurebetOdd[];
}

export interface SurebetData {
    id: string;
    sport: string;
    league: string;
    home: string;
    away: string;
    date: string;
    surebets: Surebet[];
    update_at: string;
    create_at: string;
}
