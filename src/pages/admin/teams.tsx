import { useState, useEffect, useCallback } from 'react';
import {
  apiGateway, TeamDTO, TeamDetailDTO, TeamAliasDTO, UpsertTeamDTO, TeamsPaginationDTO
} from '@/gateways/api.gateway';
import {
  Users2, Plus, RefreshCcw, Pencil, Trash2, X, Search, ChevronDown, ChevronRight, ChevronLeft,
  GitMerge, Check, Tag, ShieldCheck, Clock
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

// Categorias conhecidas (espelha o detectCategory do matcher). 'senior' é o padrão.
const CATEGORY_OPTIONS = [
  { value: 'senior', label: 'Senior' },
  { value: 'sub-23', label: 'Sub-23' },
  { value: 'sub-21', label: 'Sub-21' },
  { value: 'sub-20', label: 'Sub-20' },
  { value: 'sub-19', label: 'Sub-19' },
  { value: 'sub-17', label: 'Sub-17' },
  { value: 'sub-15', label: 'Sub-15' },
  { value: 'feminino', label: 'Feminino' }
];

interface TeamForm {
  canonicalName: string;
  sport: string;
  category: string;
  country: string;
  status: string;
}
const emptyForm: TeamForm = { canonicalName: '', sport: 'futebol', category: 'senior', country: '', status: 'confirmed' };

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

// Selo de status (confirmado vs pendente de revisão).
const StatusBadge = ({ status }: { status: string }) =>
  status === 'confirmed' ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"><ShieldCheck size={11} /> confirmado</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"><Clock size={11} /> revisar</span>
  );

const AdminTeamsPage = () => {
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Paginação (server-side).
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<TeamsPaginationDTO | null>(null);

  // Expansão de um time → carrega seus aliases.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal criar/editar time.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamDTO | null>(null);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Inputs de alias (adicionar / editar inline).
  const [aliasInput, setAliasInput] = useState('');
  const [aliasBusy, setAliasBusy] = useState(false);
  const [editAlias, setEditAlias] = useState<{ id: string; alias: string; bookmaker: string } | null>(null);

  // Modal de merge.
  const [mergeSource, setMergeSource] = useState<TeamDTO | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<TeamDTO[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async (opts?: { page?: number; q?: string }) => {
    let p = opts?.page ?? page;
    const q = (opts?.q ?? query).trim();
    setLoading(true);
    try {
      let res = await apiGateway.getTeams({ search: q || undefined, page: p, limit: 20 });
      let d = res.data?.result === 1 ? res.data.data : null;
      // Página fora do range (ex.: um merge esvaziou a última página) → refaz na última válida.
      if (d?.pagination && d.pagination.total > 0 && d.pagination.page > d.pagination.totalPages) {
        p = d.pagination.totalPages;
        res = await apiGateway.getTeams({ search: q || undefined, page: p, limit: 20 });
        d = res.data?.result === 1 ? res.data.data : null;
      }
      if (res.data?.result === 1 && d) {
        setTeams(d.teams || []);
        setPagination(d.pagination || null);
        if (d.pagination) setPage(d.pagination.page);
      } else {
        setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar times.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar times.') });
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiGateway.getTeam(id);
      if (res.data?.result === 1) setDetail(res.data.data);
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar aliases.') });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleExpand = (t: TeamDTO) => {
    setEditAlias(null);
    setAliasInput('');
    if (expandedId === t.id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(t.id);
    setDetail(null);
    loadDetail(t.id);
  };

  // Recarrega o time aberto + a lista (mantém aliasCount e a página atual).
  const refreshAfterMutation = async () => {
    if (expandedId) await loadDetail(expandedId);
    await load();
  };

  // Troca de página (recolhe o que estiver expandido — pode não estar na nova página).
  const goToPage = (p: number) => {
    if (loading || p < 1 || (pagination && p > pagination.totalPages)) return;
    setExpandedId(null);
    setDetail(null);
    load({ page: p });
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (t: TeamDTO) => {
    setEditing(t);
    setForm({ canonicalName: t.canonicalName, sport: t.sport || 'futebol', category: t.category || 'senior', country: t.country || '', status: t.status || 'confirmed' });
    setModalOpen(true);
  };

  const handleSaveTeam = async () => {
    if (!form.canonicalName.trim()) { setMsg({ type: 'err', text: 'O nome do time é obrigatório.' }); return; }
    setSaving(true);
    try {
      const payload: UpsertTeamDTO = {
        canonicalName: form.canonicalName.trim(),
        sport: form.sport.trim() || 'futebol',
        category: form.category,
        country: form.country.trim() || null,
        status: form.status
      };
      if (editing) {
        await apiGateway.updateTeam(editing.id, payload);
        setMsg({ type: 'ok', text: 'Time atualizado.' });
      } else {
        await apiGateway.createTeam(payload);
        setMsg({ type: 'ok', text: 'Time criado.' });
      }
      setModalOpen(false);
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar time.') });
    } finally {
      setSaving(false);
    }
  };

  // Confirma o time (tira o status "a revisar").
  const handleConfirmTeam = async (t: TeamDTO) => {
    try {
      await apiGateway.updateTeam(t.id, { status: 'confirmed' });
      setMsg({ type: 'ok', text: 'Time confirmado.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao confirmar time.') });
    }
  };

  const handleAddAlias = async () => {
    if (!expandedId || !aliasInput.trim()) return;
    setAliasBusy(true);
    try {
      await apiGateway.addAlias(expandedId, { alias: aliasInput.trim() });
      setAliasInput('');
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
      await apiGateway.updateAlias(expandedId, editAlias.id, { alias: editAlias.alias.trim(), bookmaker: editAlias.bookmaker.trim() || null });
      setEditAlias(null);
      setMsg({ type: 'ok', text: 'Alias atualizado.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao atualizar alias.') });
    } finally {
      setAliasBusy(false);
    }
  };

  const handleConfirmAlias = async (a: TeamAliasDTO) => {
    if (!expandedId) return;
    try {
      await apiGateway.updateAlias(expandedId, a.id, { status: 'confirmed' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao confirmar alias.') });
    }
  };

  const handleDeleteAlias = async (a: TeamAliasDTO) => {
    if (!expandedId) return;
    if (!window.confirm(`Remover o alias "${a.alias}"?`)) return;
    try {
      await apiGateway.deleteAlias(expandedId, a.id);
      setMsg({ type: 'ok', text: 'Alias removido.' });
      await refreshAfterMutation();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover alias.') });
    }
  };

  // Ao abrir o merge, busca TODOS os times do mesmo esporte+categoria como
  // candidatos a destino (não dá para usar a lista paginada, que só tem a página atual).
  const openMerge = async (t: TeamDTO) => {
    setMergeSource(t);
    setMergeTargetId('');
    setMergeCandidates([]);
    setMergeLoading(true);
    try {
      // Junta TODOS os times do mesmo esporte+categoria (percorre as páginas) —
      // qualquer um pode ser destino, não só os 100 primeiros em ordem alfabética.
      const all: TeamDTO[] = [];
      for (let p = 1; p <= 50; p++) {
        const res = await apiGateway.getTeams({ sport: t.sport, category: t.category, page: p, limit: 100 });
        if (res.data?.result !== 1) break;
        const d = res.data.data;
        all.push(...(d?.teams || []));
        if (!d?.pagination?.hasNext) break;
      }
      setMergeCandidates(all.filter((x) => x.id !== t.id));
    } catch {
      /* silencioso — modal mostra "nenhum candidato" */
    } finally {
      setMergeLoading(false);
    }
  };
  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMerging(true);
    try {
      await apiGateway.mergeTeams(mergeSource.id, mergeTargetId);
      setMsg({ type: 'ok', text: 'Times fundidos.' });
      setMergeSource(null);
      if (expandedId === mergeSource.id) { setExpandedId(null); setDetail(null); }
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao fundir times.') });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Users2 className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Times &amp; Aliases</h1>
            <p className="text-sm text-gray-400">Curadoria dos times canônicos e seus apelidos por casa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition">
            <Plus size={15} /> Adicionar time
          </button>
        </div>
      </header>

      {/* Busca + resumo */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative flex-1 min-w-[200px]"
          onSubmit={(e) => { e.preventDefault(); setExpandedId(null); setDetail(null); load({ page: 1 }); }}
        >
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar time por nome... (Enter)" className={`${inputClass} pl-9`} />
        </form>
        <div className="text-xs text-gray-400">{pagination?.total ?? teams.length} times</div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-400">Carregando...</div>
        ) : teams.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Users2 className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">{query.trim() ? 'Nenhum time encontrado.' : 'Nenhum time cadastrado ainda.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {teams.map((t) => {
              const open = expandedId === t.id;
              return (
                <li key={t.id}>
                  {/* Linha do time */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition">
                    <button onClick={() => toggleExpand(t)} className="grid place-items-center h-7 w-7 shrink-0 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title={open ? 'Recolher' : 'Ver aliases'}>
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpand(t)}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-white truncate">{t.canonicalName}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">{t.sport}</span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">{t.category}</span>
                        {t.country && <span className="truncate">{t.country}</span>}
                        <span className="inline-flex items-center gap-1"><Tag size={11} /> {t.aliasCount ?? 0} alias{(t.aliasCount ?? 0) === 1 ? '' : 'es'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.status !== 'confirmed' && (
                        <button onClick={() => handleConfirmTeam(t)} className="p-2 rounded-lg text-amber-300 hover:text-emerald-300 hover:bg-white/10 transition" title="Confirmar (remover 'a revisar')"><Check size={15} /></button>
                      )}
                      <button onClick={() => openMerge(t)} className="p-2 rounded-lg text-gray-400 hover:text-violet-300 hover:bg-white/10 transition" title="Fundir com outro time"><GitMerge size={15} /></button>
                      <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar time"><Pencil size={15} /></button>
                    </div>
                  </div>

                  {/* Aliases (expandido) */}
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
                                  <input
                                    autoFocus
                                    value={editAlias.alias}
                                    onChange={(e) => setEditAlias({ ...editAlias, alias: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAlias(); if (e.key === 'Escape') setEditAlias(null); }}
                                    className="bg-transparent text-sm text-white focus:outline-none w-36"
                                    placeholder="alias"
                                  />
                                  <input
                                    value={editAlias.bookmaker}
                                    onChange={(e) => setEditAlias({ ...editAlias, bookmaker: e.target.value })}
                                    className="bg-black/30 rounded px-1.5 py-0.5 text-[11px] text-gray-300 focus:outline-none w-24"
                                    placeholder="casa (opc.)"
                                  />
                                  <button onClick={handleSaveAlias} disabled={aliasBusy} className="p-1 text-emerald-300 hover:bg-white/10 rounded disabled:opacity-50" title="Salvar"><Check size={14} /></button>
                                  <button onClick={() => setEditAlias(null)} className="p-1 text-gray-400 hover:bg-white/10 rounded" title="Cancelar"><X size={14} /></button>
                                </div>
                              ) : (
                                <div key={a.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1 ${a.status === 'confirmed' ? 'bg-white/5 ring-white/10' : 'bg-amber-500/10 ring-amber-500/30'}`}>
                                  <span className="text-sm text-gray-200">{a.alias}</span>
                                  {a.bookmaker && <span className="text-[10px] text-gray-500">· {a.bookmaker}</span>}
                                  {a.status !== 'confirmed' && (
                                    <button onClick={() => handleConfirmAlias(a)} className="p-0.5 text-amber-300 hover:text-emerald-300" title="Confirmar (revisado)"><Check size={13} /></button>
                                  )}
                                  <button onClick={() => setEditAlias({ id: a.id, alias: a.alias, bookmaker: a.bookmaker || '' })} className="p-0.5 text-gray-500 hover:text-teal-300" title="Editar alias"><Pencil size={12} /></button>
                                  <button onClick={() => handleDeleteAlias(a)} className="p-0.5 text-gray-500 hover:text-rose-300" title="Remover alias"><Trash2 size={12} /></button>
                                </div>
                              )
                            ))}
                          </div>
                          {/* Adicionar alias */}
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              value={aliasInput}
                              onChange={(e) => setAliasInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddAlias(); }}
                              placeholder="Novo alias (nome cru de uma casa)..."
                              className={`${inputClass} text-sm`}
                            />
                            <button onClick={handleAddAlias} disabled={aliasBusy || !aliasInput.trim()} className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/40 hover:bg-teal-500/25 disabled:opacity-50 transition shrink-0">
                              <Plus size={14} /> Adicionar
                            </button>
                          </div>
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

      {/* Paginação */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">Página {pagination.page} de {pagination.totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={!pagination.hasPrev || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:hover:bg-white/5 transition"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={!pagination.hasNext || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:hover:bg-white/5 transition"
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal criar/editar time */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Editar time' : 'Criar time'}</h2>

            <div className="space-y-3">
              <label className="block text-xs text-gray-400">
                Nome canônico
                <input value={form.canonicalName} onChange={(e) => setForm({ ...form, canonicalName: e.target.value })} className={`${inputClass} mt-1`} placeholder="Ex.: Irã" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  Categoria
                  <Select className="mt-1" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORY_OPTIONS} />
                </label>
                <label className="text-xs text-gray-400">
                  Esporte
                  <input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className={`${inputClass} mt-1`} placeholder="futebol" />
                </label>
              </div>
              <label className="block text-xs text-gray-400">
                País <span className="text-gray-600">(opcional, informativo)</span>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={`${inputClass} mt-1`} placeholder="Irã" />
              </label>
              <label className="block text-xs text-gray-400">
                Status
                <Select className="mt-1" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'confirmed', label: 'Confirmado' }, { value: 'pending_review', label: 'A revisar' }]} />
              </label>
              {editing && form.category !== (editing.category || 'senior') && (
                <p className="text-[11px] text-amber-300/90">Mudar a categoria também atualiza a categoria de todos os aliases deste time.</p>
              )}
              {!editing && (
                <p className="text-[11px] text-gray-500">Será criado um alias inicial igual ao nome canônico.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleSaveTeam} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de merge */}
      {mergeSource && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setMergeSource(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><GitMerge size={18} className="text-violet-300" /> Fundir times</h2>
            <p className="text-sm text-gray-400 mb-5">
              Os aliases de <b className="text-white">{mergeSource.canonicalName}</b> serão movidos para o time de destino, e <b className="text-white">{mergeSource.canonicalName}</b> será removido.
            </p>

            {mergeLoading ? (
              <div className="text-sm text-gray-400 px-1 py-2">Carregando times...</div>
            ) : mergeCandidates.length === 0 ? (
              <div className="text-sm text-amber-300 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-lg px-3 py-2">
                Nenhum outro time com o mesmo esporte ({mergeSource.sport}) e categoria ({mergeSource.category}) para fundir.
              </div>
            ) : (
              <label className="block text-xs text-gray-400">
                Manter (destino)
                <Select
                  className="mt-1"
                  value={mergeTargetId}
                  onChange={setMergeTargetId}
                  options={[
                    { value: '', label: 'Selecione o time de destino...' },
                    ...mergeCandidates.map((t) => ({ value: t.id, label: `${t.canonicalName} (${t.aliasCount ?? 0} aliases)` }))
                  ]}
                />
              </label>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setMergeSource(null)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleMerge} disabled={merging || !mergeTargetId} className="text-sm px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold">
                {merging ? 'Fundindo...' : 'Fundir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamsPage;
