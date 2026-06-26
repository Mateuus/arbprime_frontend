import { useState, useEffect, useCallback } from 'react';
import { apiGateway, AdminUserDTO, PlanDTO } from '@/gateways/api.gateway';
import {
  Users, RefreshCcw, Search, Loader2, X, Pencil, ShieldCheck, ShieldOff, Gift,
  ChevronLeft, ChevronRight, Crown, BadgeCheck, Ban, Save, Plus
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const RoleBadge = ({ role }: { role: string }) =>
  role === 'admin'
    ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-amber-500/15 text-amber-300 ring-amber-500/30"><Crown size={11} /> admin</span>
    : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-white/5 text-gray-400 ring-white/10">user</span>;

const AdminUsersPage = () => {
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Modal de edição/ações
  const [edit, setEdit] = useState<AdminUserDTO | null>(null);
  const [role, setRole] = useState('user');
  const [level, setLevel] = useState('0');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAdminUsers({ search: debounced || undefined, page, limit: 25 });
      if (res.data?.result === 1) {
        setUsers(res.data.data.users || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotal(res.data.data.pagination?.total || 0);
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar usuários.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar usuários.') });
    } finally {
      setLoading(false);
    }
  }, [debounced, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Carrega planos (para o seletor de concessão) uma vez.
  useEffect(() => {
    apiGateway.getAllPlans().then((res) => {
      if (res.data?.result === 1) setPlans(res.data.data || []);
    }).catch(() => { /* ignore */ });
  }, []);

  // Debounce da busca.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openEdit = (u: AdminUserDTO) => {
    setEdit(u);
    setRole(u.role);
    setLevel(String(u.level));
    setGrantPlanId('');
  };

  const saveUser = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const res = await apiGateway.updateAdminUser(edit.id, { role, level: Number(level) || 0 });
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Usuário atualizado.' });
      if (res.data?.result === 1) { setEdit(null); await load(); }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar usuário.') });
    } finally {
      setBusy(false);
    }
  };

  const doGrant = async () => {
    if (!edit || !grantPlanId) { setMsg({ type: 'err', text: 'Selecione um plano para conceder.' }); return; }
    setBusy(true);
    try {
      const res = await apiGateway.grantUserPlan(edit.id, grantPlanId);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Plano concedido.' });
      if (res.data?.result === 1) { setEdit(null); await load(); }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao conceder plano.') });
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!edit) return;
    if (!window.confirm(`Revogar o acesso de ${edit.fullname}? As assinaturas ativas serão canceladas.`)) return;
    setBusy(true);
    try {
      const res = await apiGateway.revokeUserPlan(edit.id);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Acesso revogado.' });
      if (res.data?.result === 1) { setEdit(null); await load(); }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao revogar acesso.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Users className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Usuários</h1>
            <p className="text-sm text-gray-400">Gerencie acessos, papéis e assinaturas — {total} usuários</p>
          </div>
        </div>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, CPF ou telefone..." className={`${inputClass} pl-9`} />
        </div>
      </div>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : users.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">Nenhum usuário encontrado.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {users.map((u) => {
              const sub = u.activeSubscription;
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid place-items-center h-9 w-9 rounded-full bg-white/5 ring-1 ring-white/10 text-gray-400 text-sm font-semibold shrink-0">
                    {(u.fullname || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">{u.fullname || '—'}</span>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">{u.email}</div>
                  </div>

                  {/* Assinatura */}
                  <div className="hidden sm:block text-right shrink-0 w-44">
                    {sub ? (
                      <>
                        <div className="text-xs text-emerald-300 inline-flex items-center gap-1 justify-end"><BadgeCheck size={13} /> {sub.plan?.name || 'Ativo'}{sub.isTrial ? ' (teste)' : ''}</div>
                        <div className="text-[11px] text-gray-500">expira {formatDate(sub.expirationDate)}</div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1 justify-end"><ShieldOff size={13} /> sem acesso</span>
                    )}
                  </div>

                  <span className="hidden md:inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-gray-400 shrink-0">nível {u.level}</span>

                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition shrink-0" title="Gerenciar">
                    <Pencil size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-400">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Modal gerenciar usuário */}
      {edit && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEdit(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1">{edit.fullname}</h2>
            <p className="text-xs text-gray-400 mb-5">{edit.email} · CPF {edit.cpf}</p>

            {/* Papel + nível */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-400">
                Papel
                <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label className="block text-xs text-gray-400">
                Nível de acesso
                <input type="number" min="0" value={level} onChange={(e) => setLevel(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">O nível é recalculado automaticamente conforme a assinatura ativa. Ajuste manual é sobrescrito no próximo login/expiração.</p>

            <div className="flex justify-end mt-3">
              <button onClick={saveUser} disabled={busy} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar papel/nível
              </button>
            </div>

            <hr className="my-5 border-white/10" />

            {/* Assinatura atual */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 mb-2"><ShieldCheck size={14} /> Assinatura</span>
              {edit.activeSubscription ? (
                <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2 text-sm text-emerald-200 flex items-center justify-between">
                  <span>{edit.activeSubscription.plan?.name || 'Ativa'}{edit.activeSubscription.isTrial ? ' (teste)' : ''}</span>
                  <span className="text-[11px] text-emerald-100/70">expira {formatDate(edit.activeSubscription.expirationDate)}</span>
                </div>
              ) : (
                <div className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-gray-400">Sem assinatura ativa.</div>
              )}
            </div>

            {/* Conceder plano */}
            <label className="block text-xs text-gray-400">
              Conceder/estender plano
              <div className="flex gap-2 mt-1">
                <select value={grantPlanId} onChange={(e) => setGrantPlanId(e.target.value)} className={inputClass}>
                  <option value="">Selecione um plano…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.durationInDays}d{p.isTrial ? ' (teste)' : ''}</option>
                  ))}
                </select>
                <button onClick={doGrant} disabled={busy || !grantPlanId} className="shrink-0 text-sm px-3 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                  <Plus size={15} /> Conceder
                </button>
              </div>
            </label>
            <p className="mt-1.5 text-[11px] text-gray-500 inline-flex items-center gap-1"><Gift size={12} /> Conceder um plano de teste ignora o limite de 1 teste por conta.</p>

            {/* Revogar */}
            <div className="flex justify-end mt-5">
              <button onClick={doRevoke} disabled={busy} className="text-sm px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 ring-1 ring-rose-500/30 disabled:opacity-50 text-rose-200 font-semibold inline-flex items-center gap-1.5">
                <Ban size={15} /> Revogar acesso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
