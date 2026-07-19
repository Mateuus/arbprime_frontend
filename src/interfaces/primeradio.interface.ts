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

/** Emissora que narra o jogo — na lista pública vem SEM a URL. */
export interface PrimeRadioStation {
  id: string;
  name: string;
  city: string | null;
  logoUrl: string | null;
}

/** Emissora COM a URL — só chega em /primeradio/listen/:id (autenticada). */
export interface PrimeRadioStationListen extends PrimeRadioStation {
  streamUrl: string;
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
  station: string | null; // nome da rádio/narrador (legado)
  /** Emissoras disponíveis (sem URL). O ouvinte escolhe qual tocar. */
  stations: PrimeRadioStation[];
}

/** Item do painel admin: o público + gestão. */
export interface PrimeRadioAdminEvent extends PrimeRadioEvent {
  /** No painel a URL aparece (é onde o admin cadastra). */
  adminStations: PrimeRadioStationListen[];
  streamUrl: string | null;
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
  /** 1ª emissora — atalho p/ tocar direto. */
  streamUrl: string | null;
  stations: PrimeRadioStationListen[];
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
  /** Quando enviado, SUBSTITUI a lista inteira de emissoras. */
  stations?: UpsertPrimeRadioStationDTO[];
}

export interface UpsertPrimeRadioStationDTO {
  name: string;
  streamUrl: string;
  city?: string | null;
  logoUrl?: string | null;
}
