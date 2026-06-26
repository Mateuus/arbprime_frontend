import { useState, useEffect, useCallback } from 'react';
import {
  apiGateway, AffiliateDTO, AdminUserDTO, AffiliateCommissionDTO, AffiliatePayoutDTO, CouponDTO,
} from '@/gateways/api.gateway';
import {
  Handshake, RefreshCcw, Search, Loader2, X, Plus, Save, Wallet, Clock, BadgeCheck,
  Users, ArrowDownToLine, Ticket, ChevronLeft, ChevronRight, ShieldOff, ShieldCheck,
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};
const brlCents = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const inputClass = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';
const labelClass = 'block text-xs text-gray-400 mb-1';

// ===================== Modal: ativar afiliado =====================

const ActivateModal = ({ onClose, onDone, onMsg }: { onClose: () => void; onDone: () => void; onMsg: (t: 'ok' | 'err', s: string) => void }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminUserDTO[]>([]);
  const [picked, setPicked] = useState<AdminUserDTO | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: '', commissionType: 'percent' as 'percent' | 'fixed', commissionValue: '20',
    holdDays: '7', discountType: 'percent' as 'percent' | 'fixed', discountValue: '10', pixKey: '', notes: '',
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (picked || search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiGateway.getAdminUsers({ search: search.trim(), limit: 8 });
        if (res.data?.result === 1) setResults(res.data.data.users || []);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search, picked]);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const res = await apiGateway.activateAffiliate({
        userId: picked.id,
        code: form.code.trim() || undefined,
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue) || 0,
        holdDays: Number(form.holdDays) || 0,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        pixKey: form.pixKey.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (res.data?.result === 1) { onMsg('ok', 'Afiliado ativado.'); onDone(); onClose(); }
      else onMsg('err', res.data?.message || 'Erro ao ativar afiliado.');
    } catch (e: unknown) {
      onMsg('err', errorMessage(e, 'Erro ao ativar afiliado.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Handshake size={18} className="text-teal-300" /> Ativar afiliado</h2>

        {!picked ? (
          <div>
            <label className={labelClass}>Buscar usuário (nome, e-mail ou CPF)</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite ao menos 2 caracteres" className={`${inputClass} pl-9`} autoFocus />
            </div>
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {searching && <div className="text-center py-3 text-gray-400"><Loader2 className="animate-spin mx-auto" size={18} /></div>}
              {results.map((u) => (
                <button key={u.id} onClick={() => setPicked(u)} className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2">
                  <div className="text-sm text-white">{u.fullname}</div>
                  <div className="text-[11px] text-gray-500">{u.email}</div>
                </button>
              ))}
              {!searching && search.trim().length >= 2 && results.length === 0 && <div className="text-sm text-gray-500 text-center py-3">Nenhum usuário encontrado.</div>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2">
              <div>
                <div className="text-sm text-white">{picked.fullname}</div>
                <div className="text-[11px] text-gray-500">{picked.email}</div>
              </div>
              <button onClick={() => setPicked(null)} className="text-xs text-teal-300 hover:underline">trocar</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Código (opcional — gera automático se vazio)</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EX: JOAO10" className={`${inputClass} uppercase`} />
              </div>
              <div>
                <label className={labelClass}>Comissão do afiliado</label>
                <select value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value as 'percent' | 'fixed' })} className={inputClass}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{form.commissionType === 'percent' ? 'Comissão (%)' : 'Comissão (R$)'}</label>
                <input type="number" min="0" step="0.01" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Desconto do cupom</label>
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
                <label className={labelClass}>Garantia (dias)</label>
                <input type="number" min="0" value={form.holdDays} onChange={(e) => setForm({ ...form, holdDays: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Chave PIX (repasse)</label>
                <input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Observações</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
              </div>
            </div>

            <button onClick={submit} disabled={busy} className="w-full py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Ativar afiliado
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== Modal: detalhe / configuração =====================

interface DetailData {
  affiliate: AffiliateDTO;
  balances: { pendingCents: number; availableCents: number; paidCents: number; lifetimeCents: number };
  commissions: AffiliateCommissionDTO[];
  payouts: AffiliatePayoutDTO[];
  coupons: CouponDTO[];
}

const DetailModal = ({ id, onClose, onChanged, onMsg }: { id: string; onClose: () => void; onChanged: () => void; onMsg: (t: 'ok' | 'err', s: string) => void }) => {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payout, setPayout] = useState({ note: '', pixKey: '', reference: '' });
  const [form, setForm] = useState({ commissionType: 'percent' as 'percent' | 'fixed', commissionValue: '0', holdDays: '7', pixKey: '', notes: '', isActive: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAdminAffiliate(id);
      if (res.data?.result === 1) {
        const d: DetailData = res.data.data;
        setData(d);
        setForm({
          commissionType: d.affiliate.commissionType,
          commissionValue: String(d.affiliate.commissionValue),
          holdDays: String(d.affiliate.holdDays),
          pixKey: d.affiliate.pixKey || '',
          notes: d.affiliate.notes || '',
          isActive: d.affiliate.isActive,
        });
      }
    } catch (e: unknown) { onMsg('err', errorMessage(e, 'Erro ao carregar afiliado.')); }
    finally { setLoading(false); }
  }, [id, onMsg]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await apiGateway.updateAffiliate(id, {
        commissionType: form.commissionType,
        commissionValue: Number(form.commissionValue) || 0,
        holdDays: Number(form.holdDays) || 0,
        pixKey: form.pixKey.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      });
      if (res.data?.result === 1) { onMsg('ok', 'Afiliado atualizado.'); onChanged(); await load(); }
      else onMsg('err', res.data?.message || 'Erro ao salvar.');
    } catch (e: unknown) { onMsg('err', errorMessage(e, 'Erro ao salvar.')); }
    finally { setBusy(false); }
  };

  const doPayout = async () => {
    setBusy(true);
    try {
      const res = await apiGateway.createAffiliatePayout(id, { note: payout.note || undefined, pixKey: payout.pixKey || undefined, reference: payout.reference || undefined });
      if (res.data?.result === 1) { onMsg('ok', 'Repasse registrado.'); setPayoutOpen(false); setPayout({ note: '', pixKey: '', reference: '' }); onChanged(); await load(); }
      else onMsg('err', res.data?.message || 'Erro ao registrar repasse.');
    } catch (e: unknown) { onMsg('err', errorMessage(e, 'Erro ao registrar repasse.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-dark border border-white/10 w-full max-w-2xl rounded-2xl p-6 relative shadow-2xl max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        {loading || !data ? (
          <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="grid place-items-center h-10 w-10 rounded-xl bg-teal-500/15 ring-1 ring-teal-500/30"><Handshake className="text-teal-300" size={20} /></div>
              <div>
                <h2 className="text-lg font-bold text-white">{data.affiliate.user?.fullname || 'Afiliado'} <span className="font-mono text-teal-300 text-sm">· {data.affiliate.code}</span></h2>
                <p className="text-xs text-gray-500">{data.affiliate.user?.email}</p>
              </div>
            </div>

            {/* Saldos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 p-3"><div className="text-[11px] text-emerald-300/80">Disponível</div><div className="text-lg font-bold text-emerald-300">{brlCents(data.balances.availableCents)}</div></div>
              <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30 p-3"><div className="text-[11px] text-amber-300/80">Pendente</div><div className="text-lg font-bold text-amber-300">{brlCents(data.balances.pendingCents)}</div></div>
              <div className="rounded-xl bg-teal-500/10 ring-1 ring-teal-500/30 p-3"><div className="text-[11px] text-teal-300/80">Pago</div><div className="text-lg font-bold text-teal-300">{brlCents(data.balances.paidCents)}</div></div>
              <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3"><div className="text-[11px] text-gray-400">Total</div><div className="text-lg font-bold text-white">{brlCents(data.balances.lifetimeCents)}</div></div>
            </div>

            <button onClick={() => setPayoutOpen((v) => !v)} disabled={data.balances.availableCents <= 0} className="mb-4 w-full py-2.5 rounded-lg bg-teal-500/90 hover:bg-teal-400 text-slate-900 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              <ArrowDownToLine size={16} /> Registrar repasse do disponível ({brlCents(data.balances.availableCents)})
            </button>

            {payoutOpen && (
              <div className="mb-5 rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-2">
                <p className="text-xs text-gray-400">Isto marca todas as comissões <b className="text-emerald-300">disponíveis</b> como pagas e cria um registro de repasse.</p>
                <input value={payout.pixKey} onChange={(e) => setPayout({ ...payout, pixKey: e.target.value })} placeholder={`Chave PIX (padrão: ${data.affiliate.pixKey || '—'})`} className={inputClass} />
                <input value={payout.reference} onChange={(e) => setPayout({ ...payout, reference: e.target.value })} placeholder="Referência / comprovante (opcional)" className={inputClass} />
                <input value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} placeholder="Observação (opcional)" className={inputClass} />
                <button onClick={doPayout} disabled={busy} className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <BadgeCheck size={15} />} Confirmar repasse
                </button>
              </div>
            )}

            {/* Config */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">Configuração</span>
                <button onClick={() => setForm({ ...form, isActive: !form.isActive })} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ring-1 ${form.isActive ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-300 ring-rose-500/30'}`}>
                  {form.isActive ? <><ShieldCheck size={13} /> Ativo</> : <><ShieldOff size={13} /> Suspenso</>}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tipo de comissão</label>
                  <select value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value as 'percent' | 'fixed' })} className={inputClass}>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{form.commissionType === 'percent' ? 'Comissão (%)' : 'Comissão (R$)'}</label>
                  <input type="number" min="0" step="0.01" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Garantia (dias)</label>
                  <input type="number" min="0" value={form.holdDays} onChange={(e) => setForm({ ...form, holdDays: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Chave PIX</label>
                  <input value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Observações</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
                </div>
              </div>
              <button onClick={save} disabled={busy} className="mt-3 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar
              </button>
            </div>

            {/* Cupons */}
            <div className="mb-5">
              <div className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Ticket size={15} className="text-teal-300" /> Cupons</div>
              <div className="flex flex-wrap gap-2">
                {data.coupons.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-2 rounded-lg bg-black/30 ring-1 ring-white/10 px-2.5 py-1 text-xs">
                    <span className="font-mono text-white">{c.code}</span>
                    <span className="text-teal-300">{c.discountType === 'percent' ? `${c.discountValue}%` : brlCents(Math.round(c.discountValue * 100))}</span>
                    <span className="text-gray-500">· {c.timesRedeemed} uso(s)</span>
                  </span>
                ))}
                {data.coupons.length === 0 && <span className="text-sm text-gray-500">Sem cupons.</span>}
              </div>
            </div>

            {/* Comissões recentes */}
            <div className="mb-2 text-sm font-semibold text-white">Comissões recentes</div>
            <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 mb-5">
              {data.commissions.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 text-gray-300 truncate">{c.customer}</span>
                  <span className="text-xs text-gray-500">{dateTime(c.createdAt)}</span>
                  <span className="font-semibold text-emerald-300 w-24 text-right">{brlCents(c.amountCents)}</span>
                  <span className="text-[10px] w-20 text-center text-gray-400">{c.status}</span>
                </div>
              ))}
              {data.commissions.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-500">Nenhuma comissão.</div>}
            </div>

            {/* Repasses */}
            <div className="mb-2 text-sm font-semibold text-white">Repasses</div>
            <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
              {data.payouts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1 text-gray-300">{p.commissionsCount} comissão(ões){p.reference ? ` · ${p.reference}` : ''}</span>
                  <span className="text-xs text-gray-500">{dateTime(p.createdAt)}</span>
                  <span className="font-semibold text-teal-300 w-24 text-right">{brlCents(p.amountCents)}</span>
                </div>
              ))}
              {data.payouts.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-500">Nenhum repasse.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ===================== Página =====================

const AdminAffiliatesPage = () => {
  const [rows, setRows] = useState<AffiliateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAdminAffiliates({ search: debounced || undefined, page, limit: 25 });
      if (res.data?.result === 1) {
        setRows(res.data.data.affiliates || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotal(res.data.data.pagination?.total || 0);
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar afiliados.' });
    } catch (e: unknown) { setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar afiliados.') }); }
    finally { setLoading(false); }
  }, [debounced, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30"><Handshake className="text-teal-300" size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Afiliados</h1>
            <p className="text-sm text-gray-400">{total} afiliado(s) no programa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActivateOpen(true)} className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm inline-flex items-center gap-1.5"><Plus size={15} /> Ativar afiliado</button>
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300" title="Atualizar"><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, nome ou e-mail" className={`${inputClass} pl-9`} />
      </div>

      {msg && <div className={`mb-4 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>{msg.text}</div>}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">Nenhum afiliado ainda. Clique em “Ativar afiliado”.</div>
        ) : (
          <div className="divide-y divide-white/5">
            <div className="hidden md:flex items-center gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-500">
              <span className="flex-1">Afiliado</span>
              <span className="w-24">Código</span>
              <span className="w-28 text-right">Comissão</span>
              <span className="w-28 text-right">Disponível</span>
              <span className="w-28 text-right">Pendente</span>
              <span className="w-20 text-center">Indic.</span>
            </div>
            {rows.map((a) => (
              <button key={a.id} onClick={() => setDetailId(a.id)} className="w-full text-left flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-white/5 transition">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate flex items-center gap-2">
                    {a.user?.fullname || '—'}
                    {!a.isActive && <span className="text-[10px] rounded px-1.5 py-0.5 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30">suspenso</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{a.user?.email}</div>
                </div>
                <span className="md:w-24 font-mono text-xs text-teal-300">{a.code}</span>
                <span className="md:w-28 md:text-right text-xs text-gray-300">{a.commissionType === 'percent' ? `${a.commissionValue}%` : brlCents(Math.round(a.commissionValue * 100))}</span>
                <span className="md:w-28 md:text-right text-sm font-semibold text-emerald-300">{brlCents(a.balances?.availableCents || 0)}</span>
                <span className="md:w-28 md:text-right text-sm text-amber-300">{brlCents(a.balances?.pendingCents || 0)}</span>
                <span className="md:w-20 md:text-center text-xs text-gray-400 inline-flex items-center md:justify-center gap-1"><Users size={12} /> {a.totalReferrals}</span>
              </button>
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

      {activateOpen && <ActivateModal onClose={() => setActivateOpen(false)} onDone={load} onMsg={(t, s) => setMsg({ type: t, text: s })} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} onMsg={(t, s) => setMsg({ type: t, text: s })} />}
    </div>
  );
};

export default AdminAffiliatesPage;
