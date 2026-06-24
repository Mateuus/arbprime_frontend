// Ponte (lado da PÁGINA) entre o ArbPrime e a extensão "Abrir Jogo na Casa".
// A página não enxerga chrome.*; fala com a extensão por window.postMessage.
// Se a extensão não estiver instalada, tudo cai no window.open do deep-link.
//
// Protocolo (ver arbprime_extension/content-bridge.js):
//   página  -> ext: { __arbprime: 1, type: 'PING' | 'OPEN_GAME', payload? }
//   ext  -> página: { __arbprimeExt: 1, type: 'PONG' | 'READY', version }

import { getBookmakerEventLink } from '@/utils/functions';
import type { SurebetOdd, SurebetData } from '@/interfaces/arbitragem.interface';

let cached: boolean | null = null;
let cachedVersion: string | null = null;

function isExtMessage(d: unknown): d is { __arbprimeExt: 1; type: string; version?: string } {
  return !!d && typeof d === 'object' && (d as { __arbprimeExt?: number }).__arbprimeExt === 1;
}

// Marcador síncrono que o content-bridge crava no <html> no document_start.
// Mais confiável que o ping (sem corrida de timing).
function markerVersion(): string | null {
  if (typeof document === 'undefined') return null;
  return document.documentElement.getAttribute('data-arbprime-ext');
}

/**
 * Detecta a extensão: manda PING e espera o PONG/READY do content-bridge. Memoiza.
 * Passe `force` pra ignorar o cache e re-checar (ex.: botão "verificar de novo").
 */
export function detectExtension(timeoutMs = 500, force = false): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (force) cached = null;
  if (cached !== null) return Promise.resolve(cached);
  // caminho rápido e confiável: marcador no DOM
  const mv = markerVersion();
  if (mv !== null) { cached = true; cachedVersion = mv; return Promise.resolve(true); }

  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      cached = v;
      resolve(v);
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window || !isExtMessage(ev.data)) return;
      if (ev.data.type === 'PONG' || ev.data.type === 'READY') {
        cachedVersion = ev.data.version ?? null;
        finish(true);
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ __arbprime: 1, type: 'PING' }, window.location.origin);
    window.setTimeout(() => finish(false), timeoutMs);
  });
}

export function extensionVersion(): string | null {
  return cachedVersion;
}

/** Resultado síncrono: marcador no DOM (confiável) ou cache da última detecção. */
export function isExtensionKnownInstalled(): boolean {
  return markerVersion() !== null || cached === true;
}

/**
 * Abre o jogo da perna na casa. Com a extensão instalada, manda pra ela (que pode,
 * no futuro, preencher a cédula). Sem extensão, cai no window.open do deep-link.
 * Retorna true se conseguiu disparar algo.
 */
export async function openGameInHouse(leg: SurebetOdd, event: SurebetData): Promise<boolean> {
  const url = getBookmakerEventLink(leg.bookmaker, leg.eventId, event.sport, event.date) || leg.link || undefined;

  if (await detectExtension()) {
    console.log('[ArbPrime] abrir na casa via extensão →', leg.bookmaker, { url, bet: { market: leg.market, option: leg.option, handicap: leg.handicap } });
    window.postMessage(
      {
        __arbprime: 1,
        type: 'OPEN_GAME',
        payload: {
          bookmaker: leg.bookmaker,
          eventId: leg.eventId,
          sport: event.sport,
          home: event.home,
          away: event.away,
          league: event.league,
          url,
          // seleção pra auto-preencher a cédula (BILHETE) na casa
          bet: {
            market: leg.market,
            option: leg.option,
            handicap: leg.handicap ?? null,
            price: leg.price,
            stake: leg.size ?? null, // stake sugerido (R$); null = só seleciona a odd
          },
        },
      },
      window.location.origin,
    );
    return true;
  }

  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
