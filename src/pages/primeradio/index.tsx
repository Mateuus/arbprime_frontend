import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Radio, RefreshCcw, Search, Headphones, X, Loader2, AlertTriangle } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { formatEventDateParts } from '@/utils/eventTime';
import { apiGateway } from '@/gateways/api.gateway';
import { PrimeRadioEvent, PrimeRadioListResult, PrimeRadioStationListen } from '@/interfaces/primeradio.interface';

/**
 * PrimeRádio — lista das narrações em ÁUDIO dos jogos.
 *
 * Feature paralela ao PrimeTV (não passa por WebRTC/SFU): ao clicar em "Ouvir",
 * buscamos a URL do stream na rota autenticada e tocamos num <audio> fixo no
 * rodapé — assim dá pra continuar navegando enquanto escuta (que é o
 * comportamento natural de rádio, diferente do player de vídeo que abre popup).
 *
 * Acento da feature: LARANJA (o vermelho é do PrimeTV — ver memória de cores).
 */

const fieldBase =
  'bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition';

/** Bandeira (emoji) a partir do código ISO-2. Vazio se não for ISO-2 válido. */
const flagEmoji = (cc?: string | null): string => {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
};

const initials = (name: string): string =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

/** Escudo do time; no erro cai em iniciais (mesmo componente da lista do PrimeTV). */
const TeamAvatar = ({ name, url }: { name: string; url: string | null }) => {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <span className="grid place-items-center h-7 w-7 rounded-full bg-white/10 text-[10px] font-bold text-gray-300 ring-1 ring-white/10 shrink-0">
        {initials(name)}
      </span>
    );
  }
  // referrerPolicy=no-referrer: a SofaScore bloqueia hotlink por Referer de domínio público.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-7 w-7 rounded-full object-contain bg-white/5 ring-1 ring-white/10 shrink-0" />;
};

type Filter = 'all' | 'live' | 'upcoming';

interface NowPlaying {
  event: PrimeRadioEvent;
  streamUrl: string | null;
  stations: PrimeRadioStationListen[];
}

export default function PrimeRadioPage() {
  const router = useRouter();
  const { user } = useUserContext();

  const [data, setData] = useState<PrimeRadioListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [competition, setCompetition] = useState<string>('all');
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // qual emissora está tocando (índice na lista do jogo aberto)
  const [stationIdx, setStationIdx] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await apiGateway.getPrimeRadioEvents();
      if (res.data?.result === 1) {
        setData(res.data.data as PrimeRadioListResult);
        setErr(null);
      } else {
        setErr(res.data?.message || 'Erro ao carregar as transmissões.');
      }
    } catch {
      setErr('Erro ao carregar as transmissões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Recarrega periodicamente pro status (agendado → ao vivo) acompanhar o relógio.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  /** Ouvir exige login: deslogado abre o modal de auth SOBRE a página (shallow). */
  const listen = useCallback(
    async (ev: PrimeRadioEvent) => {
      if (!user) {
        router.push('/primeradio?modal=auth&page=login', undefined, { shallow: true });
        return;
      }
      setOpeningId(ev.id);
      try {
        const res = await apiGateway.getPrimeRadioListen(ev.id);
        if (res.data?.result === 1) {
          setStationIdx(0);
          setNowPlaying(res.data.data as NowPlaying);
        }
        else setErr(res.data?.message || 'Não foi possível abrir a transmissão.');
      } catch {
        setErr('Não foi possível abrir a transmissão.');
      } finally {
        setOpeningId(null);
      }
    },
    [user, router],
  );

  // Emissora tocando agora (guarda o índice fora da faixa após trocar de jogo).
  const current = nowPlaying?.stations?.[stationIdx] || nowPlaying?.stations?.[0] || null;

  const events = useMemo(() => {
    const all = data?.events || [];
    const term = search.trim().toLowerCase();
    return all.filter((e) => {
      if (filter === 'live' && !e.isLive) return false;
      if (filter === 'upcoming' && e.isLive) return false;
      if (competition !== 'all' && e.competitionKey !== competition) return false;
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        e.competition.toLowerCase().includes(term) ||
        (e.country || '').toLowerCase().includes(term) ||
        (e.station || '').toLowerCase().includes(term)
      );
    });
  }, [data, search, filter, competition]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      active ? 'bg-orange-500 text-slate-900 font-semibold' : 'text-gray-300 hover:bg-white/10'
    }`;

  return (
    <div className="w-full px-3 sm:px-6 py-6 pb-28">
      <Head><title>PrimeRádio — ArbPrime</title></Head>

      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-500/5 ring-1 ring-orange-500/30 shrink-0">
            <Radio size={22} className="text-orange-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">PrimeRádio</h1>
            <p className="text-sm text-gray-400 truncate">Narração ao vivo dos jogos</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-bold text-white leading-none">{data?.liveCount ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Ao vivo agora</div>
          </div>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="grid place-items-center h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-orange-300 hover:border-orange-500/40 transition"
            title="Atualizar"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Abas de competição */}
      {(data?.competitions?.length ?? 0) > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setCompetition('all')} className={chip(competition === 'all')}>
            Todos <span className="ml-1 text-xs opacity-70">{data?.total ?? 0}</span>
          </button>
          {data?.competitions.map((c) => (
            <button key={c.key} onClick={() => setCompetition(c.key)} className={chip(competition === c.key)}>
              {c.label} <span className="ml-1 text-xs opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Busca + filtros */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jogo, competição, rádio..."
            className={`${fieldBase} w-full pl-9`}
          />
        </div>
        <div className="flex gap-1 bg-black/30 border border-white/10 rounded-lg p-1">
          <button onClick={() => setFilter('all')} className={chip(filter === 'all')}>Todos</button>
          <button onClick={() => setFilter('live')} className={chip(filter === 'live')}>Ao vivo</button>
          <button onClick={() => setFilter('upcoming')} className={chip(filter === 'upcoming')}>Agendados</button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center gap-2">
          <AlertTriangle size={16} /> {err}
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading && !data ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Radio size={30} className="mx-auto mb-2 text-gray-600" />
            <div className="text-sm">Nenhuma transmissão de rádio no momento.</div>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {events.map((ev) => {
              const parts = formatEventDateParts(ev.startTime);
              const playing = nowPlaying?.event.id === ev.id;

  return (
                <li key={ev.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-white/5 transition">
                  {/* horário + status */}
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-sm font-semibold text-white leading-tight">{parts.time}</div>
                    <div className={`text-[10px] font-medium ${ev.isLive ? 'text-orange-400' : 'text-gray-500'}`}>
                      {ev.isLive ? 'Ao Vivo' : 'Previsto'}
                    </div>
                  </div>

                  {/* jogo */}
                  <div className="flex-1 min-w-0">
                    {ev.isVersus ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamAvatar name={ev.home.name} url={ev.home.iconUrl} />
                        <span className="text-sm text-white font-medium truncate">{ev.home.name}</span>
                        <span className="text-gray-600 text-xs shrink-0">×</span>
                        <TeamAvatar name={ev.away.name} url={ev.away.iconUrl} />
                        <span className="text-sm text-white font-medium truncate">{ev.away.name}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-white font-medium truncate">{ev.title}</div>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400 min-w-0">
                      <span className="shrink-0">{flagEmoji(ev.countryCode)}</span>
                      <span className="truncate">{ev.competition}</span>
                      {ev.station && <span className="text-orange-300/80 truncate">· {ev.station}</span>}
                    </div>
                  </div>

                  {/* ouvir — só quando ao vivo (agendado ainda não tem sinal) */}
                  {ev.isLive && (
                    <button
                      onClick={() => listen(ev)}
                      disabled={openingId === ev.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
                        playing ? 'bg-white/10 text-orange-300 ring-1 ring-orange-500/40' : 'bg-orange-500 hover:bg-orange-400 text-slate-900'
                      }`}
                    >
                      {openingId === ev.id ? <Loader2 size={16} className="animate-spin" /> : <Headphones size={16} />}
                      <span className="hidden sm:inline">{playing ? 'Ouvindo' : 'Ouvir'}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Player fixo no rodapé — continua tocando enquanto navega */}
      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-orange-500/30 bg-brand-dark/95 backdrop-blur-sm shadow-2xl">
          <div className="w-full px-3 sm:px-6 py-3 flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-lg bg-orange-500/20 ring-1 ring-orange-500/30 shrink-0">
              <Radio size={18} className="text-orange-300 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{nowPlaying.event.title}</div>
              <div className="text-[11px] text-gray-400 truncate">
                {nowPlaying.event.competition}
                {current ? ` · ${current.name}` : ''}
                {current?.city ? ` (${current.city})` : ''}
              </div>
              {/* Várias rádios narram o mesmo jogo — quem escolhe é o ouvinte. */}
              {nowPlaying.stations.length > 1 && (
                <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar">
                  {nowPlaying.stations.map((st, i) => (
                    <button
                      key={st.id}
                      onClick={() => setStationIdx(i)}
                      title={st.city ? `${st.name} — ${st.city}` : st.name}
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 transition ${
                        i === stationIdx
                          ? 'bg-orange-500/20 text-orange-200 ring-orange-500/40'
                          : 'bg-white/5 text-gray-400 ring-white/10 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {st.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* `key` força o <audio> a recarregar ao trocar de emissora: só mudar
                o src não reinicia o stream em alguns navegadores. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio key={current?.id || 'none'} src={current?.streamUrl} autoPlay controls className="h-9 max-w-[46vw] sm:max-w-sm" />
            <button
              onClick={() => setNowPlaying(null)}
              className="grid place-items-center h-9 w-9 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition shrink-0"
              title="Fechar player"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
