import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Volume2, Radio, Loader2, AlertTriangle, LogIn, Play } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';
import { serverManager } from '@/services/serverManager';
import { PrimeTvStreamResult } from '@/interfaces/primetv.interface';
import { formatEventDateParts } from '@/utils/eventTime';

/**
 * Página do PLAYER (janela separada — popup). Abre pela lista do PrimeTV
 * (window.open('/tv/{id}')). Renderiza SEM layout (ver noLayoutRoutes em _app).
 *
 * Fluxo:
 *  1. GET /primetv/tv/:id (auth) → dados do evento + conexão (nosso WSS).
 *  2. Conecta no nosso WSS e manda join (type 'primetv').
 *  3. O backend abre um PROXY pro ms server (injeta o msToken — que nunca vem pro
 *     cliente). Quando pronto, manda { ready:true }.
 *  4. Aqui roda o consume mediasoup NORMAL (device → recvTransport próprio →
 *     consume vídeo/áudio → tracks), mas a sinalização vai pelo WSS (wrap
 *     { action:'ms', payload }). A MÍDIA flui direto browser↔ms via WebRTC/ICE.
 *  5. `videoEl.srcObject = new MediaStream(tracks)` → toca.
 *
 * mediasoup-client é carregado do CDN (esm.sh) sob demanda — não precisa do
 * pacote no bundle (`webpackIgnore`), igual ao player de referência do fornecedor.
 */

type LoadState = 'loading' | 'ok' | 'auth' | 'notfound' | 'error';
type PlayStatus = 'idle' | 'connecting' | 'signaling' | 'playing' | 'waiting' | 'no-session' | 'closed' | 'error';

export default function PrimeTvPlayerPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';

  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PrimeTvStreamResult | null>(null);
  const [message, setMessage] = useState<string>('');
  const [play, setPlay] = useState<{ status: PlayStatus; error?: string }>({ status: 'idle' });
  const [needsTap, setNeedsTap] = useState(false); // autoplay com som bloqueado → clique
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1) Carrega os dados da transmissão.
  useEffect(() => {
    if (!router.isReady || !id) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiGateway.getPrimeTvStream(id);
        if (!alive) return;
        if (res.data?.result === 1) {
          setData(res.data.data as PrimeTvStreamResult);
          setState('ok');
        } else {
          setState('error');
          setMessage(res.data?.message || 'Não foi possível carregar a transmissão.');
        }
      } catch (e) {
        if (!alive) return;
        const status = (e as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
        if (status === 401) setState('auth');
        else if (status === 404) setState('notfound');
        else {
          setState('error');
          setMessage((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao conectar.');
        }
      }
    })();
    return () => { alive = false; };
  }, [router.isReady, id]);

  // 2) SFU: o backend consome 1x do fornecedor e re-transmite. Aqui o player é um
  // RTCPeerConnection PURO (sem mediasoup no browser): conecta no nosso WSS, o
  // backend manda um OFFER, a gente responde com ANSWER, troca ICE, e toca o
  // vídeo que chega via `ontrack`.
  useEffect(() => {
    if (state !== 'ok' || !data) return;
    const eventId = data.connection.eventId;
    const videoEl = videoRef.current; // capturado p/ o cleanup (o elemento é estável)
    let alive = true;
    let ws: WebSocket | null = null;
    let pc: RTCPeerConnection | null = null;
    const remoteStream = new MediaStream();

    const signal = (msg: Record<string, unknown>) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'primetv-sfu', eventId, ...msg }));
    };

    const setupPc = () => {
      const conn = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      conn.ontrack = (e) => {
        remoteStream.addTrack(e.track);
        if (videoEl && videoEl.srcObject !== remoteStream) {
          videoEl.srcObject = remoteStream;
          videoEl.play().catch(() => { videoEl.muted = true; setNeedsTap(true); videoEl.play().catch(() => {}); });
        }
        setPlay({ status: 'playing' });
      };
      conn.onicecandidate = (e) => { if (e.candidate) signal({ action: 'ice', candidate: e.candidate.toJSON() }); };
      conn.onconnectionstatechange = () => {
        const s = conn.connectionState;
        console.log('[PrimeTV][player] pc', s);
        if (s === 'failed') setPlay({ status: 'error', error: 'conexão WebRTC falhou' });
      };
      pc = conn;
      return conn;
    };

    const onOffer = async (sdp: string) => {
      setPlay({ status: 'signaling' });
      const conn = pc || setupPc();
      await conn.setRemoteDescription({ type: 'offer', sdp });
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      signal({ action: 'answer', sdp: answer.sdp });
    };

    (async () => {
      let token = 'anonymous';
      try { token = await apiGateway.getUserAuth(); } catch { /* anônimo */ }
      if (!alive) return;
      serverManager.init();
      const base = serverManager.getWsBase();
      console.log('[PrimeTV][player] WSS', base, 'evento', eventId);
      setPlay({ status: 'connecting' });
      ws = new WebSocket(`${base}?token=${encodeURIComponent(token)}`);
      ws.onopen = () => signal({ action: 'join' });
      ws.onmessage = async (evt) => {
        let msg: { type?: string; action?: string; sdp?: string; candidate?: RTCIceCandidateInit };
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg?.type !== 'primetv-sfu') return;
        if (msg.action === 'offer' && msg.sdp) { try { await onOffer(msg.sdp); } catch (e) { setPlay({ status: 'error', error: (e as Error).message }); } return; }
        if (msg.action === 'ice' && msg.candidate) { try { await pc?.addIceCandidate(msg.candidate); } catch { /* ignore */ } return; }
        if (msg.action === 'no-session') { setPlay({ status: 'no-session' }); return; }
        if (msg.action === 'no-media') { setPlay({ status: 'waiting' }); return; }
      };
      ws.onclose = () => { if (alive) setPlay((p) => (p.status === 'playing' ? p : { status: 'closed' })); };
      ws.onerror = () => { /* onclose trata */ };
    })();

    return () => {
      alive = false;
      try { signal({ action: 'leave' }); } catch { /* ignore */ }
      try { ws?.close(); } catch { /* ignore */ }
      try { pc?.close(); } catch { /* ignore */ }
      if (videoEl?.srcObject) {
        (videoEl.srcObject as MediaStream).getTracks().forEach((tr) => tr.stop());
        videoEl.srcObject = null;
      }
    };
  }, [state, data]);

  const ev = data?.event;
  const parts = ev ? formatEventDateParts(ev.startTime) : { day: '', time: '' };

  // Clique p/ dar play com som (quando o autoplay bloqueou).
  const tapToUnmute = () => {
    const video = videoRef.current;
    if (video) { video.muted = false; video.play().catch(() => {}); }
    setNeedsTap(false);
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden">
      <Head><title>{ev ? ev.title : 'PrimeTV'} — Player</title></Head>

      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-b from-black/90 to-black/40 border-b border-white/10">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{ev ? ev.title : 'PrimeTV'}</div>
          <div className="text-[11px] text-gray-400 truncate">
            {ev ? `${ev.competition}${ev.country ? ` · ${ev.country}` : ''}` : 'Carregando...'}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ev?.hasAudio && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/10 text-gray-200"><Volume2 size={11} /> áudio</span>
          )}
          {ev?.isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-500/25 text-red-300 ring-1 ring-red-500/40"><Radio size={10} className="animate-pulse" /> AO VIVO</span>
          ) : ev ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/10 text-gray-300">{parts.day} {parts.time}</span>
          ) : null}
        </div>
      </div>

      {/* Palco do vídeo */}
      <div className="flex-1 relative bg-black grid place-items-center">
        <video ref={videoRef} autoPlay playsInline controls className="max-h-full max-w-full w-full h-full object-contain bg-black" />

        {/* Botão p/ dar som (autoplay bloqueado) */}
        {play.status === 'playing' && needsTap && (
          <button onClick={tapToUnmute} className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-400 text-sm font-semibold shadow-lg">
            <Play size={16} /> Tocar com som
          </button>
        )}

        {/* Overlays de estado (o vídeo fica por baixo) */}
        {!(state === 'ok' && play.status === 'playing') && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 px-6 text-center">
            {state === 'loading' && (
              <div className="flex flex-col items-center gap-2 text-gray-300"><Loader2 className="animate-spin" size={26} /> <span className="text-sm">Carregando transmissão...</span></div>
            )}
            {state === 'auth' && (
              <div className="flex flex-col items-center gap-2 text-gray-300 max-w-sm">
                <LogIn size={26} className="text-red-300" />
                <span className="text-sm">Você precisa estar logado para assistir.</span>
                <button onClick={() => window.location.assign('/?modal=auth&page=login')} className="mt-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-sm font-semibold">Fazer login</button>
              </div>
            )}
            {state === 'notfound' && (
              <div className="flex flex-col items-center gap-2 text-gray-400 max-w-sm"><AlertTriangle size={26} className="text-amber-300" /> <span className="text-sm">Transmissão não encontrada ou já encerrada.</span></div>
            )}
            {state === 'error' && (
              <div className="flex flex-col items-center gap-2 text-gray-400 max-w-sm"><AlertTriangle size={26} className="text-rose-300" /> <span className="text-sm">{message || 'Erro ao conectar.'}</span></div>
            )}
            {state === 'ok' && (
              <div className="flex flex-col items-center gap-2 text-gray-400 max-w-md">
                {play.status === 'no-session' ? (
                  <><AlertTriangle className="text-amber-300" size={26} /> <span className="text-sm">Transmissão não está ativa no servidor. Tente reabrir.</span></>
                ) : play.status === 'error' ? (
                  <><AlertTriangle className="text-rose-300" size={26} /> <span className="text-sm">Falha no player: {play.error}</span></>
                ) : play.status === 'closed' ? (
                  <><AlertTriangle className="text-amber-300" size={26} /> <span className="text-sm">Conexão encerrada.</span></>
                ) : play.status === 'waiting' ? (
                  <><Radio className="text-red-400 animate-pulse" size={26} /> <span className="text-sm">Aguardando o produtor... (o sinal volta sozinho)</span></>
                ) : (
                  <><Loader2 className="animate-spin text-red-400" size={26} /> <span className="text-sm">{play.status === 'signaling' ? 'Negociando o vídeo...' : 'Conectando à transmissão...'}</span></>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
