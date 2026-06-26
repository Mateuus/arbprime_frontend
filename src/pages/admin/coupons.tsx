import { useState, useEffect, useCallback } from 'react';
import { apiGateway, CouponDTO, UpsertCouponDTO, AffiliateDTO } from '@/gateways/api.gateway';
import {
  Ticket, RefreshCcw, Search, Loader2, X, Plus, Save, Trash2, Pencil, ChevronLeft, ChevronRight, Handshake,
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};
const brlCents = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toCents = (reais: string) => Math.round((Number(reais) || 0) * 100);
const toReais = (cents: number) => (cents ? String(cents / 100) : '');
const toDateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

const inputClass = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';
const labelClass = 'block text-xs text-gray-400 mb-1';

const FILTERS: { key: 'all' | 'system' | 'affiliate'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'system', label: 'Sistema (promo)' },
  { key: 'affiliate', label: 'De afiliado' },
];

const blankForm = {
  code: '', description: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: '10',
  isActive: true, maxRedemptions: '0', maxPerUser: '0', minAmount: '', maxDiscount: '',
  firstPurchaseOnly: false, validFrom: '', validUntil: '',
  affiliateId: '' as string | null, affiliateLabel: '',
};
type FormState = typeof blankForm;

const CouponModal = ({ editing, onClose, onSaved, onMsg }: { editing: CouponDTO | null; onClose: () => void; onSaved: () => void; onMsg: (t: 'ok' | 'err', s: string) => void }) => {
  const [form, setForm] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);
  const [affSearch, setAffSearch] = useState('');
  const [affResults, setAffResults] = useState<AffiliateDTO[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(editing ? {
      code: editing.code,
      description: editing.description || '',
      discountType: editing.discountType,
      discountValue: String(editing.discountValue),
      isActive: editing.isActive,
      maxRedemptions: String(editing.maxRedemptions),
      maxPerUser: String(editing.maxPerUser),
      minAmount: toReais(editing.minAmountCents),
      maxDiscount: toReais(editing.maxDiscountCents),
      firstPurchaseOnly: editing.firstPurchaseOnly,
      validFrom: toDateInput(editing.validFrom),
      validUntil: toDateInput(editing.validUntil),
      affiliateId: editing.affiliateId,
      affiliateLabel: editing.affiliate?.user?.fullname ? `${editing.affiliate.user.fullname} (${editing.affiliate.code})` : (editing.affiliate?.code || ''),
    } : blankForm);
  }, [editing]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (affSearch.trim().length < 2) { setAffResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiGateway.getAdminAffiliates({ search: affSearch.trim(), limit: 6 });
        if (res.data?.result === 1) setAffResults(res.data.data.affiliates || []);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [affSearch]);

  const submit = async () => {
    setBusy(true);
    const payload: UpsertCouponDTO = {
      code: form.code.trim() || undefined,
      description: form.description.trim() || null,
      affiliateId: form.affiliateId || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      isActive: form.isActive,
      maxRedemptions: Number(form.maxRedemptions) || 0,
      maxPerUser: Number(form.maxPerUser) || 0,
      minAmountCents: toCents(form.minAmount),
      maxDiscountCents: toCents(form.maxDiscount),
      firstPurchaseOnly: form.firstPurchaseOnly,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    };
    try {
      const res = editing ? await apiGateway.updateCoupon(editing.id, payload) : await apiGateway.createCoupon(payload);
      if (res.data?.result === 1) { onMsg('ok', editing ? 'Cupom atualizado.' : 'Cupom criado.'); onSaved(); onClose(); }
      else onMsg('err', res.data?.message || 'Erro ao salvar cupom.');
    } catch (e: unknown) { onMsg('err', errorMessage(e, 'Erro ao salvar cupom.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Ticket size={18} className="text-teal-300" /> {editing ? 'Editar cupom' : 'Novo cupom'}</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Código {editing ? '' : '(vazio = automático)'}</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${inputClass} uppercase`} placeholder="PROMO10" />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`${inputClass} text-left ${form.isActive ? 'text-emerald-300' : 'text-rose-300'}`}>{form.isActive ? 'Ativo' : 'Inativo'}</button>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Ex.: Promo de lançamento" />
          </div>
          <div>
            <label className={labelClass}>Tipo de desconto</label>
            <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed' })} className={inputClass}>
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{form.discountType === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}</label>
            <input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Limite total de usos (0 = ∞)</label>
            <input type="number" min="0" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Usos por cliente (0 = ∞)</label>
            <input type="number" min="0" value={form.maxPerUser} onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Valor mínimo (R$)</label>
            <input type="number" min="0" step="0.01" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className={inputClass} placeholder="opcional" />
          </div>
          <div>
            <label className={labelClass}>Desconto máx. (R$)</label>
            <input type="number" min="0" step="0.01" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className={inputClass} placeholder="opcional" />
          </div>
          <div>
            <label className={labelClass}>Válido de</label>
            <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Válido até</label>
            <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.firstPurchaseOnly} onChange={(e) => setForm({ ...form, firstPurchaseOnly: e.target.checked })} className="accent-teal-500" />
              Apenas na primeira compra
            </label>
          </div>

          {/* Vínculo com afiliado (opcional) */}
          <div className="col-span-2">
            <label className={labelClass}>Afiliado (opcional — deixe vazio para cupom de sistema)</label>
            {form.affiliateId ? (
              <div className="flex items-center justify-between rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-sm text-teal-200"><Handshake size={14} /> {form.affiliateLabel}</span>
                <button onClick={() => setForm({ ...form, affiliateId: null, affiliateLabel: '' })} className="text-gray-400 hover:text-rose-400"><X size={15} /></button>
              </div>
            ) : (
              <div className="relative">
                <input value={affSearch} onChange={(e) => setAffSearch(e.target.value)} placeholder="Buscar afiliado por nome/código" className={inputClass} />
                {affResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg bg-brand-dark border border-white/10 shadow-xl max-h-44 overflow-y-auto">
                    {affResults.map((a) => (
                      <button key={a.id} onClick={() => { setForm({ ...form, affiliateId: a.id, affiliateLabel: `${a.user?.fullname || a.code} (${a.code})` }); setAffSearch(''); setAffResults([]); }} className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm text-white">
                        {a.user?.fullname || '—'} <span className="font-mono text-teal-300 text-xs">{a.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button onClick={submit} disabled={busy} className="mt-5 w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {editing ? 'Salvar' : 'Criar cupom'}
        </button>
      </div>
    </div>
  );
};

const AdminCouponsPage = () => {
  const [rows, setRows] = useState<CouponDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'all' | 'system' | 'affiliate'>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAdminCoupons({ type, search: debounced || undefined, page, limit: 25 });
      if (res.data?.result === 1) {
        setRows(res.data.data.coupons || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotal(res.data.data.pagination?.total || 0);
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar cupons.' });
    } catch (e: unknown) { setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar cupons.') }); }
    finally { setLoading(false); }
  }, [type, debounced, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  const remove = async (c: CouponDTO) => {
    if (!confirm(`Remover o cupom ${c.code}?`)) return;
    try {
      const res = await apiGateway.deleteCoupon(c.id);
      if (res.data?.result === 1) { setMsg({ type: 'ok', text: 'Cupom removido.' }); load(); }
      else setMsg({ type: 'err', text: res.data?.message || 'Erro ao remover.' });
    } catch (e: unknown) { setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover.') }); }
  };

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: CouponDTO) => { setEditing(c); setModalOpen(true); };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30"><Ticket className="text-teal-300" size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Cupons</h1>
            <p className="text-sm text-gray-400">{total} cupom(ns) — promo do sistema e de afiliados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openNew} className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm inline-flex items-center gap-1.5"><Plus size={15} /> Novo cupom</button>
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300" title="Atualizar"><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setType(f.key); setPage(1); }} className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${type === f.key ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}>{f.label}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código" className={`${inputClass} pl-9`} />
        </div>
      </div>

      {msg && <div className={`mb-4 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>{msg.text}</div>}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">Nenhum cupom encontrado.</div>
        ) : (
          <div className="divide-y divide-white/5">
            <div className="hidden md:flex items-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-500">
              <span className="w-32">Código</span>
              <span className="flex-1">Origem / descrição</span>
              <span className="w-28 text-right">Desconto</span>
              <span className="w-24 text-center">Usos</span>
              <span className="w-20 text-center">Status</span>
              <span className="w-20 text-center">Ações</span>
            </div>
            {rows.map((c) => (
              <div key={c.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="md:w-32 font-mono font-semibold text-white">{c.code}</span>
                <div className="min-w-0 flex-1">
                  {c.affiliate ? (
                    <div className="text-xs text-teal-300 inline-flex items-center gap-1.5"><Handshake size={12} /> {c.affiliate.user?.fullname || c.affiliate.code}</div>
                  ) : (
                    <div className="text-xs text-violet-300">Sistema</div>
                  )}
                  {c.description && <div className="text-[11px] text-gray-500 truncate">{c.description}</div>}
                </div>
                <span className="md:w-28 md:text-right text-sm text-gray-200">{c.discountType === 'percent' ? `${c.discountValue}%` : brlCents(Math.round(c.discountValue * 100))}</span>
                <span className="md:w-24 md:text-center text-xs text-gray-400">{c.timesRedeemed}{c.maxRedemptions ? `/${c.maxRedemptions}` : ''}</span>
                <span className="md:w-20 md:text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${c.isActive ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-white/5 text-gray-400 ring-white/10'}`}>{c.isActive ? 'ativo' : 'inativo'}</span>
                </span>
                <span className="md:w-20 md:text-center inline-flex items-center md:justify-center gap-1">
                  <button onClick={() => openEdit(c)} className="grid place-items-center h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300" title="Editar"><Pencil size={13} /></button>
                  <button onClick={() => remove(c)} className="grid place-items-center h-7 w-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300" title="Remover"><Trash2 size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-400">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}

      {modalOpen && <CouponModal editing={editing} onClose={() => setModalOpen(false)} onSaved={load} onMsg={(t, s) => setMsg({ type: t, text: s })} />}
    </div>
  );
};

export default AdminCouponsPage;
