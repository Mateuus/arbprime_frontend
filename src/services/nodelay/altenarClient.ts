/**
 * Cliente REST do Altenar (biahosted) — as odds ao vivo das casas biahosted
 * (ex.: estrelabet), lidas DIRETO do browser.
 *
 * Igual à rogue (fssb) o browser lê direto: o Altenar responde CORS `*` e NÃO
 * exige token para LER odds (só para apostar). A diferença é o TRANSPORTE: a rogue
 * empurra por SSE; aqui, na 1ª fase, fazemos POLLING REST (snapshots). O objetivo
 * é migrar para o WebSocket (graphql-ws) depois — o `altenarModel` fica igual,
 * troca-se só quem chama o parse.
 *
 * Endpoints (GET, host = oddsUrl da casa; params comuns abaixo):
 *   /api/widget/GetLiveOverview            → lista LIVE (placar/relógio/stats)
 *   /api/widget/GetEventDetails?eventId=…  → 1 evento (markets + odds)
 */

export interface AltenarHost {
  /** Host de odds Altenar (ex.: 'https://sb2frontend-altenar2.biahosted.com'). */
  oddsUrl: string;
  /** Nome da integração da casa (ex.: 'estrelabet'). */
  integration: string;
}

type AnyRec = Record<string, unknown>;

const COMMON: Record<string, string | number> = {
  culture: 'pt-BR',
  timezoneOffset: 180,
  deviceType: 1,
  numFormat: 'en-GB',
  countryCode: 'BR',
};

const trim = (u: string): string => (u || '').trim().replace(/\/+$/, '');

function qs(host: AltenarHost, extra: Record<string, string | number> = {}): string {
  const all = { ...COMMON, integration: host.integration, ...extra };
  return Object.entries(all)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function getJson(url: string, signal?: AbortSignal): Promise<AnyRec> {
  // no-store: cada poll pega o dado VIVO (o max-age=3 é só dica de cache do browser;
  // a origem serve fresh a cada request — cf-cache-status DYNAMIC).
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Altenar HTTP ${res.status}`);
  return (await res.json()) as AnyRec;
}

/** Lista de eventos AO VIVO (com placar/relógio). Filtra por esporte se dado. */
export function fetchLiveOverview(host: AltenarHost, sportId?: number, signal?: AbortSignal): Promise<AnyRec> {
  const extra: Record<string, string | number> = sportId ? { sportId } : {};
  return getJson(`${trim(host.oddsUrl)}/api/widget/GetLiveOverview?${qs(host, extra)}`, signal);
}

/** Um evento com todos os mercados/odds. `showNonBoosts=false` = igual ao site. */
export function fetchEventDetails(host: AltenarHost, eventId: string | number, signal?: AbortSignal): Promise<AnyRec> {
  return getJson(`${trim(host.oddsUrl)}/api/widget/GetEventDetails?${qs(host, { eventId, showNonBoosts: 'false' })}`, signal);
}

/**
 * Placar/relógio de UM evento — endpoint OFICIAL do scoreboard que o site polla
 * (`/api/Scoreboard/GetScoreboardInfo`, sem auth, CORS `*`). Devolve
 * `{events:[{score,liveTime,ls,…}], timer, statistics, timelines}` — o `score` sai
 * via `scoreFromOverview`. (As `statistics` ficam pra quando o mapa de `type`
 * Betradar estiver travado.)
 */
export function fetchScoreboard(host: AltenarHost, eventId: string | number, signal?: AbortSignal): Promise<AnyRec> {
  return getJson(`${trim(host.oddsUrl)}/api/Scoreboard/GetScoreboardInfo?${qs(host, { eventId })}`, signal);
}
