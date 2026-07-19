// PrimeRádio — tipos espelhados do backend.
// Transmissões de ÁUDIO (narração) dos jogos, cadastradas à mão pelo admin (nós
// somos o fornecedor). Feature paralela ao PrimeTV: não passa por WebRTC/SFU —
// o player é um <audio> apontando pro link do stream.
//
// A `streamUrl` NÃO vem na lista pública: ela só chega em /primeradio/listen/:id
// (rota autenticada), mesmo espírito do msToken do PrimeTV.

export type PrimeRadioStatus = 'live' | 'upcoming' | 'finished';

export interface PrimeRadioTeam {
  name: string;
  sofaId: string | null;
  iconUrl: string | null;
}

export interface PrimeRadioEvent {
  id: string;
  isVersus: boolean;
  title: string;
  home: PrimeRadioTeam;
  away: PrimeRadioTeam;
  competition: string;
  competitionKey: string;
  country: string | null;
  countryCode: string | null;
  sport: string;
  startTime: string; // ISO (wallclock GMT-3 tagueado Z — ver utils/eventTime)
  endTime: string;
  status: PrimeRadioStatus;
  isLive: boolean;
  station: string | null; // nome da rádio/narrador
}

/** Item do painel admin: o público + gestão. */
export interface PrimeRadioAdminEvent extends PrimeRadioEvent {
  streamUrl: string;
  isActive: boolean;
  endedAt: string | null;
  createdAt: string;
}

export interface PrimeRadioCompetition {
  key: string;
  label: string;
  count: number;
}

export interface PrimeRadioListResult {
  events: PrimeRadioEvent[];
  competitions: PrimeRadioCompetition[];
  total: number;
  liveCount: number;
}

/** Resposta do "ouvir" — só aqui a URL do stream aparece. */
export interface PrimeRadioListenResult {
  event: PrimeRadioEvent;
  streamUrl: string;
}

/** Corpo de criação/edição no painel admin. */
export interface UpsertPrimeRadioDTO {
  homeName?: string | null;
  awayName?: string | null;
  homeSofaId?: string | null;
  awaySofaId?: string | null;
  title?: string | null;
  competition?: string | null;
  country?: string | null;
  countryCode?: string | null;
  sport?: string;
  startTime?: string;
  endTime?: string;
  streamUrl?: string;
  station?: string | null;
  isActive?: boolean;
}
