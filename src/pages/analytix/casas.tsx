import React, { useState } from 'react';
import { Check, Plus, Store, Wallet } from 'lucide-react';
import { apiGateway, AccountDTO } from '@/gateways/api.gateway';
import AnalytixShell from '@/components/analytix/AnalytixShell';
import KpiCard from '@/components/analytix/KpiCard';
import AccountCard from '@/components/analytix/AccountCard';
import AccountFormModal from '@/components/analytix/AccountFormModal';
import TransactionModal from '@/components/analytix/TransactionModal';
import EmptyState from '@/components/analytix/EmptyState';
import { useAccounts, useBankrolls } from '@/components/analytix/useAnalytix';
import { BRL } from '@/components/analytix/format';

export default function AnalytixCasas() {
  const { accounts, loading, reload } = useAccounts();
  const { bankrolls } = useBankrolls();

  const [formAccount, setFormAccount] = useState<AccountDTO | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [txAccount, setTxAccount] = useState<AccountDTO | null>(null);
  const [toast, setToast] = useState('');
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const totalBalance = accounts.reduce((a, c) => a + c.balance, 0);

  const deleteAccount = async (a: AccountDTO) => {
    if (!confirm(`Remover a casa "${a.label || a.slug}"?`)) return;
    await apiGateway.deleteAccount(a.id);
    notify('Casa removida.');
    void reload();
  };

  return (
    <AnalytixShell
      active="casas"
      title="Minhas Casas"
      subtitle="Suas contas nas casas de aposta e saldos"
      actions={(
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">
          <Plus size={16} /> Cadastrar casa
        </button>
      )}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Saldo total nas casas" loading={loading} icon={<Wallet size={16} />} value={BRL(totalBalance)} />
        <KpiCard label="Casas cadastradas" loading={loading} icon={<Store size={16} />} value={String(accounts.length)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Store size={22} />}
          title="Nenhuma casa cadastrada"
          message="Cadastre suas contas nas casas de aposta para acompanhar saldos. Você também pode cadastrar direto da calculadora ao lançar uma surebet."
          action={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Cadastrar casa</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} onEdit={setFormAccount} onDelete={deleteAccount} onTransaction={setTxAccount} />
          ))}
        </div>
      )}

      {showNew && <AccountFormModal onClose={() => setShowNew(false)} onSaved={() => { notify('Casa cadastrada.'); void reload(); }} />}
      {formAccount && <AccountFormModal account={formAccount} onClose={() => setFormAccount(null)} onSaved={() => { notify('Casa atualizada.'); void reload(); }} />}
      {txAccount && (
        <TransactionModal
          bankrolls={bankrolls}
          accounts={accounts}
          defaultAccountId={txAccount.id}
          onClose={() => setTxAccount(null)}
          onSaved={() => { notify('Movimentação registrada.'); void reload(); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </AnalytixShell>
  );
}
