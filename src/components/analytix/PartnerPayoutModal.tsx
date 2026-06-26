import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { apiGateway, PartnerDTO, BankrollDTO } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import HelpLabel from './HelpLabel';
import { BRL, profitColor } from './format';

interface Props {
  partner: PartnerDTO;
  bankrolls: BankrollDTO[];
  onClose: () => void;
  onSaved: () => void;
}

const field = 'mt-1 w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition';

/** Registrar repasse/acerto a um parceiro (sai da banca como partner_payout). */
export default function PartnerPayoutModal({ partner, bankrolls, onClose, onSaved }: Props) {
  const due = partner.report?.balanceDue ?? 0;
  const [amount, setAmount] = useState(due > 0 ? String(due.toFixed(2)) : '');
  const [bankrollId, setBankrollId] = useState(bankrolls.find((b) => b.isDefault)?.id || bankrolls[0]?.id || '');
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
        bankrollId, type: 'partner_payout', amount: v, partnerId: partner.id,
        description: description.trim() || `Repasse a ${partner.name}`,
      });
      if (r.data?.result === 1) { onSaved(); onClose(); }
      else setError(r.data?.message || 'Não foi possível registrar.');
    } catch {
      setError('Erro ao registrar o repasse.');
    } finally {
      setSaving(false);
    }
  };

  const r = partner.report;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-md bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white pr-8">Acertar com {partner.name}</h2>

        {r && (
          <div className="mt-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Lucro gerado</div><div className={`font-semibold tabular-nums ${profitColor(r.profit)}`}>{BRL(r.profit)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Devido ({r.profitSharePct}%)</div><div className="font-semibold tabular-nums text-white">{BRL(r.owedFromShare)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wide text-gray-500">Saldo a pagar</div><div className={`font-semibold tabular-nums ${r.balanceDue > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{BRL(r.balanceDue)}</div></div>
          </div>
        )}

        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Quanto você está pagando ao parceiro agora. Sugerimos o saldo a pagar, mas você pode pagar parcial.">Valor do repasse (R$)</HelpLabel>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={field} />
        </label>
        <div className="mt-3">
          <HelpLabel className="text-xs text-gray-400 mb-1" help="Banca de onde o dinheiro do repasse sai (reduz o saldo dela).">Banca (de onde sai)</HelpLabel>
          <Select value={bankrollId} onChange={setBankrollId} buttonClassName="bg-black/20 py-2" options={bankrolls.map((b) => ({ value: b.id, label: b.name }))} />
        </div>
        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Identificação do repasse no extrato (ex.: referência do período).">Descrição</HelpLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={`Repasse a ${partner.name}`} className={field} />
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Registrar repasse
          </button>
        </div>
      </div>
    </div>
  );
}
