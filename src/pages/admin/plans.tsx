import { useState, useEffect, useCallback } from 'react';
import { apiGateway, PlanDTO, UpsertPlanDTO } from '@/gateways/api.gateway';
import {
  CreditCard, Plus, RefreshCcw, Pencil, Trash2, X, Loader2, Gift, EyeOff, Clock, Tag, Layers
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

interface FormState {
  name: string;
  description: string;
  price: string;
  promotionType: 'none' | 'percent' | 'fixed';
  promotionValue: string;
  durationInDays: string;
  level: string;
  isTrial: boolean;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: FormState = {
  name: '', description: '', price: '0', promotionType: 'none', promotionValue: '0',
  durationInDays: '30', level: '1', isTrial: false, isActive: true, sortOrder: '0',
};

const fromPlan = (p: PlanDTO): FormState => ({
  name: p.name,
  description: p.description || '',
  price: String(p.price),
  promotionType: p.promotionType,
  promotionValue: String(p.promotionValue),
  durationInDays: String(p.durationInDays),
  level: String(p.level),
  isTrial: p.isTrial,
  isActive: p.isActive,
  sortOrder: String(p.sortOrder),
});

const computeFinal = (f: FormState): number => {
  const price = Number(f.price) || 0;
  const val = Number(f.promotionValue) || 0;
  let final = price;
  if (f.promotionType === 'percent') final = price - (price * val) / 100;
  else if (f.promotionType === 'fixed') final = price - val;
  return Math.max(0, Math.round(final * 100) / 100);
};

const toPayload = (f: FormState): UpsertPlanDTO => ({
  name: f.name.trim(),
  description: f.description,
  price: Number(f.price) || 0,
  promotionType: f.promotionType,
  promotionValue: Number(f.promotionValue) || 0,
  durationInDays: Number(f.durationInDays) || 1,
  level: Number(f.level) || 0,
  isTrial: f.isTrial,
  isActive: f.isActive,
  sortOrder: Number(f.sortOrder) || 0,
});

const PlanForm = ({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) => (
  <div className="space-y-4">
    <label className="block text-xs text-gray-400">
      Nome
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputClass} mt-1`} placeholder="Ex.: Mensal" />
    </label>
    <label className="block text-xs text-gray-400">
      Descrição
      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} mt-1 resize-none`} rows={2} placeholder="Benefícios do plano" />
    </label>

    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs text-gray-400">
        Preço cheio (R$)
        <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-xs text-gray-400">
        Duração (dias)
        <input type="number" min="1" value={form.durationInDays} onChange={(e) => setForm({ ...form, durationInDays: e.target.value })} className={`${inputClass} mt-1`} />
      </label>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs text-gray-400">
        Promoção
        <select value={form.promotionType} onChange={(e) => setForm({ ...form, promotionType: e.target.value as FormState['promotionType'] })} className={`${inputClass} mt-1`}>
          <option value="none">Sem promoção</option>
          <option value="percent">Percentual (%)</option>
          <option value="fixed">Valor fixo (R$)</option>
        </select>
      </label>
      <label className="block text-xs text-gray-400">
        Valor da promoção
        <input type="number" min="0" step="0.01" disabled={form.promotionType === 'none'} value={form.promotionValue} onChange={(e) => setForm({ ...form, promotionValue: e.target.value })} className={`${inputClass} mt-1 disabled:opacity-40`} />
      </label>
    </div>

    {form.promotionType !== 'none' && (
      <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2 text-sm">
        <span className="text-gray-300">Preço final cobrado</span>
        <span className="font-bold text-emerald-300">{brl(computeFinal(form))}</span>
      </div>
    )}

    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs text-gray-400">
        Nível de acesso
        <input type="number" min="0" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-xs text-gray-400">
        Ordem de exibição
        <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={`${inputClass} mt-1`} />
      </label>
    </div>

    <div className="flex flex-wrap gap-4 pt-1">
      <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-teal-500" />
        Ativo
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={form.isTrial} onChange={(e) => setForm({ ...form, isTrial: e.target.checked })} className="accent-violet-500" />
        Teste gratuito
      </label>
    </div>
  </div>
);

const AdminPlansPage = () => {
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editPlan, setEditPlan] = useState<PlanDTO | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAllPlans();
      if (res.data?.result === 1) setPlans(res.data.data || []);
      else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar planos.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar planos.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!addForm.name.trim()) { setMsg({ type: 'err', text: 'Informe o nome do plano.' }); return; }
    setSaving(true);
    try {
      const res = await apiGateway.createPlan(toPayload(addForm));
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Plano criado.' });
      setAddOpen(false);
      setAddForm(emptyForm);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao criar plano.') });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: PlanDTO) => { setEditPlan(p); setEditForm(fromPlan(p)); };

  const handleEdit = async () => {
    if (!editPlan) return;
    if (!editForm.name.trim()) { setMsg({ type: 'err', text: 'Informe o nome do plano.' }); return; }
    setEditSaving(true);
    try {
      const res = await apiGateway.updatePlan(editPlan.id, toPayload(editForm));
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Plano atualizado.' });
      setEditPlan(null);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao atualizar plano.') });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (p: PlanDTO) => {
    if (!window.confirm(`Remover o plano "${p.name}"?`)) return;
    try {
      await apiGateway.deletePlan(p.id);
      setMsg({ type: 'ok', text: 'Plano removido.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover plano.') });
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <CreditCard className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Planos</h1>
            <p className="text-sm text-gray-400">Crie e edite os planos de assinatura, promoções e teste gratuito</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => { setAddForm(emptyForm); setAddOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition">
            <Plus size={15} /> Novo plano
          </button>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-gray-400">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center">
          <CreditCard className="mx-auto text-gray-600 mb-3" size={32} />
          <p className="text-gray-400">Nenhum plano cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {p.isTrial ? <Gift size={18} className="text-violet-300" /> : <Tag size={18} className="text-teal-300" />}
                  <h3 className="font-bold text-white">{p.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px]">{p.description}</p>

              <div className="mt-3">
                {p.hasPromotion && <span className="text-xs text-gray-500 line-through mr-2">{brl(p.price)}</span>}
                <span className="text-2xl font-extrabold text-white">{brl(p.finalPrice)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-gray-300"><Clock size={11} /> {p.durationInDays}d</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-gray-300"><Layers size={11} /> nível {p.level}</span>
                {p.hasPromotion && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 px-2 py-0.5 text-emerald-300">promo</span>}
                {p.isTrial && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 ring-1 ring-violet-500/30 px-2 py-0.5 text-violet-300">teste</span>}
                {!p.isActive && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 ring-1 ring-rose-500/30 px-2 py-0.5 text-rose-300"><EyeOff size={11} /> inativo</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar */}
      {addOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setAddOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">Novo plano</h2>
            <PlanForm form={addForm} setForm={setAddForm} />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAddOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleCreate} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {saving ? 'Salvando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editPlan && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditPlan(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">Editar plano</h2>
            <PlanForm form={editForm} setForm={setEditForm} />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditPlan(null)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleEdit} disabled={editSaving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlansPage;
