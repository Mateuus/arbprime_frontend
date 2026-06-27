import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft, RefreshCcw, Loader2, X, Save, Plus, Ban, Gift,
  Mail, Phone, Fingerprint, Crown, ShieldCheck, ShieldOff, BadgeCheck,
  Receipt, History, CalendarClock, Clock,
} from 'lucide-react';
import { apiGateway, AdminUserDetailDTO, PlanDTO, UserPlanDTO } from '@/gateways/api.gateway';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const brlCents = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const daysUntil = (d: string | null): number | null => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null);

// Assinatura vigente (status ativo e ainda não expirada) dentro do histórico.
const findActiveSub = (history: UserPlanDTO[]): UserPlanDTO | null =>
  history.find((h) => h.status === 'active' && !!h.expirationDate && new Date(h.expirationDate).getTime() > Date.now()) || null;

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

// Estilo dos status de assinatura.
const SUB_STATUS: Record<string, { tone: string; label: string }> = {
  active: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'ativa' },
  pending: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'pendente' },
  expired: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'expirada' },
  cancelled: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'cancelada' },
};

// Estilo dos status de transação de pagamento.
const TX_STATUS: Record<string, { tone: string; label: string }> = {
  completed: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'pago' },
  pending: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'pendente' },
  in_review: { tone: 'bg-sky-500/15 text-sky-300 ring-sky-500/30', label: 'em análise' },
  cancelled: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'cancelado' },
  rejected: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'rejeitado' },
  failed: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'falhou' },
  refunded: { tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30', label: 'estornado' },
};

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }> = ({ title, icon, children, right }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
      <span className="text-sm font-semibold text-gray-200 inline-flex items-center gap-2">{icon} {title}</span>
      {right}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 py-2">
    <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-400 shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm text-white truncate">{value || '—'}</div>
    </div>
  </div>
);

const AdminUserDetailPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';

  const [detail, setDetail] = useState<AdminUserDetailDTO | null>(null);
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form de gerenciamento.
  const [role, setRole] = useState('user');
  const [level, setLevel] = useState('0');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await apiGateway.getAdminUser(id);
      if (res.data?.result === 1) {
        const d: AdminUserDetailDTO = res.data.data;
        setDetail(d);
        setRole(d.user.role);
        setLevel(String(d.user.level));
      } else {
        setNotFound(true);
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNotFound(true);
      else setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar usuário.') });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    apiGateway.getAllPlans().then((res) => {
      if (res.data?.result === 1) setPlans(res.data.data || []);
    }).catch(() => { /* ignore */ });
  }, []);

  // Assinatura vigente derivada do histórico.
  const current: UserPlanDTO | null = detail ? findActiveSub(detail.history) : null;

  const saveUser = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await apiGateway.updateAdminUser(detail.user.id, { role, level: Number(level) || 0 });
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Usuário atualizado.' });
      if (res.data?.result === 1) await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar usuário.') });
    } finally {
      setBusy(false);
    }
  };

  const doGrant = async () => {
    if (!detail || !grantPlanId) { setMsg({ type: 'err', text: 'Selecione um plano para conceder.' }); return; }
    setBusy(true);
    try {
      const res = await apiGateway.grantUserPlan(detail.user.id, grantPlanId);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Plano concedido.' });
      if (res.data?.result === 1) { setGrantPlanId(''); await load(); }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao conceder plano.') });
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!detail) return;
    if (!window.confirm(`Revogar o acesso de ${detail.user.fullname}? As assinaturas ativas serão canceladas.`)) return;
    setBusy(true);
    try {
      const res = await apiGateway.revokeUserPlan(detail.user.id);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Acesso revogado.' });
      if (res.data?.result === 1) await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao revogar acesso.') });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="w-full px-3 sm:px-6 py-6"><div className="px-4 py-24 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div></div>;
  }

  if (notFound || !detail) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <button onClick={() => router.push('/admin/users')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-300 mb-6"><ArrowLeft size={16} /> Voltar</button>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400">Usuário não encontrado.</div>
      </div>
    );
  }

  const u = detail.user;
  const currentDays = daysUntil(current?.expirationDate ?? null);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button onClick={() => router.push('/admin/users')} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-300"><ArrowLeft size={16} /> Voltar aos usuários</button>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} />
        </button>
      </div>

      {/* Cabeçalho do usuário */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5 mb-5 flex flex-wrap items-center gap-4">
        <div className="grid place-items-center h-16 w-16 rounded-2xl bg-teal-500/15 ring-1 ring-teal-500/30 text-teal-200 text-2xl font-bold shrink-0">
          {(u.fullname || u.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white truncate">{u.fullname || '—'}</h1>
            {u.role === 'admin'
              ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-amber-500/15 text-amber-300 ring-amber-500/30"><Crown size={11} /> admin</span>
              : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-white/5 text-gray-400 ring-white/10">user</span>}
            <span className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-[10px] text-gray-400">nível {u.level}</span>
          </div>
          <div className="text-sm text-gray-400 truncate">{u.email}</div>
        </div>
        {/* Resumo da assinatura vigente */}
        <div className="shrink-0">
          {current ? (
            <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 px-4 py-2.5 text-right">
              <div className="text-sm font-semibold text-emerald-200 inline-flex items-center gap-1.5"><BadgeCheck size={15} /> {current.plan?.name || 'Ativo'}{current.isTrial ? ' · teste' : ''}</div>
              <div className="text-[11px] text-emerald-100/70 inline-flex items-center gap-1 justify-end mt-0.5"><Clock size={11} /> expira {formatDate(current.expirationDate)}{currentDays !== null && currentDays > 0 ? ` · ${currentDays}d` : ''}</div>
            </div>
          ) : (
            <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-2.5 text-sm text-gray-400 inline-flex items-center gap-1.5"><ShieldOff size={15} /> Sem acesso ativo</div>
          )}
        </div>
      </div>

      {msg && (
        <div className={`mb-5 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna esquerda: dados + gerenciamento */}
        <div className="space-y-5 lg:col-span-1">
          <Card title="Dados pessoais" icon={<Fingerprint size={15} className="text-teal-300" />}>
            <div className="divide-y divide-white/5">
              <InfoRow icon={<Mail size={15} />} label="E-mail" value={u.email} />
              <InfoRow icon={<Phone size={15} />} label="Telefone" value={u.phone} />
              <InfoRow icon={<Fingerprint size={15} />} label="CPF" value={u.cpf} />
              <InfoRow icon={<Gift size={15} />} label="Teste grátis usado em" value={u.trialUsedAt ? dateTime(u.trialUsedAt) : 'Nunca'} />
            </div>
            <div className="mt-2 text-[11px] text-gray-600 break-all">ID: {u.id}</div>
          </Card>

          <Card title="Gerenciar acesso" icon={<ShieldCheck size={15} className="text-teal-300" />}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-400">
                Papel
                <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label className="block text-xs text-gray-400">
                Nível
                <input type="number" min="0" value={level} onChange={(e) => setLevel(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">O nível é recalculado conforme a assinatura ativa; ajuste manual é sobrescrito no próximo login/expiração.</p>
            <div className="flex justify-end mt-3">
              <button onClick={saveUser} disabled={busy} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </button>
            </div>

            <hr className="my-4 border-white/10" />

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

            <div className="flex justify-end mt-4">
              <button onClick={doRevoke} disabled={busy} className="text-sm px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 ring-1 ring-rose-500/30 disabled:opacity-50 text-rose-200 font-semibold inline-flex items-center gap-1.5">
                <Ban size={15} /> Revogar acesso
              </button>
            </div>
          </Card>
        </div>

        {/* Coluna direita: histórico + pagamentos */}
        <div className="space-y-5 lg:col-span-2">
          <Card title="Histórico de assinaturas" icon={<History size={15} className="text-teal-300" />} right={<span className="text-xs text-gray-500">{detail.history.length}</span>}>
            {detail.history.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">Nenhuma assinatura registrada.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {detail.history.map((h) => {
                  const st = SUB_STATUS[h.status] || SUB_STATUS.expired;
                  return (
                    <div key={h.id} className="flex items-center gap-3 py-2.5">
                      <CalendarClock size={16} className="text-gray-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{h.plan?.name || 'Plano'}{h.isTrial ? ' · teste' : ''}</div>
                        <div className="text-[11px] text-gray-500">{formatDate(h.startDate)} → {formatDate(h.expirationDate)}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Pagamentos" icon={<Receipt size={15} className="text-teal-300" />} right={<span className="text-xs text-gray-500">{detail.transactions.length}</span>}>
            {detail.transactions.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">Nenhuma transação registrada.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {detail.transactions.map((tx) => {
                  const st = TX_STATUS[tx.status] || TX_STATUS.pending;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{tx.plan?.name || 'Pagamento'}</div>
                        <div className="text-[11px] text-gray-500 truncate">{dateTime(tx.paidAt || tx.createdAt)} · <span className="font-mono">{tx.txid}</span></div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span>
                      <span className="shrink-0 w-24 text-right text-sm font-semibold text-white">{brlCents(tx.amountCents)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetailPage;
