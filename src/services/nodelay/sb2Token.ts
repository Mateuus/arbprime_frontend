/**
 * SB2 token do Altenar (o que o `placeWidget` de fato exige, `iss:SB2`) — obtido
 * e CACHEADO NO BROWSER. Cadeia (validada ao vivo, tudo CORS-liberado p/ localhost):
 *   1) GET {bffUrl}/sports/openSportsBook?vendorId=altenar  (Identity:<JWT login>,
 *      Sessionid:<data.id>) → data.authToken (UUID one-time)
 *   2) POST {authUrl}/api/WidgetAuth/SignIn {integration, token:authToken,…}
 *      → accessToken (SB2, ~25min, IP-bound no IP do BROWSER).
 *
 * Cacheado por conta até ~exp: a cadeia roda 1x; o disparo é só o placeWidget. O
 * JWT+sessionId vêm do nosso backend (`/accounts/:id/bet-token`) — segredo no cofre.
 */
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';

interface CachedSb2 { token: string; expMs: number; }
const cache = new Map<string, CachedSb2>();
const inFlight = new Map<string, Promise<string>>();

const trim = (u: string): string => (u || '').trim().replace(/\/+$/, '');

/** Gateway de apostas (frontend→betgateway, ou o betUrl configurado). */
export function biaBetUrl(house: NoDelayBookmaker): string | null {
  const b = trim(house.betUrl || '');
  if (b) return b;
  const odds = trim(house.oddsUrl || '');
  return odds.includes('frontend') ? odds.replace('frontend', 'betgateway') : null;
}

/** Host de auth Altenar (frontend→auth). */
function authUrlOf(house: NoDelayBookmaker): string | null {
  const odds = trim(house.oddsUrl || '');
  return odds.includes('frontend') ? odds.replace('frontend', 'auth') : null;
}

function jwtExpMs(jwt: string): number | null {
  try {
    const p = JSON.parse(atob(jwt.split('.')[1]));
    return typeof p.exp === 'number' ? p.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Invalida o SB2 cacheado (ex.: 401/403 no placeWidget → força refazer a cadeia). */
export function invalidateSb2(accountId: string): void {
  cache.delete(accountId);
}

/** SB2 token da conta — cacheado até ~30s antes do exp. Dedup por conta. */
export async function getSb2Token(account: NoDelayAccount, house: NoDelayBookmaker, force = false): Promise<string> {
  const cached = cache.get(account.id);
  if (!force && cached && cached.expMs > Date.now() + 30_000) return cached.token;
  const pending = inFlight.get(account.id);
  if (pending && !force) return pending;

  const bffUrl = trim(house.bffUrl || '');
  const authUrl = authUrlOf(house);
  const integration = house.integration || house.slug;
  if (!bffUrl || !authUrl) throw new Error('Casa biahosted sem BFF / host de auth configurados.');

  const p = (async () => {
    // JWT + sessionId (do nosso cofre).
    const tr = await apiGateway.getNoDelayBetToken(account.id);
    const d = (tr.data as { data?: { token?: string; sessionId?: string }; message?: string } | undefined)?.data;
    if (!d?.token || !d?.sessionId) {
      throw new Error((tr.data as { message?: string } | undefined)?.message || 'Sessão da conta indisponível — reconecte.');
    }

    // 1) openSportsBook → authToken (UUID). Identity/Sessionid nos headers.
    const os = await fetch(`${bffUrl}/sports/openSportsBook?vendorId=altenar`, {
      headers: { accept: '*/*', Identity: d.token, Sessionid: d.sessionId },
      cache: 'no-store',
    });
    const osJson = (await os.json().catch(() => null)) as { data?: { authToken?: string }; authToken?: string } | null;
    const authToken = osJson?.data?.authToken || osJson?.authToken;
    if (!authToken) throw new Error(`Autenticação Altenar falhou no openSportsBook (${os.status}).`);

    // 2) WidgetAuth/SignIn → accessToken (SB2).
    const si = await fetch(`${authUrl}/api/WidgetAuth/SignIn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ culture: 'pt-BR', timezoneOffset: 180, integration, deviceType: 2, numFormat: 'en-GB', token: authToken }),
      cache: 'no-store',
    });
    const siJson = (await si.json().catch(() => null)) as { accessToken?: string } | null;
    const access = siJson?.accessToken;
    if (!access) throw new Error(`Autenticação Altenar falhou no SignIn (${si.status}).`);

    cache.set(account.id, { token: access, expMs: jwtExpMs(access) ?? Date.now() + 20 * 60_000 });
    return access;
  })();

  inFlight.set(account.id, p);
  try {
    return await p;
  } finally {
    inFlight.delete(account.id);
  }
}
