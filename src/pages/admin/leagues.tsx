import { useState, useEffect, useCallback } from 'react';
import {
  apiGateway, LeagueDTO, LeagueDetailDTO, LeagueAliasDTO, UpsertLeagueDTO, TeamsPaginationDTO, LeagueCountryDTO
} from '@/gateways/api.gateway';
import {
  Trophy, Plus, RefreshCcw, Pencil, Trash2, X, Search, ChevronDown, ChevronRight, ChevronLeft,
  GitMerge, Check, Tag, ShieldCheck, Clock, Globe
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

const NO_COUNTRY = '__none__';

interface LeagueForm {
  canonicalName: string;
  sport: string;
  country: string;
  countryKey: string;
  status: string;
}
const emptyForm: LeagueForm = { canonicalName: '', sport: 'futebol', country: '', countryKey: '', status: 'confirmed' };

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const StatusBadge = ({ status }: { status: string }) =>
  status === 'confirmed' ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"><ShieldCheck size={11} /> confirmado</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"><Clock size={11} /> revisar</span>
  );

const AdminLeaguesPage = () => {
  const [leagues, setLeagues] = useState<LeagueDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState(''); // '' todos | countryKey | __none__
  const [countries, setCountries] = useState<LeagueCountryDTO[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<TeamsPaginationDTO | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeagueDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueDTO | null>(null);
  const [form, setForm] = useState<LeagueForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [aliasInput, setAliasInput] = useState('');
  const [aliasBook, setAliasBook] = useState('');
  const [aliasBusy, setAliasBusy] = useState(false);
  const [editAlias, setEditAlias] = useState<{ id: string; alias: string; bookmaker: string } | null>(null);

  const [mergeSource, setMergeSource] = useState<LeagueDTO | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<LeagueDTO[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async (opts?: { page?: number; q?: string; ck?: string }) => {
    let p = opts?.page ?? page;
    const q = (opts?.q ?? query).trim();
    const ck = opts?.ck ?? countryFilter;
    setLoading(true);
    try {
      let res = await apiGateway.getLeagues({ search: q || undefined, countryKey: ck || undefined, page: p, limit: 20 });
      let d = res.data?.result === 1 ? res.data.data : null;
      if (d?.pagination && d.pagination.total > 0 && d.pagination.page > d.pagination.totalPages) {
        p = d.pagination.totalPages;
        res = await apiGateway.getLeagues({ search: q || undefined, countryKey: ck || undefined, page: p, limit: 20 });
        d = res.data?.result === 1 ? res.data.data : null;
      }
      if (res.data?.result === 1 && d) {
        setLeagues(d.leagues || []);
        setPagination(d.pagination || null);
        if (d.pagination) setPage(d.pagination.page);
      } else {
        setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar ligas.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar ligas.') });
    } finally {
      setLoading(false);
    }
  }, [page, query, countryFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    apiGateway.getLeagueCountries()
      .then((r) => { if (r.data?.result === 1) setCountries(r.data.data || []); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiGateway.getLeague(id);
      if (res.data?.result === 1) setDetail(res.data.data);
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar aliases.') });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleExpand = (l: LeagueDTO) => {
    setEditAlias(null); setAliasInput(''); setAliasBook('');
    if (expandedId === l.id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(l.id); setDetail(null); loadDetail(l.id);
  };

  const refreshAfterMutation = async () => {
    if (expandedId) await loadDetail(expandedId);
    await load();
    apiGateway.getLeagueCountries().then((r) => { if (r.data?.result === 1) setCountries(r.data.data || []); }).catch(() => {});
  };

  const goToPage = (p: number) => {
    if (loading || p < 1 || (pagination && p > pagination.totalPages)) return;
    setExpandedId(null); setDetail(null);
    load({ page: p });
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (l: LeagueDTO) => {
    setEditing(l);
    setForm({ canonicalName: l.canonicalName, sport: l.sport || 'futebol', country: l.country || '', countryKey: l.countryKey || '', status: l.status || 'confirmed' });
    setModalOpen(true);
  };

  const handleSaveLeague = async () => {
    if (!form.canonicalName.trim()) { setMsg({ type: 'err', text: 'O nome da liga é obrigatório.' }); return; }
    setSaving(true);
    try {
      const payload: UpsertLeagueDTO = {
        canonicalName: form.canonicalName.trim(),
        sport: form.sport.trim() || 'futebol',
        country: form.country.trim() || null,
        countryKey: form.countryKey.trim() || null,
        status: form.status
      };
      if (editing) { await apiGateway.updateLeague(editing.id, payload); setMsg({ type: 'ok', text: 'Liga atualizada.' }); }
      else { await apiGateway.createLeague(payload); setMsg({ type: 'ok', text: 'Liga criada.' }); }
      setModalOpen(false);
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar liga.') });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLeague = async (l: LeagueDTO) => {
    try {
      await apiGateway.updateLeague(l.id, { status: 'confirmed' });
      setMsg({ type: 'ok', text: 'Liga confirmada.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao confirmar liga.') });
    }
  };

  const handleAddAlias = async () => {
    if (!expandedId || !aliasInput.trim()) return;
    setAliasBusy(true);
    try {
      await apiGateway.addLeagueAlias(expandedId, { alias: aliasInput.trim(), bookmaker: aliasBook.trim() || undefined });
      setAliasInput(''); setAliasBook('');
      setMsg({ type: 'ok', text: 'Alias adicionado.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao adicionar alias.') });
    } finally {
      setAliasBusy(false);
    }
  };

  const handleSaveAlias = async () => {
    if (!expandedId || !editAlias || !editAlias.alias.trim()) return;
    setAliasBusy(true);
    try {
      await apiGateway.updateLeagueAlias(expandedId, editAlias.id, { alias: editAlias.alias.trim(), bookmaker: editAlias.bookmaker.trim() });
      setEditAlias(null);
      setMsg({ type: 'ok', text: 'Alias atualizado.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao atualizar alias.') });
    } finally {
      setAliasBusy(false);
    }
  };

  const handleConfirmAlias = async (a: LeagueAliasDTO) => {
    if (!expandedId) return;
    try {
      await apiGateway.updateLeagueAlias(expandedId, a.id, { status: 'confirmed' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao confirmar alias.') });
    }
  };

  const handleDeleteAlias = async (a: LeagueAliasDTO) => {
    if (!expandedId) return;
    if (!window.confirm(`Remover o alias "${a.alias}"?`)) return;
    try {
      await apiGateway.deleteLeagueAlias(expandedId, a.id);
      setMsg({ type: 'ok', text: 'Alias removido.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover alias.') });
    }
  };

  const openMerge = async (l: LeagueDTO) => {
    setMergeSource(l); setMergeTargetId(''); setMergeCandidates([]); setMergeLoading(true);
    try {
      const all: LeagueDTO[] = [];
      for (let p = 1; p <= 50; p++) {
        const res = await apiGateway.getLeagues({ sport: l.sport, page: p, limit: 100 });
        if (res.data?.result !== 1) break;
        const d = res.data.data;
        all.push(...(d?.leagues || []));
        if (!d?.pagination?.hasNext) break;
      }
      setMergeCandidates(all.filter((x) => x.id !== l.id));
    } catch {
      /* silencioso */
    } finally {
      setMergeLoading(false);
    }
  };
  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    try {
      await apiGateway.mergeLeagues(mergeSource.id, mergeTargetId);
      setMsg({ type: 'ok', text: 'Ligas fundidas.' });
      const wasSource = expandedId === mergeSource.id; // a origem foi DELETADA — não recarregar o detalhe dela
      setMergeSource(null);
      if (wasSource) { setExpandedId(null); setDetail(null); }
      else if (expandedId) await loadDetail(expandedId); // destino aberto ganhou aliases → atualiza
      await load();
      apiGateway.getLeagueCountries().then((r) => { if (r.data?.result === 1) setCountries(r.data.data || []); }).catch(() => {});
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao fundir ligas.') });
    } finally {
      setMerging(false);
    }
  };

  const countryOptions = [
    { value: '', label: 'Todos os países' },
    ...countries.map((c) => ({ value: c.countryKey || NO_COUNTRY, label: `${c.country || (c.countryKey || 'Sem país')} (${c.count})` }))
  ];

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Trophy className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Ligas &amp; Aliases</h1>
            <p className="text-sm text-gray-400">Curadoria dos campeonatos canônicos, país e apelidos por casa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition">
            <Plus size={15} /> Adicionar liga
          </button>
        </div>
      </header>

      {/* Busca + filtro de país */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4 flex flex-wrap items-center gap-3">
        <form className="relative flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setExpandedId(null); setDetail(null); load({ page: 1 }); }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar liga por nome... (Enter)" className={`${inputClass} pl-9`} />
        </form>
        <div className="flex items-center gap-2 shrink-0">
          <Globe size={15} className="text-gray-500" />
          <Select className="w-52" value={countryFilter} onChange={(v) => { setCountryFilter(v); setExpandedId(null); setDetail(null); load({ page: 1, ck: v }); }} options={countryOptions} />
        </div>
        <div className="text-xs text-gray-400">{pagination?.total ?? leagues.length} ligas</div>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-400">Carregando...</div>
        ) : leagues.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Trophy className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">Nenhuma liga encontrada.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {leagues.map((l) => {
              const open = expandedId === l.id;
              return (
                <li key={l.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition">
                    <button onClick={() => toggleExpand(l)} className="grid place-items-center h-7 w-7 shrink-0 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title={open ? 'Recolher' : 'Ver aliases'}>
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpand(l)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">{l.canonicalName}</span>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">{l.sport}</span>
                        {l.country || l.countryKey ? (
                          <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10"><Globe size={10} /> {l.country || l.countryKey}{l.countryKey ? ` [${l.countryKey}]` : ''}</span>
                        ) : (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 ring-1 ring-amber-500/30 text-amber-300">sem país</span>
                        )}
                        <span className="inline-flex items-center gap-1"><Tag size={11} /> {l.aliasCount ?? 0} alias{(l.aliasCount ?? 0) === 1 ? '' : 'es'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {l.status !== 'confirmed' && (
                        <button onClick={() => handleConfirmLeague(l)} className="p-2 rounded-lg text-amber-300 hover:text-emerald-300 hover:bg-white/10 transition" title="Confirmar (remover 'a revisar')"><Check size={15} /></button>
                      )}
                      <button onClick={() => openMerge(l)} className="p-2 rounded-lg text-gray-400 hover:text-violet-300 hover:bg-white/10 transition" title="Fundir com outra liga"><GitMerge size={15} /></button>
                      <button onClick={() => openEdit(l)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar liga"><Pencil size={15} /></button>
                    </div>
                  </div>

                  {open && (
                    <div className="px-4 pb-4 pt-1 bg-black/20 border-t border-white/5">
                      {detailLoading || !detail ? (
                        <div className="py-4 text-center text-xs text-gray-500">Carregando aliases...</div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {detail.aliases.map((a) => (
                              editAlias?.id === a.id ? (
                                <div key={a.id} className="flex items-center gap-1.5 rounded-lg bg-white/5 ring-1 ring-teal-500/40 px-2 py-1">
                                  <input autoFocus value={editAlias.alias} onChange={(e) => setEditAlias({ ...editAlias, alias: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAlias(); if (e.key === 'Escape') setEditAlias(null); }}
                                    className="bg-transparent text-sm text-white focus:outline-none w-36" placeholder="alias" />
                                  <input value={editAlias.bookmaker} onChange={(e) => setEditAlias({ ...editAlias, bookmaker: e.target.value })}
                                    className="bg-black/30 rounded px-1.5 py-0.5 text-[11px] text-gray-300 focus:outline-none w-24" placeholder="casa (opc.)" />
                                  <button onClick={handleSaveAlias} disabled={aliasBusy} className="p-1 text-emerald-300 hover:bg-white/10 rounded disabled:opacity-50" title="Salvar"><Check size={14} /></button>
                                  <button onClick={() => setEditAlias(null)} className="p-1 text-gray-400 hover:bg-white/10 rounded" title="Cancelar"><X size={14} /></button>
                                </div>
                              ) : (
                                <div key={a.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1 ${a.status === 'confirmed' ? 'bg-white/5 ring-white/10' : 'bg-amber-500/10 ring-amber-500/30'}`}>
                                  <span className="text-sm text-gray-200">{a.alias}</span>
                                  <span className="text-[10px] text-gray-500">· {a.bookmaker || 'global'}</span>
                                  {a.status !== 'confirmed' && (
                                    <button onClick={() => handleConfirmAlias(a)} className="p-0.5 text-amber-300 hover:text-emerald-300" title="Confirmar"><Check size={13} /></button>
                                  )}
                                  <button onClick={() => setEditAlias({ id: a.id, alias: a.alias, bookmaker: a.bookmaker || '' })} className="p-0.5 text-gray-500 hover:text-teal-300" title="Editar alias"><Pencil size={12} /></button>
                                  <button onClick={() => handleDeleteAlias(a)} className="p-0.5 text-gray-500 hover:text-rose-300" title="Remover alias"><Trash2 size={12} /></button>
                                </div>
                              )
                            ))}
                          </div>
                          <div className="flex items-center gap-2 max-w-xl">
                            <input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddAlias(); }}
                              placeholder="Novo alias (nome/código cru)..." className={`${inputClass} text-sm`} />
                            <input value={aliasBook} onChange={(e) => setAliasBook(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddAlias(); }}
                              placeholder="casa (opc.)" className={`${inputClass} text-sm w-32`} />
                            <button onClick={handleAddAlias} disabled={aliasBusy || !aliasInput.trim()} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/40 hover:bg-teal-500/25 disabled:opacity-50 transition shrink-0">
                              <Plus size={14} /> Adicionar
                            </button>
                          </div>
                          <p className="mt-1.5 text-[11px] text-gray-600">Casa vazia = alias global (vale p/ qualquer casa). Use a casa quando for um código específico dela (ex.: &quot;39703&quot;).</p>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">Página {pagination.page} de {pagination.totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => goToPage(pagination.page - 1)} disabled={!pagination.hasPrev || loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:hover:bg-white/5 transition">
              <ChevronLeft size={16} /> Anterior
            </button>
            <button onClick={() => goToPage(pagination.page + 1)} disabled={!pagination.hasNext || loading} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:hover:bg-white/5 transition">
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal criar/editar liga */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Editar liga' : 'Criar liga'}</h2>
            <div className="space-y-3">
              <label className="block text-xs text-gray-400">
                Nome canônico
                <input value={form.canonicalName} onChange={(e) => setForm({ ...form, canonicalName: e.target.value })} className={`${inputClass} mt-1`} placeholder="Ex.: Brasil - Série A" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  País
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={`${inputClass} mt-1`} placeholder="Brasil" />
                </label>
                <label className="text-xs text-gray-400">
                  País (key)
                  <input value={form.countryKey} onChange={(e) => setForm({ ...form, countryKey: e.target.value })} className={`${inputClass} mt-1`} placeholder="br" maxLength={8} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  Esporte
                  <input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className={`${inputClass} mt-1`} placeholder="futebol" />
                </label>
                <label className="text-xs text-gray-400">
                  Status
                  <Select className="mt-1" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'confirmed', label: 'Confirmado' }, { value: 'pending_review', label: 'A revisar' }]} />
                </label>
              </div>
              {!editing && <p className="text-[11px] text-gray-500">Será criado um alias global inicial igual ao nome canônico.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleSaveLeague} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de merge */}
      {mergeSource && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setMergeSource(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><GitMerge size={18} className="text-violet-300" /> Fundir ligas</h2>
            <p className="text-sm text-gray-400 mb-5">Os aliases de <b className="text-white">{mergeSource.canonicalName}</b> serão movidos para a liga de destino (e os eventos reapontados), e <b className="text-white">{mergeSource.canonicalName}</b> será removida.</p>
            {mergeLoading ? (
              <div className="text-sm text-gray-400 px-1 py-2">Carregando ligas...</div>
            ) : mergeCandidates.length === 0 ? (
              <div className="text-sm text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-lg px-3 py-2">Nenhuma outra liga do mesmo esporte ({mergeSource.sport}) para fundir.</div>
            ) : (
              <label className="block text-xs text-gray-400">
                Manter (destino)
                <Select className="mt-1" value={mergeTargetId} onChange={setMergeTargetId}
                  options={[{ value: '', label: 'Selecione a liga de destino...' }, ...mergeCandidates.map((l) => ({ value: l.id, label: `${l.canonicalName}${l.countryKey ? ` [${l.countryKey}]` : ''} (${l.aliasCount ?? 0} aliases)` }))]} />
              </label>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setMergeSource(null)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleMerge} disabled={merging || !mergeTargetId} className="text-sm px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold">{merging ? 'Fundindo...' : 'Fundir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLeaguesPage;
