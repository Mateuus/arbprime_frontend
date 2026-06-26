import React, { useState } from 'react';
import { Check, Plus, Users, Pencil, Trash2, HandCoins, Phone, CreditCard } from 'lucide-react';
import { apiGateway, PartnerDTO } from '@/gateways/api.gateway';
import AnalytixShell from '@/components/analytix/AnalytixShell';
import KpiCard from '@/components/analytix/KpiCard';
import EmptyState from '@/components/analytix/EmptyState';
import PartnerFormModal from '@/components/analytix/PartnerFormModal';
import PartnerPayoutModal from '@/components/analytix/PartnerPayoutModal';
import { usePartners, useBankrolls } from '@/components/analytix/useAnalytix';
import { BRL, profitColor } from '@/components/analytix/format';

const costLabel = (p: PartnerDTO): string => {
  const parts: string[] = [];
  if ((p.costModel === 'rent' || p.costModel === 'hybrid') && p.rentAmount) parts.push(`Aluguel ${BRL(p.rentAmount)}/${p.rentPeriod === 'week' ? 'sem' : 'mês'}`);
  if ((p.costModel === 'profit_share' || p.costModel === 'hybrid') && p.profitSharePct) parts.push(`${p.profitSharePct}% do lucro`);
  return parts.join(' + ') || 'Sem custo definido';
};

export default function AnalytixParceiros() {
  const { partners, loading, reload } = usePartners();
  const { bankrolls } = useBankrolls();

  const [formPartner, setFormPartner] = useState<PartnerDTO | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [payoutPartner, setPayoutPartner] = useState<PartnerDTO | null>(null);
  const [toast, setToast] = useState('');
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const totalDue = partners.reduce((a, p) => a + Math.max(0, p.report?.balanceDue || 0), 0);
  const totalProfit = partners.reduce((a, p) => a + (p.report?.profit || 0), 0);

  const remove = async (p: PartnerDTO) => {
    if (!confirm(`Remover o parceiro "${p.name}"? As contas dele ficarão sem dono.`)) return;
    await apiGateway.deletePartner(p.id);
    notify('Parceiro removido.');
    void reload();
  };

  return (
    <AnalytixShell
      active="parceiros"
      title="Parceiros"
      subtitle="Donos das contas, custos e acertos"
      actions={(
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">
          <Plus size={16} /> Novo parceiro
        </button>
      )}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Parceiros" loading={loading} icon={<Users size={16} />} value={String(partners.length)} />
        <KpiCard label="Lucro gerado (contas deles)" loading={loading} value={BRL(totalProfit)} valueClass={profitColor(totalProfit)} />
        <KpiCard label="Total a repassar" loading={loading} icon={<HandCoins size={16} />} value={BRL(totalDue)} valueClass={totalDue > 0 ? 'text-amber-300' : 'text-emerald-400'} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Nenhum parceiro cadastrado"
          message="Cadastre os donos das contas (CPF de terceiros) com o modelo de remuneração — aluguel ou % do lucro — e vincule as contas a eles."
          action={<button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Novo parceiro</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {partners.map((p) => {
            const r = p.report;
            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid place-items-center h-8 w-8 rounded-lg bg-violet-500/15 ring-1 ring-violet-500/30 text-violet-300 text-sm font-bold shrink-0">{p.name.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[11px] text-gray-500">{costLabel(p)}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
                      {p.cpf && <span className="inline-flex items-center gap-1"><CreditCard size={11} /> {p.cpf}</span>}
                      {p.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {p.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setFormPartner(p)} className="p-1.5 rounded-lg text-gray-300 hover:bg-white/10"><Pencil size={15} /></button>
                    <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 size={15} /></button>
                  </div>
                </div>

                {r && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center rounded-xl bg-black/20 p-2.5">
                    <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Contas</div><div className="text-sm font-semibold text-white tabular-nums">{r.accountCount}</div></div>
                    <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Lucro</div><div className={`text-sm font-semibold tabular-nums ${profitColor(r.profit)}`}>{BRL(r.profit)}</div></div>
                    <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Pago</div><div className="text-sm font-semibold text-gray-200 tabular-nums">{BRL(r.totalPaid)}</div></div>
                    <div><div className="text-[9px] uppercase tracking-wide text-gray-500">A pagar</div><div className={`text-sm font-semibold tabular-nums ${r.balanceDue > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{BRL(r.balanceDue)}</div></div>
                  </div>
                )}

                <button onClick={() => setPayoutPartner(p)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-sm text-gray-200 hover:bg-white/10">
                  <HandCoins size={15} /> Acertar / registrar repasse
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <PartnerFormModal onClose={() => setShowNew(false)} onSaved={() => { notify('Parceiro cadastrado.'); void reload(); }} />}
      {formPartner && <PartnerFormModal partner={formPartner} onClose={() => setFormPartner(null)} onSaved={() => { notify('Parceiro atualizado.'); void reload(); }} />}
      {payoutPartner && <PartnerPayoutModal partner={payoutPartner} bankrolls={bankrolls} onClose={() => setPayoutPartner(null)} onSaved={() => { notify('Repasse registrado.'); void reload(); }} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </AnalytixShell>
  );
}
