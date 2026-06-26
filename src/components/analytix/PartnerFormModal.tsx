import React, { useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { apiGateway, PartnerDTO, CostModelValue } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import HelpLabel from './HelpLabel';
import { unwrap } from './format';

interface Props {
  partner?: PartnerDTO | null;
  onClose: () => void;
  onSaved: (p: PartnerDTO | null) => void;
}

const field = 'mt-1 w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition';

const COST_MODELS: { value: CostModelValue; label: string; hint: string }[] = [
  { value: 'profit_share', label: '% do lucro', hint: 'Paga uma % do lucro gerado nas contas dele' },
  { value: 'rent', label: 'Aluguel fixo', hint: 'Valor fixo por período, independe do lucro' },
  { value: 'hybrid', label: 'Híbrido', hint: 'Aluguel + % do lucro' },
];

/** Cadastrar / editar parceiro (dono de conta). */
export default function PartnerFormModal({ partner, onClose, onSaved }: Props) {
  const isEdit = !!partner;
  const [name, setName] = useState(partner?.name || '');
  const [cpf, setCpf] = useState(partner?.cpf || '');
  const [phone, setPhone] = useState(partner?.phone || '');
  const [email, setEmail] = useState(partner?.email || '');
  const [pixKey, setPixKey] = useState(partner?.pixKey || '');
  const [costModel, setCostModel] = useState<CostModelValue>(partner?.costModel || 'profit_share');
  const [rentAmount, setRentAmount] = useState(partner?.rentAmount != null ? String(partner.rentAmount) : '');
  const [rentPeriod, setRentPeriod] = useState<'week' | 'month'>(partner?.rentPeriod || 'month');
  const [profitSharePct, setProfitSharePct] = useState(partner?.profitSharePct != null ? String(partner.profitSharePct) : '');
  const [notes, setNotes] = useState(partner?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usesRent = costModel === 'rent' || costModel === 'hybrid';
  const usesShare = costModel === 'profit_share' || costModel === 'hybrid';

  const submit = async () => {
    if (!name.trim()) { setError('Informe o nome do parceiro.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        cpf: cpf.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        pixKey: pixKey.trim() || undefined,
        costModel,
        rentAmount: usesRent ? (parseFloat(rentAmount.replace(',', '.')) || 0) : undefined,
        rentPeriod,
        profitSharePct: usesShare ? (parseFloat(profitSharePct.replace(',', '.')) || 0) : undefined,
        notes: notes.trim() || undefined,
      };
      const r = isEdit && partner ? await apiGateway.updatePartner(partner.id, payload) : await apiGateway.createPartner(payload);
      if (r.data?.result === 1) { onSaved(unwrap<PartnerDTO | null>(r, null)); onClose(); }
      else setError(r.data?.message || 'Não foi possível salvar.');
    } catch {
      setError('Erro ao salvar parceiro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-lg bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white pr-8">{isEdit ? 'Editar parceiro' : 'Novo parceiro'}</h2>

        <label className="block mt-4 text-xs text-gray-400">
          <HelpLabel help="Nome do dono da conta (parceiro). Aparece nas contas e nos acertos.">Nome *</HelpLabel>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do parceiro" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="text-xs text-gray-400">
            <HelpLabel help="CPF do parceiro (dono da conta). Fica privado — só você vê.">CPF</HelpLabel>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className={field} />
          </label>
          <label className="text-xs text-gray-400">
            <HelpLabel help="Telefone/WhatsApp do parceiro para combinar os acertos.">Telefone/WhatsApp</HelpLabel>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <label className="text-xs text-gray-400">
            <HelpLabel help="E-mail do parceiro (opcional).">E-mail</HelpLabel>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          <label className="text-xs text-gray-400">
            <HelpLabel help="Chave PIX usada para pagar o repasse ao parceiro.">Chave PIX (repasse)</HelpLabel>
            <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone..." className={field} />
          </label>
        </div>

        {/* Modelo de remuneração */}
        <div className="mt-4">
          <HelpLabel className="text-xs text-gray-400 mb-1.5" help="Como o parceiro é pago: % do lucro das contas dele, aluguel fixo por período, ou os dois (híbrido).">Modelo de remuneração</HelpLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {COST_MODELS.map((m) => (
              <button key={m.value} onClick={() => setCostModel(m.value)} title={m.hint}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition ring-1 ${costModel === m.value ? 'bg-teal-500 text-slate-900 ring-teal-400' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">{COST_MODELS.find((m) => m.value === costModel)?.hint}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {usesRent && (
            <label className="text-xs text-gray-400">
              <HelpLabel help="Valor fixo pago ao parceiro por período, independente do lucro (custo certo).">Aluguel (R$)</HelpLabel>
              <div className="flex items-center gap-1.5 mt-1">
                <input value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40" />
                <Select className="w-24 shrink-0" value={rentPeriod} onChange={(v) => setRentPeriod(v as 'week' | 'month')} buttonClassName="bg-black/20 py-2 text-xs" options={[{ value: 'month', label: '/mês' }, { value: 'week', label: '/sem' }]} />
              </div>
            </label>
          )}
          {usesShare && (
            <label className="text-xs text-gray-400">
              <HelpLabel help="Percentual do lucro das contas dele repassado ao parceiro. 0% = o parceiro não recebe nada.">% do lucro</HelpLabel>
              <input value={profitSharePct} onChange={(e) => setProfitSharePct(e.target.value)} inputMode="decimal" placeholder="ex.: 50 (0 = não recebe nada)" className={field} />
            </label>
          )}
        </div>
        {usesShare && (parseFloat(profitSharePct.replace(',', '.')) || 0) === 0 && (
          <p className="mt-1.5 text-[11px] text-amber-300/90">Com <b>0%</b>, o parceiro não recebe repasse — você apenas usa a conta dele (sem custo de divisão de lucro).</p>
        )}

        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Anotações livres sobre o parceiro (acordos, observações).">Notas</HelpLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} />
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

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
