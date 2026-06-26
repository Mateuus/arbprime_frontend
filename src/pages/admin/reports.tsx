import { useState, useEffect, useCallback } from 'react';
import { apiGateway, ReportDTO, ReportReason, ExclusionDTO } from '@/gateways/api.gateway';
import {
  Flag, RefreshCcw, Loader2, X, Check, Ban, Eye, Trash2, ShieldOff, Store, CalendarX,
  Users, SearchX, Tag, TrendingUp, Lock, MessageSquare, Clock
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const REASON_META: Record<ReportReason, { label: string; icon: React.ReactNode; tone: string }> = {
  different_teams: { label: 'Times diferentes', icon: <Users size={13} />, tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  event_not_found: { label: 'Evento não encontrado', icon: <SearchX size={13} />, tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30' },
  wrong_markets: { label: 'Mercados errados', icon: <Tag size={13} />, tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30' },
  different_odds: { label: 'Chances diferentes', icon: <TrendingUp size={13} />, tone: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  closed_market: { label: 'Mercado fechado', icon: <Lock size={13} />, tone: 'bg-orange-500/15 text-orange-300 ring-orange-500/30' },
  other: { label: 'Outro', icon: <MessageSquare size={13} />, tone: 'bg-white/5 text-gray-300 ring-white/10' },
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  open: { label: 'aberto', tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  reviewing: { label: 'em análise', tone: 'bg-sky-500/15 text-sky-300 ring-sky-500/30' },
  resolved: { label: 'resolvido', tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  dismissed: { label: 'descartado', tone: 'bg-white/5 text-gray-400 ring-white/10' },
};

const STATUS_FILTERS = [
  { key: 'open', label: 'Abertos' },
  { key: 'reviewing', label: 'Em análise' },
  { key: 'resolved', label: 'Resolvidos' },
  { key: 'dismissed', label: 'Descartados' },
  { key: '', label: 'Todos' },
];

const AdminReportsPage = () => {
  const [reports, setReports] = useState<ReportDTO[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [exclusions, setExclusions] = useState<ExclusionDTO[]>([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [tab, setTab] = useState<'reports' | 'exclusions'>('reports');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, eRes] = await Promise.all([
        apiGateway.getReports({ status: status || undefined, limit: 50 }),
        apiGateway.getExclusions(),
      ]);
      if (rRes.data?.result === 1) { setReports(rRes.data.data.reports || []); setCounts(rRes.data.data.counts || {}); }
      if (eRes.data?.result === 1) setExclusions(eRes.data.data || []);
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar.') });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setReportStatus = async (r: ReportDTO, newStatus: string) => {
    setBusyId(r.id);
    try {
      const res = await apiGateway.updateReport(r.id, { status: newStatus });
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Atualizado.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao atualizar.') });
    } finally {
      setBusyId(null);
    }
  };

  // Excluir a CASA específica do evento (do cálculo de surebets).
  const excludeHouse = async (r: ReportDTO) => {
    if (!r.bookmaker || !r.houseEventId) { setMsg({ type: 'err', text: 'Esta reclamação não tem casa/evento da casa.' }); return; }
    if (!window.confirm(`Remover ${r.bookmaker} (${r.home} x ${r.away}) do cálculo de surebets?`)) return;
    setBusyId(r.id);
    try {
      await apiGateway.createExclusion({ scope: 'house', bookmaker: r.bookmaker, houseEventId: r.houseEventId, label: `${r.home} x ${r.away}`, reason: `report:${r.reason}`, eventStartAt: r.eventStartAt });
      await apiGateway.updateReport(r.id, { status: 'resolved' });
      setMsg({ type: 'ok', text: `${r.bookmaker} removida do evento.` });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao excluir casa.') });
    } finally {
      setBusyId(null);
    }
  };

  // Remover o EVENTO inteiro (todas as casas) do cálculo.
  const removeEvent = async (r: ReportDTO) => {
    if (!window.confirm(`Remover o evento inteiro "${r.home} x ${r.away}" do cálculo de surebets?`)) return;
    setBusyId(r.id);
    try {
      await apiGateway.createExclusion({ scope: 'event', groupId: r.eventId, label: `${r.home} x ${r.away}`, reason: `report:${r.reason}`, eventStartAt: r.eventStartAt });
      await apiGateway.updateReport(r.id, { status: 'resolved' });
      setMsg({ type: 'ok', text: 'Evento removido do cálculo.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover evento.') });
    } finally {
      setBusyId(null);
    }
  };

  const removeExclusion = async (ex: ExclusionDTO) => {
    if (!window.confirm('Reativar este evento/casa no cálculo?')) return;
    try {
      await apiGateway.deleteExclusion(ex.id);
      setMsg({ type: 'ok', text: 'Exclusão removida.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover exclusão.') });
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Flag className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Reclamações</h1>
            <p className="text-sm text-gray-400">Reports dos usuários e exclusões de eventos do cálculo</p>
          </div>
        </div>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex gap-1.5">
        <button onClick={() => setTab('reports')} className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${tab === 'reports' ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}>
          Reclamações {counts.open ? <span className="ml-1 text-[11px] bg-amber-500/20 text-amber-300 rounded-full px-1.5">{counts.open}</span> : null}
        </button>
        <button onClick={() => setTab('exclusions')} className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${tab === 'exclusions' ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}>
          Exclusões {exclusions.length ? <span className="ml-1 text-[11px] bg-white/10 text-gray-300 rounded-full px-1.5">{exclusions.length}</span> : null}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {tab === 'reports' ? (
        <>
          {/* Filtro de status */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setStatus(f.key)} className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${status === f.key ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}>
                {f.label}{f.key && counts[f.key] ? ` (${counts[f.key]})` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center">
              <Flag className="mx-auto text-gray-600 mb-3" size={32} />
              <p className="text-gray-400">Nenhuma reclamação aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => {
                const rm = REASON_META[r.reason];
                const sm = STATUS_META[r.status] || STATUS_META.open;
                const busy = busyId === r.id;
                return (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${rm.tone}`}>{rm.icon} {rm.label}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${sm.tone}`}>{sm.label}</span>
                      <span className="text-[11px] text-gray-500 inline-flex items-center gap-1"><Clock size={11} /> {dateTime(r.createdAt)}</span>
                      {r.scope === 'leg' && r.bookmaker && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[11px] text-gray-300"><Store size={11} /> {r.bookmaker}</span>
                      )}
                    </div>

                    <div className="text-sm text-white font-semibold">{r.home || '?'} <span className="text-gray-500 font-normal">x</span> {r.away || '?'}</div>
                    <div className="text-[11px] text-gray-500">
                      {r.league || r.sport}
                      {r.market && <> · mercado <span className="text-gray-300">{r.market}</span></>}
                      {r.selection && <> · seleção <span className="text-gray-300">{r.selection}</span>{r.handicap ? ` (${r.handicap})` : ''}</>}
                      {r.price != null && <> · odd <span className="text-gray-300">{Number(r.price).toFixed(2)}</span></>}
                    </div>
                    {r.note && <div className="mt-1.5 text-sm text-gray-300 bg-black/20 rounded-lg px-3 py-2">{r.note}</div>}
                    <div className="mt-1 text-[11px] text-gray-500">
                      por {r.user?.fullname || r.user?.email || 'anônimo'}
                      <span className="ml-2 font-mono">evento {r.eventId}{r.houseEventId ? ` · casa ${r.houseEventId}` : ''}</span>
                    </div>

                    {/* Ações */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.scope === 'leg' && r.bookmaker && r.houseEventId && (
                        <button onClick={() => excludeHouse(r)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 inline-flex items-center gap-1.5">
                          <ShieldOff size={13} /> Remover {r.bookmaker} do evento
                        </button>
                      )}
                      <button onClick={() => removeEvent(r)} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/15 ring-1 ring-rose-500/30 text-rose-200 hover:bg-rose-500/25 disabled:opacity-50 inline-flex items-center gap-1.5">
                        <CalendarX size={13} /> Remover evento
                      </button>
                      {r.status !== 'reviewing' && r.status !== 'resolved' && (
                        <button onClick={() => setReportStatus(r, 'reviewing')} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1.5">
                          <Eye size={13} /> Em análise
                        </button>
                      )}
                      <button onClick={() => setReportStatus(r, 'resolved')} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 inline-flex items-center gap-1.5">
                        <Check size={13} /> Resolver
                      </button>
                      <button onClick={() => setReportStatus(r, 'dismissed')} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg text-gray-400 hover:bg-white/5 disabled:opacity-50 inline-flex items-center gap-1.5">
                        <Ban size={13} /> Descartar
                      </button>
                      {busy && <Loader2 size={15} className="animate-spin text-gray-400 self-center" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Exclusões ativas */
        loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : exclusions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center">
            <ShieldOff className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">Nenhuma exclusão ativa. Eventos/casas excluídos aparecem aqui.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
            {exclusions.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ${
                  ex.scope === 'event' ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30'
                  : ex.scope === 'market' ? 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
                  : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'}`}>
                  {ex.scope === 'event' ? <CalendarX size={12} /> : ex.scope === 'market' ? <Tag size={12} /> : <Store size={12} />} {ex.scope === 'event' ? 'evento' : ex.scope === 'market' ? 'mercado' : 'casa'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{ex.label || (
                    ex.scope === 'event' ? `grupo ${ex.groupId}`
                    : ex.scope === 'market' ? `${ex.bookmaker} · ${ex.market}`
                    : `${ex.bookmaker}`)}</div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">
                    {ex.scope === 'event' ? `groupId ${ex.groupId}`
                     : ex.scope === 'market' ? `${ex.bookmaker} · ${ex.houseEventId} · ${ex.market}`
                     : `${ex.bookmaker} · ${ex.houseEventId}`}{ex.reason ? ` · ${ex.reason}` : ''}
                  </div>
                </div>
                <button onClick={() => removeExclusion(ex)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10 inline-flex items-center gap-1.5" title="Reativar no cálculo">
                  <Trash2 size={13} /> Reativar
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default AdminReportsPage;
