import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, Plus, Wallet, Pencil, Trash2, ArrowDownUp, Star, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, Gift, Users } from 'lucide-react';
import { apiGateway, BankrollDTO, TransactionDTO, TimeseriesPointDTO, AnalytixSummaryDTO, TxTypeValue } from '@/gateways/api.gateway';
import AnalytixShell from '@/components/analytix/AnalytixShell';
import KpiCard from '@/components/analytix/KpiCard';
import BankrollSelect from '@/components/analytix/BankrollSelect';
import BankrollFormModal from '@/components/analytix/BankrollFormModal';
import TransactionModal from '@/components/analytix/TransactionModal';
import EmptyState from '@/components/analytix/EmptyState';
import { useBankrolls, useAccounts } from '@/components/analytix/useAnalytix';
import { BRL, signedBRL, profitColor, fmtDateTime, unwrap } from '@/components/analytix/format';

const ChartSkeleton = () => <div style={{ height: 280 }} className="rounded-xl bg-white/5 animate-pulse" />;
const BankrollAreaChart = dynamic(() => import('@/components/analytix/BankrollAreaChart'), { ssr: false, loading: () => <ChartSkeleton /> });

const TX_LABEL: Record<TxTypeValue, string> = { deposit: 'Depósito', withdrawal: 'Saque', adjustment: 'Ajuste', bonus: 'Bônus/Promoção', partner_payout: 'Repasse a parceiro', bet_result: 'Resultado' };
const TX_ICON: Record<TxTypeValue, React.ReactNode> = {
  deposit: <ArrowDownCircle size={16} className="text-emerald-300" />,
  withdrawal: <ArrowUpCircle size={16} className="text-rose-300" />,
  adjustment: <SlidersHorizontal size={15} className="text-sky-300" />,
  bonus: <Gift size={15} className="text-amber-300" />,
  partner_payout: <Users size={15} className="text-violet-300" />,
  bet_result: <Wallet size={15} className="text-gray-300" />,
};

export default function AnalytixBanca() {
  const { bankrolls, selectedId, select, reload: reloadBankrolls } = useBankrolls();
  const { accounts } = useAccounts();

  const [summary, setSummary] = useState<AnalytixSummaryDTO | null>(null);
  const [txs, setTxs] = useState<TransactionDTO[]>([]);
  const [series, setSeries] = useState<TimeseriesPointDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [editBankroll, setEditBankroll] = useState<BankrollDTO | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [toast, setToast] = useState('');
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    const bk = selectedId || undefined;
    try {
      const [rs, rt, rtx] = await Promise.all([
        apiGateway.getAnalytixSummary({ bankrollId: bk }),
        apiGateway.getAnalytixTimeseries({ bankrollId: bk, bucket: 'day' }),
        apiGateway.getAnalytixTransactions({ bankrollId: bk }),
      ]);
      setSummary(unwrap<AnalytixSummaryDTO | null>(rs, null));
      setSeries(unwrap<TimeseriesPointDTO[]>(rt, []));
      setTxs(unwrap<TransactionDTO[]>(rtx, []));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void load(); }, [load]);

  const refreshAll = () => { void load(); void reloadBankrolls(); };

  const deleteBankroll = async (b: BankrollDTO) => {
    if (!confirm(`Excluir a banca "${b.name}"? As apostas dela também serão removidas.`)) return;
    const r = await apiGateway.deleteBankroll(b.id);
    if (r.data?.result === 1) { notify('Banca removida.'); if (selectedId === b.id) select(''); refreshAll(); }
    else notify(r.data?.message || 'Não foi possível remover.');
  };

  const setDefault = async (b: BankrollDTO) => {
    await apiGateway.updateBankroll(b.id, { isDefault: true });
    notify('Banca padrão definida.');
    refreshAll();
  };

  const deleteTx = async (id: string) => {
    await apiGateway.deleteAnalytixTransaction(id);
    notify('Transação removida.');
    refreshAll();
  };

  const deposited = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const withdrawn = txs.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);

  return (
    <AnalytixShell
      active="banca"
      title="Banca"
      subtitle="Saldo, aportes e evolução"
      actions={(
        <>
          <BankrollSelect bankrolls={bankrolls} selectedId={selectedId} onChange={select} />
          <button onClick={() => setShowTx(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 text-sm hover:bg-white/10"><ArrowDownUp size={15} /> Movimentar</button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Nova banca</button>
        </>
      )}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Banca atual" loading={loading} icon={<Wallet size={16} />} value={summary ? BRL(summary.currentBankroll) : '—'} />
        <KpiCard label="Banca inicial" loading={loading} value={summary ? BRL(summary.roiBase) : '—'} />
        <KpiCard label="Lucro acumulado" loading={loading} value={summary ? signedBRL(summary.totalProfit) : '—'} valueClass={profitColor(summary?.totalProfit)} />
        <KpiCard label="Aportes / Saques" loading={loading} value={BRL(deposited)} valueClass="text-emerald-400" delta={`${BRL(withdrawn)} sacado`} deltaClass="text-rose-400" />
      </div>

      {/* Curva */}
      <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Evolução da banca</h2>
        {loading ? <ChartSkeleton /> : series.length > 1 ? <BankrollAreaChart data={series} /> : <div className="h-[280px] grid place-items-center text-sm text-gray-500">Registre aportes e liquide apostas para ver a evolução.</div>}
      </section>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bancas */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Minhas bancas</h2>
          <div className="space-y-2">
            {bankrolls.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-white truncate">{b.name}</span>
                    {b.isDefault && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300"><Star size={11} /> padrão</span>}
                  </div>
                  <div className="text-[11px] text-gray-500">Inicial {BRL(b.initialCapital)}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-white">{BRL(b.currentBalance)}</span>
                  {!b.isDefault && <button onClick={() => setDefault(b)} title="Tornar padrão" className="p-1.5 rounded-lg text-amber-300 hover:bg-amber-500/15"><Star size={14} /></button>}
                  <button onClick={() => setEditBankroll(b)} className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10"><Pencil size={14} /></button>
                  {bankrolls.length > 1 && <button onClick={() => deleteBankroll(b)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Extrato */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Extrato</h2>
          {txs.length === 0 ? (
            <EmptyState icon={<ArrowDownUp size={20} />} title="Sem movimentações" message="Registre depósitos, saques ou ajustes da sua banca." action={<button onClick={() => setShowTx(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Movimentar</button>} />
          ) : (
            <ul className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="shrink-0">{TX_ICON[t.type]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-200">{TX_LABEL[t.type]}{t.description ? <span className="text-gray-500"> · {t.description}</span> : ''}</div>
                    <div className="text-[11px] text-gray-500">{fmtDateTime(t.createdAt)}</div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${profitColor(t.amount)}`}>{signedBRL(t.amount)}</span>
                  <button onClick={() => deleteTx(t.id)} className="p-1 rounded text-rose-300 hover:bg-rose-500/15"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editBankroll && <BankrollFormModal bankroll={editBankroll} onClose={() => setEditBankroll(null)} onSaved={() => { notify('Banca atualizada.'); refreshAll(); }} />}
      {showNew && <BankrollFormModal onClose={() => setShowNew(false)} onSaved={() => { notify('Banca criada.'); refreshAll(); }} />}
      {showTx && <TransactionModal bankrolls={bankrolls} accounts={accounts} defaultBankrollId={selectedId || undefined} onClose={() => setShowTx(false)} onSaved={() => { notify('Transação registrada.'); refreshAll(); }} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </AnalytixShell>
  );
}
