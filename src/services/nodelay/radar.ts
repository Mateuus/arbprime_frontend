/**
 * Radar do jogo — resolve o uuid do widget e monta a URL do iframe.
 *
 * Cadeia (toda pública, sem auth), confirmada ao vivo:
 *   eventId FSB → GET <site>/api/sportsbook/match-tracker-map → uuid → iframe
 *
 * O mapa é grande (~300 KB, milhares de entradas) e muda devagar, então é
 * buscado UMA vez por sessão de página e cacheado em módulo. Buscar por jogo
 * seria 300 KB a cada evento aberto.
 */
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';

interface RadarMap { map?: Record<string, string> }

const cache = new Map<string, Promise<Record<string, string>>>();

/** Hosts do widget por esporte (constantes lidas do bundle da própria casa). */
const HOSTS: Record<string, string> = {
  default: 'https://widgets-v2.thesports01.com/br/pro/football/?',
  '2': 'https://widgets-v2.thesports01.com/br/pro/basketball?',
  '6': 'https://widgets.thesports01.com/br/3d/tennis?',
  '7': 'https://widgets.thesports01.com/br/baseball?',
};

const hostFor = (sportId: string): string => HOSTS[sportId] ?? HOSTS.default;

/** Base do site da casa (o mapa é servido pelo operador, não pelo swarm). */
function siteBase(house: NoDelayBookmaker): string | null {
  const raw = house.radarMapUrl || house.url;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

async function loadMap(house: NoDelayBookmaker): Promise<Record<string, string>> {
  const hit = cache.get(house.slug);
  if (hit) return hit;

  const base = siteBase(house);
  if (!base) return {};

  const p = (async () => {
    try {
      const r = await fetch(`${base}/api/sportsbook/match-tracker-map`, { cache: 'no-store' });
      if (!r.ok) return {};
      const j = (await r.json()) as RadarMap;
      return j?.map ?? {};
    } catch {
      // Sem radar não é erro fatal: a página vive sem ele.
      return {};
    }
  })();

  cache.set(house.slug, p);
  return p;
}

/** uuid do widget para um evento da FSB (null = este jogo não tem radar). */
export async function resolveRadarUuid(house: NoDelayBookmaker, fsbEventId: string): Promise<string | null> {
  const map = await loadMap(house);
  return map[fsbEventId] ?? null;
}

/**
 * URL do iframe. `withProfile` liga a versão 3D (assinatura da casa); sem ele,
 * o widget cai na 2D, que funciona sem assinatura nenhuma.
 */
export function radarUrl(
  house: NoDelayBookmaker,
  sportId: string,
  uuid: string,
  opts?: { withProfile?: boolean },
): string {
  const qs = new URLSearchParams({ uuid, theme: 'dark' });
  const profile = house.radarProfiles?.[sportId] ?? house.radarProfiles?.default;
  if (opts?.withProfile !== false && profile) qs.set('profile', profile);
  return `${hostFor(sportId)}${qs.toString()}`;
}
