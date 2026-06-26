import { useState, useEffect, useCallback, ReactNode } from 'react';
import { apiGateway, AdminDashboardDTO } from '@/gateways/api.gateway';
import {
  LayoutDashboard, Users, ShieldCheck, DollarSign, TrendingUp, Clock, RefreshCcw, Loader2, Receipt
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brlCents = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const STATUS: Record<string, { tone: string; label: string }> = {
  completed: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'pago' },
  pending: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'pendente' },
  cancelled: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'cancelado' },
  failed: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'falhou' },
  refunded: { tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30', label: 'estornado' },
};

const StatCard = ({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-teal-300">{icon}</span>
    </div>
    <div className="mt-2 text-2xl font-extrabold text-white">{value}</div>
    {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
  </div>
);

const AdminDashboardPage = () => {
  const [data, setData] = useState<AdminDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getPaymentDashboard();
      if (res.data?.result === 1) { setData(res.data.data); setErr(null); }
      else setErr(res.data?.message || 'Erro ao carregar dashboard.');
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Erro ao carregar dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <LayoutDashboard className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400">Visão geral de usuários, assinaturas e receita</p>
          </div>
        </div>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {err && <div className="mb-4 text-sm px-4 py-2.5 rounded-xl ring-1 bg-rose-500/10 ring-rose-500/30 text-rose-200">{err}</div>}

      {loading && !data ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-3" /> Carregando...</div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard icon={<Users size={18} />} label="Usuários" value={String(data.totalUsers)} />
            <StatCard icon={<ShieldCheck size={18} />} label="Assinaturas ativas" value={String(data.activeSubscriptions)} />
            <StatCard icon={<DollarSign size={18} />} label="Receita total" value={brlCents(data.revenueTotalCents)} hint={`${data.paidCount} pagamentos`} />
            <StatCard icon={<TrendingUp size={18} />} label="Receita do mês" value={brlCents(data.revenueMonthCents)} />
            <StatCard icon={<Clock size={18} />} label="Cobranças pendentes" value={String(data.pendingCount)} />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Receipt size={16} className="text-teal-300" />
              <h2 className="font-semibold text-white">Transações recentes</h2>
            </div>
            {data.recentTransactions.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400">Nenhuma transação ainda.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {data.recentTransactions.map((tx) => {
                  const st = STATUS[tx.status] || STATUS.pending;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{tx.user?.fullname || tx.user?.email || '—'}</div>
                        <div className="text-[11px] text-gray-500 truncate">{tx.plan?.name || '—'} · {dateTime(tx.createdAt)}</div>
                      </div>
                      <span className="text-sm font-semibold text-white shrink-0">{brlCents(tx.amountCents)}</span>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminDashboardPage;
