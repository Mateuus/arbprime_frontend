export interface Event {
  id: string | number;
  matchId?: string;
  homeTeam: string;
  awayTeam: string;
  home?: string; // Nome do time da casa
  away?: string; // Nome do time visitante
  league?: string;
  leagueName?: string;
  country?: string;
  startTime?: string;
  date?: string;
  dateUTC?: string;
  dateGMT3?: string;
  status?: string;
  sport?: string;
  bookmaker?: string;
  type?: 'prematch' | 'live';
  disabled?: boolean;
  inverted?: boolean;
  link?: string;
  create_at?: string;
  update_at?: string;
  bookmakers?: string[];
}

export interface MarketOdd {
  id?: string;
  name: string;
  price: number | string;
  team?: string;
  handicap?: number | string;
  size?: number;
  inverted?: boolean;
}

export interface MarketFormat {
  id: string;
  subId: number;
  name: string;
  nameEn: string;
  odds: MarketOdd[];
}

export interface Market {
  key: string;
  data: {
    [key: string]: unknown;
  };
  // Mercados específicos baseados na estrutura real
  resultadoFinal?: MarketFormat;
  resultadoFinalLay?: MarketFormat;
  resultadoFinal1Half?: MarketFormat;
  resultadoFinal2Half?: MarketFormat;
  golsMaisMenos?: MarketFormat;
  golsMaisMenos1Half?: MarketFormat;
  golsMaisMenos2Half?: MarketFormat;
  ambosSimNao?: MarketFormat;
  cartoesAcimaBaixo?: MarketFormat;
  cartoesYellowMatchResult?: MarketFormat;
  cartoesMatchResult?: MarketFormat;
  cartoesYellowAcimaBaixo?: MarketFormat;
  cartoesYellowHomeAcimaBaixo?: MarketFormat;
  cartoesYellowAwayAcimaBaixo?: MarketFormat;
  cartoesHandicapYellow?: MarketFormat;
  escanteiosMaisMenos?: MarketFormat;
  escanteiosMaisMenos1Half?: MarketFormat;
  escanteiosMaisMenos2Half?: MarketFormat;
  homeEscanteiosMaisMenos?: MarketFormat;
  homeEscanteiosMaisMenos1Half?: MarketFormat;
  awayEscanteiosMaisMenos?: MarketFormat;
  awayEscanteiosMaisMenos1Half?: MarketFormat;
  chanceDupla?: MarketFormat;
  chanceDupla1Half?: MarketFormat;
  chanceDupla2Half?: MarketFormat;
  handicapDeLinha?: MarketFormat;
  empateAnula?: MarketFormat;
  handicapEuropeu?: MarketFormat;
  handicapAsiatico?: MarketFormat;
  handicapDeGolsLinha?: MarketFormat;
  classificar?: MarketFormat;
  shotsOnGoalWinner?: MarketFormat;
  shotsOnGoalOverUnder?: MarketFormat;
  shotsOnGoalHandicap?: MarketFormat;
  shotsOverUnder?: MarketFormat;
  homeShotsOverUnder?: MarketFormat;
  awayShotsOverUnder?: MarketFormat;
  homeShotsOnGoalOverUnder?: MarketFormat;
  awayShotsOnGoalOverUnder?: MarketFormat;
  OffsidesMatchResult?: MarketFormat;
  OffsidesOverUnder?: MarketFormat;
  homeOffsidesOverUnder?: MarketFormat;
  awayOffsidesOverUnder?: MarketFormat;
}

export interface EventDetails {
  event: Event | null;
  markets: Market[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface EventsResponse {
  events: Event[];
  pagination: Pagination;
}

export interface BookmakerMarkets {
  bookmaker: string;
  eventId: string;
  markets: Record<string, unknown>;
}
