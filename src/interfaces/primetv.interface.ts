// PrimeTV — tipos espelhados do backend (schema interno, agnóstico de fornecedor).
// O cliente enxerga só o NOSSO id do evento (nunca o id do fornecedor).

export type PrimeTvStatus = 'live' | 'upcoming' | 'finished';

export interface PrimeTvTeam {
  name: string;
  iconId: string | null;
  iconUrl: string | null;
}

export interface PrimeTvEvent {
  id: string; // nosso id (estável) — usado em /tv/{id}
  sport: string;
  isVersus: boolean;
  title: string;
  home: PrimeTvTeam;
  away: PrimeTvTeam;
  competition: string;
  competitionKey: string;
  country: string | null;
  countryCode: string | null;
  startTime: string; // ISO (wallclock GMT-3 tagueado Z — ver utils/eventTime)
  status: PrimeTvStatus;
  isLive: boolean;
  hasAudio: boolean;
  channels: number;
  externalRefs: Record<string, string>;
}

export interface PrimeTvOverride {
  eventId: string;
  hidden: boolean;
  removed: boolean;
  note: string | null;
  by: string | null;
  at: string;
}

// Evento no payload admin (público + estado do override).
export type PrimeTvAdminEvent = PrimeTvEvent & { override: PrimeTvOverride | null };

export interface PrimeTvCompetition {
  key: string;
  name: string;
  country: string | null;
  countryCode: string | null;
  count: number;
  liveCount: number;
}

export interface PrimeTvListResult<E = PrimeTvEvent> {
  events: E[];
  competitions: PrimeTvCompetition[];
  total: number;
  liveTotal: number;
}

export interface PrimeTvConnection {
  type: 'primetv';
  server: string; // nosso WSS (ex.: wss://wss.arbprime.pro)
  eventId: string;
}

export interface PrimeTvStreamResult {
  event: PrimeTvEvent;
  connection: PrimeTvConnection;
}
