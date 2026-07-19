import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Radio, Loader2, MapPin, X } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';
import { formatEventDateParts } from '@/utils/eventTime';
import { PrimeRadioEvent, PrimeRadioStationListen } from '@/interfaces/primeradio.interface';

/**
 * Página do jogo no PrimeRádio — abre em popup a partir de /primeradio (mesmo
 * padrão do /tv/{id} do PrimeTV), pra o ouvinte seguir operando na aba principal
 * enquanto escuta.
 *
 * Ter página própria (em vez de só a barrinha fixa) é o que dá espaço pra
 * imagem de fundo, dados do confronto, troca de emissora e o espaço de
 * divulgação — coisas que não cabem num player de rodapé.
 */

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const Crest = ({ url, size = 64 }: { url: string | null; size?: number }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);
  const box = { height: size, width: size };
  if (!url || broken) {
    return <span style={box} className="grid place-items-center rounded-xl bg-white/10 text-xs text-gray-400 ring-1 ring-white/15">—</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={box} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="rounded-xl object-contain drop-shadow-lg" />;
};

export default function RadioPlayerPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';

  const [event, setEvent] = useState<PrimeRadioEvent | null>(null);
  const [stations, setStations] = useState<PrimeRadioStationListen[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGateway.getPrimeRadioListen(id);
      if (res.data?.result === 1) {
        setEvent(res.data.data.event);
        setStations(res.data.data.stations || []);
        setIdx(0);
      } else {
        setErr(res.data?.message || 'Transmissão indisponível.');
      }
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Transmissão indisponível.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const current = stations[idx] || stations[0] || null;
  const parts = event ? formatEventDateParts(event.startTime) : null;

  return (
    <div className="relative min-h-screen bg-brand-dark text-white overflow-hidden">
      <Head><title>{event ? `${event.title} — PrimeRádio` : 'PrimeRádio'}</title></Head>

      {/* Fundo: a arte do jogo quando o admin cadastrou; senão, um gradiente. */}
      <div className="absolute inset-0 -z-10">
        {event?.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.coverUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover scale-105 blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-brand-dark" />
          </>
        ) : (
          <div className="h-full w-full bg-[radial-gradient(120%_80%_at_50%_0%,rgba(249,115,22,0.22),transparent_60%)]" />
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center min-h-screen">
          <Loader2 size={26} className="animate-spin text-orange-400" />
        </div>
      ) : err || !event ? (
        <div className="grid place-items-center min-h-screen px-6 text-center">
          <div>
            <Radio size={34} className="mx-auto text-gray-600 mb-3" />
            <div className="text-white font-semibold mb-1">{err || 'Transmissão indisponível.'}</div>
            <div className="text-sm text-gray-400">A transmissão pode ter sido encerrada.</div>
            <button onClick={() => window.close()} className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition">Fechar</button>
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          <div className="w-full px-4 sm:px-8 py-5 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-2.5 py-1 ring-1 ring-orange-500/40 text-orange-200 font-medium">
                  <Radio size={12} className={event.isLive ? 'animate-pulse' : ''} />
                  {event.isLive ? 'AO VIVO' : 'EM BREVE'}
                </span>
                <span className="text-gray-400">{event.competition}</span>
              </div>
              <button onClick={() => window.close()} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Fechar">
                <X size={18} />
              </button>
            </div>

            {/* Confronto */}
            <div className="mt-8 flex items-center justify-center gap-5 sm:gap-10">
              {event.isVersus ? (
                <>
                  <div className="flex flex-col items-center gap-2 max-w-[9rem]">
                    <Crest url={event.home.iconUrl} />
                    <span className="text-sm font-semibold text-center leading-tight">{event.home.name}</span>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-3xl font-bold tracking-tight">{parts?.time}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{parts?.day}</div>
                  </div>
                  <div className="flex flex-col items-center gap-2 max-w-[9rem]">
                    <Crest url={event.away.iconUrl} />
                    <span className="text-sm font-semibold text-center leading-tight">{event.away.name}</span>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-xl font-bold">{event.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{parts?.day} · {parts?.time}</div>
                </div>
              )}
            </div>

            {/* Emissoras — um jogo costuma ter várias narrando. */}
            {stations.length > 1 && (
              <div className="mt-8">
                <div className="text-xs text-gray-400 mb-2 text-center">Escolha a rádio</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {stations.map((st, i) => (
                    <button
                      key={st.id}
                      onClick={() => setIdx(i)}
                      className={`px-3 py-2 rounded-xl text-left transition ring-1 ${
                        i === idx
                          ? 'bg-orange-500/20 ring-orange-500/50 text-orange-100'
                          : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="text-sm font-medium leading-tight">{st.name}</div>
                      {st.city && (
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> {st.city}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Player */}
            <div className="mt-8 mx-auto max-w-xl rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="grid place-items-center h-11 w-11 rounded-xl bg-orange-500/20 ring-1 ring-orange-500/30 shrink-0">
                  <Radio size={20} className="text-orange-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{current?.name || 'Transmissão'}</div>
                  {current?.city && <div className="text-[11px] text-gray-400 truncate">{current.city}</div>}
                </div>
              </div>
              {/* `key` força o <audio> a recarregar ao trocar de emissora: só
                  mudar o src não reinicia o stream em alguns navegadores. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio key={current?.id || 'none'} src={current?.streamUrl} autoPlay controls className="w-full" />
            </div>
          </div>

          {/* Espaço de divulgação — fica no rodapé pra não competir com o player. */}
          <div className="w-full px-4 sm:px-8 pb-5">
            <div className="mx-auto max-w-xl h-20 rounded-xl border border-dashed border-white/10 bg-white/[0.03] grid place-items-center text-[11px] text-gray-500">
              Espaço reservado
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
