/**
 * Perfil do NAVEGADOR do usuário (UA + Client Hints) mandado ao backend na hora de mintar o token nst.
 *
 * Por quê: o token declara um "device", e a bet365 casa esse device com quem abre o WS premws. Se o
 * token diz Linux e o navegador é Windows, o premws aceita o handshake (100) e DERRUBA (close 1000).
 * Então o backend precisa mintar com o perfil DESTE navegador. Coletado uma vez e cacheado.
 */
export interface Bet365BrowserProfile {
  ua: string;
  platform?: string;
  uaData?: {
    platform?: string; platformVersion?: string; architecture?: string; bitness?: string;
    uaFullVersion?: string; model?: string; mobile?: boolean;
    brands?: { brand: string; version: string }[];
    fullVersionList?: { brand: string; version: string }[];
  };
}

const HIGH_ENTROPY = ['platform', 'platformVersion', 'architecture', 'bitness', 'uaFullVersion', 'fullVersionList', 'model', 'mobile'];

let cached: Promise<Bet365BrowserProfile> | null = null;

/** Coleta (e cacheia) o perfil do navegador. Chame cedo — na ENTRADA da instância bet365. */
export function getBet365BrowserProfile(): Promise<Bet365BrowserProfile> {
  if (cached) return cached;
  cached = (async () => {
    let uaData: Bet365BrowserProfile['uaData'] = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.userAgentData?.getHighEntropyValues) {
        uaData = await nav.userAgentData.getHighEntropyValues(HIGH_ENTROPY);
      }
    } catch { /* Client Hints indisponível (Firefox/Safari) — o backend cai no UA */ }
    return {
      ua: navigator.userAgent,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      platform: (navigator as any).platform,
      uaData,
    };
  })();
  return cached;
}
