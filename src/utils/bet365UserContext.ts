/**
 * Captura o contexto REAL do usuário (do browser dele) que o nst de aposta da bet365 exige:
 *   - ipv6  → srflx via WebRTC (STUN), igual a página da bet365 faz (campo `i` do nst)
 *   - geo   → navigator.geolocation (campos l/m do nst; a bet365 exige localização c/ acurácia)
 * Cacheado por sessão (captura 1×, reusa). Enviado no ticket p/ o backend mintar o nst autêntico.
 */

export interface Bet365UserContext {
  ipv6?: string;
  geo?: { lat: number; lon: number; acc: number };
}

let cached: Bet365UserContext | null = null;
let inflight: Promise<Bet365UserContext> | null = null;

/** srflx ipv6 via WebRTC (STUN). Resolve undefined se o host não tiver ipv6 / bloqueado. */
function captureIpv6(): Promise<string | undefined> {
  return new Promise((resolve) => {
    let pc: RTCPeerConnection | null = null;
    let done = false;
    const finish = (v?: string) => { if (done) return; done = true; try { pc?.close(); } catch { /* */ } resolve(v); };
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('x');
      let fallback: string | undefined;
      // Resolve cedo no 1º srflx; o teto é só p/ quem NÃO tem ipv6 público (espera o timeout). 1500ms basta
      // (o backend tem fallback de ipv6). Pré-aquecido no connect → nem entra no relógio do clique→aposta.
      const to = setTimeout(() => finish(fallback), 1500);
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(to); finish(fallback); return; }
        const cand = e.candidate.candidate || '';
        const m = /(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/i.exec(cand);
        if (!m) return;
        if (/typ srflx/.test(cand)) { clearTimeout(to); finish(m[0]); } // srflx = ipv6 público (o que a bet365 usa)
        else if (!fallback) fallback = m[0];
      };
      pc.createOffer().then((o) => pc!.setLocalDescription(o)).catch(() => finish(fallback));
    } catch { finish(undefined); }
  });
}

/** geolocation do usuário. Resolve undefined se negado/indisponível. */
function captureGeo(): Promise<{ lat: number; lon: number; acc: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  });
}

/** Captura (ou reusa do cache) o contexto do usuário. Chame no connect da conta bet365 (pré-aquece o cache). */
export async function captureBet365UserContext(force = false): Promise<Bet365UserContext> {
  if (cached && !force) return cached;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const [ipv6, geo] = await Promise.all([captureIpv6(), captureGeo()]);
    cached = { ipv6, geo };
    return cached;
  })();
  try { return await inflight; } finally { inflight = null; }
}
