/**
 * Cliente SSE da ROGUE (FSB) — as odds ao vivo da 7games, no browser.
 *
 * A rogue empurra por Server-Sent Events (não WebSocket): cada mensagem é uma
 * lista de operações `[{Operation, Type, Changeset, Reference}]`. O `initial`
 * traz o estado; os `update` trazem só o delta. É a MESMA stream que o site usa.
 *
 * Token: vem do NOSSO backend (GET /nodelay/rogue/token) — o browser não consegue
 * mintar (BFF da casa sem CORS + Cloudflare). Cacheado em módulo e renovado no
 * vencimento.
 */
import { apiGateway } from '@/gateways/api.gateway';

/** Host da casa a operar. Cada casa tem seu rogueUrl e seu slug (token). */
export interface RogueHost {
  slug: string;
  rogueUrl: string; // ex.: https://prod20563.fssb.io
}

// Token anônimo POR CASA (slug). Uma leitura, N streams.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const tokenInFlight = new Map<string, Promise<string>>();

async function getToken(slug: string): Promise<string> {
  const c = tokenCache.get(slug);
  if (c && c.expiresAt > Date.now() + 5_000) return c.token;
  const pending = tokenInFlight.get(slug);
  if (pending) return pending;

  const p = (async () => {
    const r = await apiGateway.getRogueToken(slug);
    if (r.data?.result !== 1) throw new Error(r.data?.message || 'Falha ao obter token da casa.');
    const { token, expiresAt } = r.data.data as { token: string; expiresAt: number };
    tokenCache.set(slug, { token, expiresAt });
    return token;
  })();
  tokenInFlight.set(slug, p);
  try {
    return await p;
  } finally {
    tokenInFlight.delete(slug);
  }
}

/** Zera o token da casa (forçar remint) — usar quando a SSE devolver 401. */
export function invalidateRogueToken(slug: string): void {
  tokenCache.delete(slug);
}

export type RogueOp = Record<string, unknown>;

export interface RogueStream {
  close: () => void;
}

/**
 * Abre uma SSE da rogue e chama `onOps` para cada lista de operações. Reconecta
 * sozinha com backoff; renova o token no vencimento (401). Devolve um handle que
 * a UI fecha ao sair da tela.
 *
 * Usa fetch+ReadableStream (não EventSource) porque a SSE exige header
 * `Authorization: Bearer` — e EventSource não deixa mandar headers.
 */
function openStream(
  host: RogueHost,
  path: () => string,
  onOps: (ops: RogueOp[]) => void,
  onState?: (live: boolean) => void,
): RogueStream {
  let closed = false;
  let controller: AbortController | null = null;
  let retry = 0;

  const run = async () => {
    while (!closed) {
      controller = new AbortController();
      try {
        const token = await getToken(host.slug);
        const res = await fetch(`${host.rogueUrl}${path()}`, {
          headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (res.status === 401) {
          invalidateRogueToken(host.slug);
          throw new Error('token expirado');
        }
        if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`);

        onState?.(true);
        retry = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = block
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('');
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (Array.isArray(parsed)) onOps(parsed as RogueOp[]);
            } catch {
              /* keep-alive / heartbeat — ignora */
            }
          }
        }
      } catch (e) {
        if (closed || (e as Error)?.name === 'AbortError') return;
        onState?.(false);
      }
      if (closed) return;
      // backoff 1s, 2s, 4s… até 15s
      retry = Math.min(retry + 1, 4);
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** retry, 15_000)));
    }
  };

  void run();

  return {
    close: () => {
      closed = true;
      onState?.(false);
      try { controller?.abort(); } catch { /* já fechado */ }
    },
  };
}

/** SSE da LISTA de jogos ao vivo da casa. `sportId=null` = TODOS os esportes. */
export function openLiveListStream(
  host: RogueHost,
  sportId: string | null,
  onOps: (ops: RogueOp[]) => void,
  onState?: (live: boolean) => void,
): RogueStream {
  const sportParam = sportId ? `&sportIDs=${encodeURIComponent(sportId)}` : '';
  return openStream(
    host,
    () => `/api/rogue/v1/sportsdata/sse/events?initialData=true&isLive=true${sportParam}&locale=br-pt`,
    onOps,
    onState,
  );
}

/** SSE de UM evento da casa com todos os mercados. */
export function openEventStream(
  host: RogueHost,
  eventId: string,
  onOps: (ops: RogueOp[]) => void,
  onState?: (live: boolean) => void,
): RogueStream {
  return openStream(
    host,
    () => `/api/rogue/v1/sportsdata/sse/event?initialData=true&id=${encodeURIComponent(eventId)}&includeMarkets=all&locale=br-pt`,
    onOps,
    onState,
  );
}
