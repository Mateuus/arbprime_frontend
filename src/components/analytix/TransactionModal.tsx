import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { apiGateway, BankrollDTO, AccountDTO, TxTypeValue } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import HelpLabel from './HelpLabel';
import { unwrap } from './format';

interface Props {
  bankrolls: BankrollDTO[];
  accounts?: AccountDTO[];
  defaultBankrollId?: string;
  defaultAccountId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: { value: TxTypeValue; label: string }[] = [
  { value: 'deposit', label: 'Depósito' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'bonus', label: 'Bônus' },
  { value: 'adjustment', label: 'Ajuste' },
];

/** Movimentação de banca: depósito / saque / ajuste. */
export default function TransactionModal({ bankrolls, accounts = [], defaultBankrollId, defaultAccountId, onClose, onSaved }: Props) {
  const [type, setType] = useState<TxTypeValue>('deposit');
  const [amount, setAmount] = useState('');
  const [bankrollId, setBankrollId] = useState(defaultBankrollId || bankrolls.find((b) => b.isDefault)?.id || bankrolls[0]?.id || '');
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const v = parseFloat(amount.replace(',', '.')) || 0;
    if (!bankrollId) { setError('Selecione a banca.'); return; }
    if (!v) { setError('Informe um valor.'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await apiGateway.createAnalytixTransaction({
        bankrollId, type, amount: v, accountId: accountId || undefined, description: description.trim() || undefined,
      });
      if (r.data?.result === 1) { onSaved(); onClose(); }
      else setError(r.data?.message || 'Não foi possível registrar.');
    } catch {
      setError('Erro ao registrar a transação.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'mt-1 w-full bg-white/5 ring-1 ring-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-teal-500/50';

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-md bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white pr-8">Movimentar banca</h2>

        <div className="mt-4 inline-flex items-center gap-0.5 rounded-lg bg-white/5 ring-1 ring-white/10 p-0.5 w-full">
          {TYPES.map((t) => (
            <button key={t.value} onClick={() => setType(t.value)} className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${type === t.value ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Valor da movimentação. Depósito e bônus entram (+); saque sai (−); ajuste corrige o saldo.">Valor (R$)</HelpLabel>{type === 'adjustment' && <span className="text-gray-500"> — use negativo para reduzir</span>}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={field} />
        </label>
        <div className="mt-3">
          <HelpLabel className="text-xs text-gray-400 mb-1" help="Banca afetada por esta movimentação.">Banca</HelpLabel>
          <Select value={bankrollId} onChange={setBankrollId} buttonClassName="bg-black/20 py-2" options={bankrolls.map((b) => ({ value: b.id, label: b.name }))} />
        </div>
        {accounts.length > 0 && (
          <div className="mt-3">
            <HelpLabel className="text-xs text-gray-400 mb-1" help="Se a movimentação foi numa casa específica (depósito/saque naquela conta), selecione-a — atualiza o saldo da conta também.">Casa (opcional)</HelpLabel>
            <Select value={accountId} onChange={setAccountId} buttonClassName="bg-black/20 py-2" options={[{ value: '', label: '— Nenhuma —' }, ...accounts.map((a) => ({ value: a.id, label: a.label || a.slug }))]} />
          </div>
        )}
        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Texto livre para identificar a movimentação no extrato.">Descrição</HelpLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="opcional" className={field} />
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
