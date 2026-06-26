import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { X, Loader2, Check, Crown } from 'lucide-react';
import { apiGateway, BankrollDTO } from '@/gateways/api.gateway';
import HelpLabel from './HelpLabel';
import { unwrap } from './format';

interface Props {
  bankroll?: BankrollDTO | null;
  onClose: () => void;
  onSaved: (bankroll: BankrollDTO | null) => void;
}

/** Criar / editar banca. Múltiplas bancas é recurso premium (backend faz o gate). */
export default function BankrollFormModal({ bankroll, onClose, onSaved }: Props) {
  const router = useRouter();
  const isEdit = !!bankroll;
  const [name, setName] = useState(bankroll?.name || '');
  const [initialCapital, setInitialCapital] = useState(bankroll ? String(bankroll.initialCapital) : '');
  const [unitValue, setUnitValue] = useState(bankroll ? String(bankroll.unitValue) : '');
  const [commissionPct, setCommissionPct] = useState(bankroll?.commissionPct != null ? String(bankroll.commissionPct) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [premium, setPremium] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setError('Dê um nome à banca.'); return; }
    setSaving(true);
    setError('');
    setPremium(false);
    try {
      const payload = {
        name: name.trim(),
        initialCapital: parseFloat(initialCapital.replace(',', '.')) || 0,
        unitValue: parseFloat(unitValue.replace(',', '.')) || 0,
        commissionPct: commissionPct ? parseFloat(commissionPct.replace(',', '.')) : undefined,
      };
      const r = isEdit && bankroll ? await apiGateway.updateBankroll(bankroll.id, payload) : await apiGateway.createBankroll(payload);
      if (r.data?.result === 1) {
        onSaved(unwrap<BankrollDTO | null>(r, null));
        onClose();
      } else {
        setError(r.data?.message || 'Não foi possível salvar.');
      }
    } catch (e) {
      const resp = (e as { response?: { data?: { message?: string; data?: { premium?: boolean } } } })?.response?.data;
      if (resp?.data?.premium || resp?.message?.includes('assinante')) {
        setPremium(true);
        setError(resp?.message || 'Ter mais de uma banca é um recurso para assinantes.');
      } else {
        setError('Erro ao salvar a banca.');
      }
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
        <h2 className="text-lg font-bold text-white pr-8">{isEdit ? 'Editar banca' : 'Nova banca'}</h2>

        <label className="block mt-4 text-xs text-gray-400">
          <HelpLabel help="Nome para identificar esta banca (ex.: Banca Principal, Banca Surebet).">Nome</HelpLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Banca Principal" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="text-xs text-gray-400">
            <HelpLabel help="Quanto você começou nesta banca. É a base para o cálculo de ROI.">Banca inicial (R$)</HelpLabel>
            <input value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} inputMode="decimal" placeholder="0,00" className={field} />
          </label>
          <label className="text-xs text-gray-400">
            <HelpLabel help="Quanto vale 1 unidade (stake padrão). Opcional — ajuda a apostar e medir por unidades.">Valor da unidade (R$)</HelpLabel>
            <input value={unitValue} onChange={(e) => setUnitValue(e.target.value)} inputMode="decimal" placeholder="opcional" className={field} />
          </label>
        </div>
        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Comissão da exchange (ex.: Betfair) cobrada sobre o lucro da aposta. Deixe vazio se não usa exchange.">Comissão padrão (%) — exchange</HelpLabel>
          <input value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} inputMode="decimal" placeholder="opcional" className={field} />
        </label>

        {error && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ring-1 ${premium ? 'bg-amber-500/10 ring-amber-500/30 text-amber-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-300'}`}>
            {premium && <Crown size={13} className="inline mr-1 -mt-0.5" />}{error}
            {premium && (
              <button onClick={() => router.push('/plans')} className="block mt-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 font-semibold text-xs">Ver planos</button>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
