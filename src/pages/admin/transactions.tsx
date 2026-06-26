import { useState, useEffect, useCallback } from 'react';
import { apiGateway, PaymentTxDTO } from '@/gateways/api.gateway';
import { Receipt, RefreshCcw, Loader2, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brlCents = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const STATUS: Record<string, { tone: string; label: string }> = {
  completed: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'pago' },
  pending: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'pendente' },
  cancelled: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'cancelado' },
  failed: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'falhou' },
  refunded: { tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30', label: 'estornado' },
};

const FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'completed', label: 'Pagas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'failed', label: 'Falhas' },
];

const AdminTransactionsPage = () => {
  const [txs, setTxs] = useState<PaymentTxDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getPaymentTransactions({ status: status || undefined, page, limit: 25 });
      if (res.data?.result === 1) {
        setTxs(res.data.data.transactions || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotal(res.data.data.pagination?.total || 0);
        setErr(null);
      } else setErr(res.data?.message || 'Erro ao carregar transações.');
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Erro ao carregar transações.'));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const copyTxid = async (txid: string) => {
    try { await navigator.clipboard.writeText(txid); setCopied(txid); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Receipt className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Transações</h1>
            <p className="text-sm text-gray-400">Cobranças PIX geradas pelos usuários — {total} no total</p>
          </div>
        </div>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatus(f.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${status === f.key ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && <div className="mb-4 text-sm px-4 py-2.5 rounded-xl ring-1 bg-rose-500/10 ring-rose-500/30 text-rose-200">{err}</div>}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : txs.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">Nenhuma transação encontrada.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Cabeçalho (desktop) */}
            <div className="hidden md:flex items-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-500">
              <span className="flex-1">Usuário</span>
              <span className="w-40">Plano</span>
              <span className="w-44">Criada em</span>
              <span className="w-28 text-right">Valor</span>
              <span className="w-24 text-center">Status</span>
            </div>
            {txs.map((tx) => {
              const st = STATUS[tx.status] || STATUS.pending;
              return (
                <div key={tx.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{tx.user?.fullname || tx.user?.email || '—'}</div>
                    <button onClick={() => copyTxid(tx.txid)} className="text-[11px] text-gray-500 font-mono inline-flex items-center gap-1 hover:text-gray-300" title="Copiar txid">
                      {tx.txid.slice(0, 18)}… {copied === tx.txid ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
                    </button>
                  </div>
                  <span className="md:w-40 text-xs text-gray-300 truncate">{tx.plan?.name || '—'}</span>
                  <span className="md:w-44 text-xs text-gray-400">{dateTime(tx.createdAt)}</span>
                  <span className="md:w-28 md:text-right text-sm font-semibold text-white">{brlCents(tx.amountCents)}</span>
                  <span className="md:w-24 md:text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-400">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default AdminTransactionsPage;
