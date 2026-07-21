/**
 * Cliente REST do AO VIVO da Superbet (Betler) — as odds ao vivo, lidas DIRETO do
 * browser. O host de OFERTA é um CDN Fastly PÚBLICO (sem login, sem WAF — o WAF é
 * só do host de LOGIN/betler) e responde CORS `*`, então funciona igual ao Altenar:
 * POLLING REST (snapshots). O SSE da Superbet só sinaliza mudança; o polling basta.
 *
 * Endpoints (GET, base = OFFER/v2/pt-BR):
 *   /events/by-date?currentStatus=active&offerState=live&startDate=…  → lista LIVE
 *   /events/<eventId>                                                  → 1 evento (odds)
 *   /sport/<sportId>/phase/inplay/market-groups                        → abas (grupos)
 *   /struct                                                            → dicionário (sports/categories/tournaments)
 *
 * Cada odd já é AUTO-CONTIDO (marketName + `info` = label humano + price + status),
 * então o `struct`/`market-groups` servem só p/ nomes de esporte/país/liga e abas.
 */

const OFFER = 'https://production-superbet-offer-br.freetls.fastly.net/v2/pt-BR';

type AnyRec = Record<string, unknown>;

async function getJson(url: string, signal?: AbortSignal): Promise<AnyRec> {
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Superbet HTTP ${res.status}`);
  return (await res.json()) as AnyRec;
}

/** startDate = agora − 24h (lower bound); o filtro live/active já limita ao ao vivo. */
function liveStartDate(): string {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  // formato aceito: "YYYY-MM-DD HH:MM:SS" (o backend trata o espaço como separador).
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** Lista de eventos AO VIVO (todos os esportes). `data[]` = eventos com placar. */
export function fetchSuperbetLive(signal?: AbortSignal): Promise<AnyRec> {
  const q = `currentStatus=active&offerState=live&startDate=${encodeURIComponent(liveStartDate())}`;
  return getJson(`${OFFER}/events/by-date?${q}`, signal);
}

/** Um evento com todas as odds (`data[0].odds[]`). odds=null/marketCount=0 = mercado fechado. */
export function fetchSuperbetEvent(eventId: string | number, signal?: AbortSignal): Promise<AnyRec> {
  return getJson(`${OFFER}/events/${eventId}`, signal);
}

/* ─── Dicionários (cacheados: mudam pouco) ─────────────────────────────────── */

export interface SuperbetStruct {
  /** id → nome (pt-BR). */
  sports: Map<string, string>;
  categories: Map<string, string>; // país/região
  tournaments: Map<string, string>; // liga/campeonato
  /** id → order do esporte (p/ ordenar as abas de esporte). */
  sportOrder: Map<string, number>;
}

const nameMap = (arr: unknown): Map<string, string> => {
  const m = new Map<string, string>();
  for (const x of (arr as AnyRec[]) || []) {
    const ln = (x.localNames as AnyRec) || {};
    m.set(String(x.id), String(ln['pt-BR'] ?? ln['en'] ?? x.id));
  }
  return m;
};

let structCache: { at: number; data: SuperbetStruct } | null = null;
const STRUCT_TTL = 5 * 60 * 1000;

/** Dicionário de nomes (esporte/país/liga). Cacheado por 5min (é grande e estável). */
export async function fetchSuperbetStruct(signal?: AbortSignal): Promise<SuperbetStruct> {
  if (structCache && Date.now() - structCache.at < STRUCT_TTL) return structCache.data;
  const raw = await getJson(`${OFFER}/struct`, signal);
  const d = (raw.data as AnyRec) || raw;
  const sportOrder = new Map<string, number>();
  for (const s of (d.sports as AnyRec[]) || []) sportOrder.set(String(s.id), Number(s.order ?? 9999));
  const data: SuperbetStruct = {
    sports: nameMap(d.sports),
    categories: nameMap(d.categories),
    tournaments: nameMap(d.tournaments),
    sportOrder,
  };
  structCache = { at: Date.now(), data };
  return data;
}

/** marketId → refs de grupo/aba (nome + ordem). Vazio se o grupo não cobre o market. */
export type GroupsByMarket = Map<string, { id: string; name: string; order: number; sortingKey: number }[]>;

const groupsCache = new Map<string, { at: number; data: GroupsByMarket; tabs: { id: string; name: string; order: number }[] }>();
const GROUPS_TTL = 30 * 60 * 1000;

/** Abas (market-groups) de um esporte: índice marketId→grupos + lista de abas. */
export async function fetchSuperbetGroups(
  sportId: string | number,
  signal?: AbortSignal,
): Promise<{ byMarket: GroupsByMarket; tabs: { id: string; name: string; order: number }[] }> {
  const key = String(sportId);
  const hit = groupsCache.get(key);
  if (hit && Date.now() - hit.at < GROUPS_TTL) return { byMarket: hit.data, tabs: hit.tabs };
  const raw = await getJson(`${OFFER}/sport/${key}/phase/inplay/market-groups`, signal);
  const arr = (raw.data as AnyRec[]) || [];
  const byMarket: GroupsByMarket = new Map();
  const tabs: { id: string; name: string; order: number }[] = [];
  arr
    .slice()
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
    .forEach((g) => {
      const ln = (g.localNames as AnyRec) || {};
      const gid = String(g.id);
      const gname = String(ln['pt-BR'] ?? ln['en'] ?? g.id);
      const gorder = Number(g.order ?? 9999);
      tabs.push({ id: gid, name: gname, order: gorder });
      ((g.markets as unknown[]) || []).forEach((mid, order) => {
        const k = String(mid);
        const ref = { id: gid, name: gname, order, sortingKey: gorder };
        const list = byMarket.get(k) ?? [];
        list.push(ref);
        byMarket.set(k, list);
      });
    });
  groupsCache.set(key, { at: Date.now(), data: byMarket, tabs });
  return { byMarket, tabs };
}
