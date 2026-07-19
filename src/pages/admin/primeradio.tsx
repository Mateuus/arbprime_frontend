import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { Radio, RefreshCcw, Plus, Pencil, Trash2, X, Search, Square, RotateCcw, Loader2, Activity } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';
import { formatEventDateParts } from '@/utils/eventTime';
import { PrimeRadioAdminEvent, UpsertPrimeRadioDTO } from '@/interfaces/primeradio.interface';

/**
 * Painel do PrimeRádio — cadastro manual das narrações (nós somos o fornecedor).
 *
 * ⚠️ HORÁRIO: a convenção do projeto é wallclock de BRASÍLIA "tagueado com Z"
 * ("2026-06-30T22:00:00.000Z" = 22:00 BRT). O <input datetime-local> já entrega o
 * que o admin digitou, então a conversão é PURAMENTE textual (append/slice) —
 * usar `new Date()` aqui converteria fuso e jogaria o horário 3h fora.
 */

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition';

const DURATION_MIN = 100; // duração padrão sugerida (fim = início + 100 min)

/** "2026-06-30T22:00" (input) → "2026-06-30T22:00:00.000Z" (convenção). Sem Date! */
const toWallclockIso = (local: string): string => (local ? `${local.slice(0, 16)}:00.000Z` : '');
/** "2026-06-30T22:00:00.000Z" → "2026-06-30T22:00" (p/ preencher o input). */
const toLocalInput = (iso: string): string => (iso ? iso.slice(0, 16) : '');

/** Soma minutos preservando o wallclock (parse/format ambos em Z = sem conversão). */
const addMinutes = (localValue: string, minutes: number): string => {
  const iso = toWallclockIso(localValue);
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return toLocalInput(new Date(t + minutes * 60_000).toISOString());
};

const crest = (sofaId: string): string | null =>
  sofaId.trim() ? `https://api.sofascore.com/api/v1/team/${sofaId.trim()}/image` : null;

interface Form {
  homeName: string;
  awayName: string;
  homeSofaId: string;
  awaySofaId: string;
  title: string;
  competition: string;
  country: string;
  countryCode: string;
  sport: string;
  startTime: string; // valor do input (local, sem Z)
  endTime: string;
  coverUrl: string;
  stations: StationRow[];
}

/** Uma emissora no formulário. Um jogo costuma ter várias narrando. */
interface StationRow { name: string; streamUrl: string; city: string }

const emptyStation = (): StationRow => ({ name: '', streamUrl: '', city: '' });

const emptyForm: Form = {
  homeName: '', awayName: '', homeSofaId: '', awaySofaId: '', title: '',
  competition: '', country: '', countryCode: '', sport: 'futebol',
  startTime: '', endTime: '', coverUrl: '', stations: [emptyStation()],
};

/**
 * Escudo do time. `referrerPolicy="no-referrer"` é obrigatório: a SofaScore
 * bloqueia hotlink pelo Referer (mesma solução usada na lista do PrimeTV).
 */
const Crest = ({ url, size = 36 }: { url: string | null; size?: number }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);
  const box = { height: size, width: size };
  if (!url || broken) {
    return <span style={box} className="grid place-items-center rounded-lg bg-white/5 text-[10px] text-gray-500 ring-1 ring-white/10 shrink-0">—</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={box} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="rounded-lg object-contain bg-white/5 ring-1 ring-white/10 shrink-0" />;
};

/** Preview no formulário: monta a URL a partir do id digitado, na hora. */
const CrestPreview = ({ sofaId }: { sofaId: string }) => <Crest url={crest(sofaId)} />;

/** Resultado do teste do link (POST /primeradio/admin/probe). */
interface StreamProbe {
  ok: boolean;
  error?: string;
  kind?: 'audio' | 'playlist' | 'outro';
  name?: string | null;
  bitrate?: number | null;
  channels?: number | null;
  listeners?: number | null;
  listenerPeak?: number | null;
  nowPlaying?: string | null;
}

/** Monta os selos do resultado, pulando o que a estação não declarou. */
const probeSpecs = (p: StreamProbe): string[] => {
  const out: string[] = [];
  if (p.name) out.push(p.name);
  if (p.kind === 'playlist') out.push('playlist');
  if (p.bitrate) out.push(`${p.bitrate}kbps${p.channels === 2 ? ' estéreo' : ''}`);
  if (p.listeners !== null && p.listeners !== undefined) {
    out.push(`${p.listeners} ouvinte${p.listeners === 1 ? '' : 's'}${p.listenerPeak ? ` (pico ${p.listenerPeak})` : ''}`);
  }
  return out;
};

/**
 * Jogo vindo de /external/events/grouped (o MESMO que a página /events usa —
 * MySQL do arbbetting via ExternalDataSource). Não usar o /events do Redis
 * (EventMatchList): lá só existe o que o matcher já casou, e a maioria dos
 * jogos não aparece na busca.
 */
interface MatchedEvent {
  key: string; sport: string; home: string; away: string;
  eventDate: string | null; league: string | null; country: string | null;
}

export default function AdminPrimeRadioPage() {
  const [items, setItems] = useState<PrimeRadioAdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PrimeRadioAdminEvent | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // busca de jogo em /events (preenche o formulário)
  const [gameSearch, setGameSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<MatchedEvent[]>([]);
  const [probes, setProbes] = useState<Record<number, StreamProbe>>({});
  const [probingIdx, setProbingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getPrimeRadioAdmin();
      if (res.data?.result === 1) setItems(res.data.data || []);
      else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar as transmissões.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar as transmissões.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setMatches([]);
    setGameSearch('');
    setModalOpen(true);
  };

  const openEdit = (ev: PrimeRadioAdminEvent) => {
    setEditing(ev);
    setForm({
      homeName: ev.home.name, awayName: ev.away.name,
      homeSofaId: ev.home.sofaId || '', awaySofaId: ev.away.sofaId || '',
      title: ev.isVersus ? '' : ev.title,
      competition: ev.competition === 'Outros' ? '' : ev.competition,
      country: ev.country || '', countryCode: ev.countryCode || '',
      sport: ev.sport, startTime: toLocalInput(ev.startTime), endTime: toLocalInput(ev.endTime),
      coverUrl: ev.coverUrl || '',
      stations: ev.adminStations?.length
        ? ev.adminStations.map((st) => ({ name: st.name, streamUrl: st.streamUrl, city: st.city || '' }))
        : [{ name: ev.station || '', streamUrl: ev.streamUrl || '', city: '' }],
    });
    setMatches([]);
    setGameSearch('');
    setModalOpen(true);
  };

  /** Busca no catálogo de eventos (mesma fonte da página /events). */
  const searchGames = async () => {
    const term = gameSearch.trim();
    if (!term) return;
    setSearching(true);
    try {
      const res = await apiGateway.getGroupedEvents({ search: term, limit: 12, upcomingOnly: true });
      setMatches(res.data?.result === 1 ? (res.data.data?.events || []) : []);
    } catch {
      setMatches([]);
    } finally {
      setSearching(false);
    }
  };

  /** Aplica o jogo escolhido no formulário (o admin ainda pode ajustar tudo). */
  const pickGame = (g: MatchedEvent) => {
    const start = toLocalInput(g.eventDate || '');
    setForm((f) => ({
      ...f,
      homeName: g.home || f.homeName,
      awayName: g.away || f.awayName,
      competition: g.league || f.competition,
      country: g.country || f.country,
      sport: g.sport || f.sport,
      startTime: start || f.startTime,
      endTime: start ? addMinutes(start, DURATION_MIN) : f.endTime,
    }));
    setMatches([]);
  };

  /**
   * Pergunta ao backend se o link está no ar. Não dá pra fazer daqui: a
   * resposta do Icecast não manda CORS e o navegador não expõe cabeçalho icy-*.
   */
  const runProbe = async (idx: number) => {
    const url = (form.stations[idx]?.streamUrl || '').trim();
    if (!url) return;
    setProbingIdx(idx);
    setProbes((p) => { const n = { ...p }; delete n[idx]; return n; });
    try {
      const res = await apiGateway.probePrimeRadioStream(url);
      const result: StreamProbe = res.data?.result === 1 ? res.data.data : { ok: false, error: res.data?.message };
      setProbes((p) => ({ ...p, [idx]: result }));
      // A estação costuma declarar o próprio nome — se o campo está vazio, aproveita.
      if (result.ok && result.name) {
        setForm((f) => {
          if (f.stations[idx]?.name.trim()) return f;
          const stations = [...f.stations];
          stations[idx] = { ...stations[idx], name: result.name as string };
          return { ...f, stations };
        });
      }
    } catch (e) {
      setProbes((p) => ({ ...p, [idx]: { ok: false, error: errorMessage(e, 'Não foi possível testar o link.') } }));
    } finally {
      setProbingIdx(null);
    }
  };

  const setStation = (idx: number, patch: Partial<StationRow>) => {
    setForm((f) => {
      const stations = [...f.stations];
      stations[idx] = { ...stations[idx], ...patch };
      return { ...f, stations };
    });
  };
  const addStation = () => setForm((f) => ({ ...f, stations: [...f.stations, emptyStation()] }));
  const removeStation = (idx: number) => {
    setForm((f) => ({ ...f, stations: f.stations.filter((_, i) => i !== idx) }));
    setProbes((p) => { const n = { ...p }; delete n[idx]; return n; });
  };

  /** Ao mudar o início, sugere o fim (+100 min) se ainda não houver um. */
  const onStartChange = (value: string) => {
    setForm((f) => ({ ...f, startTime: value, endTime: f.endTime || (value ? addMinutes(value, DURATION_MIN) : '') }));
  };

  const handleSave = async () => {
    const hasTeams = form.homeName.trim() && form.awayName.trim();
    if (!hasTeams && !form.title.trim()) {
      setMsg({ type: 'err', text: 'Informe os dois times ou um título para o evento.' });
      return;
    }
    if (!form.startTime || !form.endTime) {
      setMsg({ type: 'err', text: 'Informe início e término.' });
      return;
    }
    const stations = form.stations
      .map((st) => ({ name: st.name.trim(), streamUrl: st.streamUrl.trim(), city: st.city.trim() || null }))
      .filter((st) => st.streamUrl);
    if (!stations.length) {
      setMsg({ type: 'err', text: 'Informe ao menos uma rádio com link.' });
      return;
    }
    if (stations.some((st) => !st.name)) {
      setMsg({ type: 'err', text: 'Toda rádio precisa de um nome.' });
      return;
    }
    setSaving(true);
    try {
      const payload: UpsertPrimeRadioDTO = {
        homeName: form.homeName.trim() || null,
        awayName: form.awayName.trim() || null,
        homeSofaId: form.homeSofaId.trim() || null,
        awaySofaId: form.awaySofaId.trim() || null,
        title: form.title.trim() || null,
        competition: form.competition.trim() || null,
        country: form.country.trim() || null,
        countryCode: form.countryCode.trim() || null,
        sport: form.sport.trim() || 'futebol',
        startTime: toWallclockIso(form.startTime),
        endTime: toWallclockIso(form.endTime),
        coverUrl: form.coverUrl.trim() || null,
        stations,
      };
      if (editing) {
        await apiGateway.updatePrimeRadioEvent(editing.id, payload);
        setMsg({ type: 'ok', text: 'Transmissão atualizada.' });
      } else {
        await apiGateway.createPrimeRadioEvent(payload);
        setMsg({ type: 'ok', text: 'Transmissão criada.' });
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar a transmissão.') });
    } finally {
      setSaving(false);
    }
  };

  const act = async (ev: PrimeRadioAdminEvent, what: 'end' | 'reopen' | 'delete') => {
    if (what === 'delete' && !window.confirm(`Remover "${ev.title}"?`)) return;
    setBusyId(ev.id);
    try {
      if (what === 'end') await apiGateway.endPrimeRadioEvent(ev.id);
      if (what === 'reopen') await apiGateway.reopenPrimeRadioEvent(ev.id);
      if (what === 'delete') await apiGateway.deletePrimeRadioEvent(ev.id);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro na ação.') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <Head><title>PrimeRádio — Administração</title></Head>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-500/5 ring-1 ring-orange-500/30 shrink-0">
            <Radio size={22} className="text-orange-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">PrimeRádio</h1>
            <p className="text-sm text-gray-400">Cadastro das narrações em áudio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} className="grid place-items-center h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-orange-300 hover:border-orange-500/40 transition" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-900 font-semibold text-sm transition">
            <Plus size={16} /> Nova transmissão
          </button>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 ${msg.type === 'ok' ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-current opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Radio size={30} className="mx-auto mb-2 text-gray-600" />
            <div className="text-sm">Nenhuma transmissão cadastrada.</div>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((ev) => {
              const parts = formatEventDateParts(ev.startTime);
              const ended = ev.status === 'finished';
              return (
                <li key={ev.id} className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-white/5 transition">
                  <div className="w-20 shrink-0 text-center">
                    <div className="text-xs text-gray-400">{parts.day}</div>
                    <div className="text-sm font-semibold text-white">{parts.time}</div>
                  </div>
                  {ev.isVersus && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Crest url={ev.home.iconUrl} size={28} />
                      <Crest url={ev.away.iconUrl} size={28} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{ev.title}</div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {ev.competition}{ev.station ? ` · ${ev.station}` : ''}
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                    ev.isLive ? 'bg-orange-500/15 text-orange-300 ring-orange-500/30'
                    : ended ? 'bg-white/5 text-gray-400 ring-white/10'
                    : 'bg-sky-500/15 text-sky-300 ring-sky-500/30'
                  }`}>
                    {ev.isLive ? 'Ao vivo' : ended ? 'Encerrado' : 'Agendado'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {ended && ev.endedAt ? (
                      <button onClick={() => act(ev, 'reopen')} disabled={busyId === ev.id} className="p-2 rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-white/10 transition disabled:opacity-50" title="Reabrir">
                        <RotateCcw size={15} />
                      </button>
                    ) : (
                      <button onClick={() => act(ev, 'end')} disabled={busyId === ev.id} className="p-2 rounded-lg text-gray-400 hover:text-amber-300 hover:bg-white/10 transition disabled:opacity-50" title="Encerrar agora">
                        <Square size={15} />
                      </button>
                    )}
                    <button onClick={() => openEdit(ev)} className="p-2 rounded-lg text-gray-400 hover:text-orange-300 hover:bg-white/10 transition" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => act(ev, 'delete')} disabled={busyId === ev.id} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition disabled:opacity-50" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-2xl rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Editar transmissão' : 'Nova transmissão'}</h2>

            {/* Busca de jogo — atalho: preenche times/liga/horário */}
            {!editing && (
              <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400 mb-2">Buscar jogo já cadastrado (opcional — preenche os campos)</div>
                <div className="flex gap-2">
                  <input
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchGames(); } }}
                    placeholder="Ex.: Flamengo"
                    className={inputClass}
                  />
                  <button onClick={searchGames} disabled={searching} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white transition disabled:opacity-50">
                    {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
                  </button>
                </div>
                {matches.length > 0 && (
                  <ul className="mt-2 max-h-44 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10">
                    {matches.map((g) => (
                      <li key={g.key}>
                        <button onClick={() => pickGame(g)} className="w-full text-left px-3 py-2 hover:bg-white/10 transition">
                          <div className="text-sm text-white truncate">{g.home} × {g.away}</div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {g.league || '—'} · {formatEventDateParts(g.eventDate || '').day} {formatEventDateParts(g.eventDate || '').time}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Times + escudos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400">Time da casa
                  <input value={form.homeName} onChange={(e) => setForm({ ...form, homeName: e.target.value })} className={`${inputClass} mt-1`} />
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <CrestPreview sofaId={form.homeSofaId} />
                  <input value={form.homeSofaId} onChange={(e) => setForm({ ...form, homeSofaId: e.target.value })} placeholder="ID SofaScore" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400">Time visitante
                  <input value={form.awayName} onChange={(e) => setForm({ ...form, awayName: e.target.value })} className={`${inputClass} mt-1`} />
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <CrestPreview sofaId={form.awaySofaId} />
                  <input value={form.awaySofaId} onChange={(e) => setForm({ ...form, awaySofaId: e.target.value })} placeholder="ID SofaScore" className={inputClass} />
                </div>
              </div>
            </div>

            <label className="block text-xs text-gray-400 mb-3">Título (só se NÃO for jogo A × B)
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Mesa redonda" className={`${inputClass} mt-1`} />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="block text-xs text-gray-400 sm:col-span-2">Competição
                <input value={form.competition} onChange={(e) => setForm({ ...form, competition: e.target.value })} placeholder="Ex.: Brasileirão Série A" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs text-gray-400">Esporte
                <input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block text-xs text-gray-400">País
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Brazil" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs text-gray-400">Código do país (ISO-2)
                <input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} placeholder="BR" maxLength={2} className={`${inputClass} mt-1`} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block text-xs text-gray-400">Início (horário de Brasília)
                <input type="datetime-local" value={form.startTime} onChange={(e) => onStartChange(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-xs text-gray-400">Término (sugerido: +{DURATION_MIN} min)
                <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
            </div>

            <label className="block text-xs text-gray-400 mb-1">Imagem de fundo da página (opcional)
              <input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="https://.../arte-do-jogo.jpg" className={`${inputClass} mt-1`} />
            </label>
            {form.coverUrl.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverUrl.trim()} alt="" referrerPolicy="no-referrer" className="mb-4 h-24 w-full object-cover rounded-lg ring-1 ring-white/10" />
            )}

            {/* Emissoras: um jogo costuma ter várias rádios narrando ao mesmo tempo. */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Rádios que transmitem o jogo</span>
                <button onClick={addStation} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] text-white transition">
                  <Plus size={12} /> Adicionar rádio
                </button>
              </div>

              <div className="space-y-2">
                {form.stations.map((st, idx) => {
                  const url = st.streamUrl.trim();
                  const pr = probes[idx];
                  return (
                    <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="grid place-items-center h-6 w-6 rounded-md bg-orange-500/15 text-orange-300 text-[11px] font-semibold shrink-0">{idx + 1}</span>
                        <input
                          value={st.name}
                          onChange={(e) => setStation(idx, { name: e.target.value })}
                          placeholder="Nome da rádio (ex.: Rádio Globo RJ)"
                          className={inputClass}
                        />
                        <input
                          value={st.city}
                          onChange={(e) => setStation(idx, { city: e.target.value })}
                          placeholder="Praça"
                          className={`${inputClass} max-w-[7.5rem]`}
                        />
                        {form.stations.length > 1 && (
                          <button onClick={() => removeStation(idx)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition shrink-0" title="Remover rádio">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          value={st.streamUrl}
                          onChange={(e) => setStation(idx, { streamUrl: e.target.value })}
                          placeholder="https://.../stream"
                          className={inputClass}
                        />
                        <button
                          onClick={() => runProbe(idx)}
                          disabled={!url || probingIdx === idx}
                          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] text-white transition disabled:opacity-40"
                        >
                          {probingIdx === idx ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
                          Verificar
                        </button>
                      </div>

                      {url && (
                        <>
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <audio src={url} controls className="w-full h-8 mt-2" />
                          {pr && (
                            <div className={`mt-2 text-[11px] rounded-md px-2 py-1.5 ${pr.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
                              {pr.ok ? (
                                <>
                                  <span className="font-semibold">No ar</span>
                                  {probeSpecs(pr).map((x) => <span key={x}> · {x}</span>)}
                                  {pr.nowPlaying && <div className="text-emerald-300/70 truncate mt-0.5">Tocando: {pr.nowPlaying}</div>}
                                </>
                              ) : (
                                <><span className="font-semibold">Falhou</span> · {pr.error || 'Sem resposta.'}</>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-900 font-semibold text-sm transition disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
