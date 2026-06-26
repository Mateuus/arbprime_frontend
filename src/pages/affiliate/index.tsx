import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  apiGateway, AffiliateDashboardDTO, CouponDTO, AffiliateRedemptionDTO,
  AffiliateCommissionDTO, AffiliatePayoutDTO,
} from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import {
  Handshake, Copy, Check, Loader2, Wallet, Clock, BadgeCheck, Users, Ticket,
  TrendingUp, Share2, ArrowDownToLine, ShieldCheck,
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brlCents = (c: number) => ((c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const dateOnly = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

const PERIODS: { key: 'week' | 'month' | 'year' | 'all'; label: string }[] = [
  { key: 'week', label: '7 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'year', label: 'Este ano' },
  { key: 'all', label: 'Tudo' },
];

const COMMISSION_STATUS: Record<string, { tone: string; label: string }> = {
  pending: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'pendente' },
  available: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'disponível' },
  paid: { tone: 'bg-teal-500/15 text-teal-300 ring-teal-500/30', label: 'pago' },
  cancelled: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'cancelado' },
};

// Classes estáticas por tom (Tailwind JIT não detecta classes montadas dinamicamente).
const TONES: Record<string, string> = {
  teal: 'bg-teal-500/15 ring-teal-500/30 text-teal-300',
  emerald: 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-300',
  amber: 'bg-amber-500/15 ring-amber-500/30 text-amber-300',
  violet: 'bg-violet-500/15 ring-violet-500/30 text-violet-300',
};

const StatCard = ({ icon, label, value, hint, tone = 'teal' }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
      <span className={`grid place-items-center h-7 w-7 rounded-lg ring-1 ${TONES[tone] || TONES.teal}`}>{icon}</span>
      {label}
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {hint && <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>}
  </div>
);

const AffiliatePanel = () => {
  const router = useRouter();
  const { user, isLoading } = useUserContext();
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [dash, setDash] = useState<AffiliateDashboardDTO | null>(null);
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [redemptions, setRedemptions] = useState<AffiliateRedemptionDTO[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommissionDTO[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayoutDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAffiliate, setNotAffiliate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'commissions' | 'redemptions' | 'payouts'>('commissions');

  const loadDash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getAffiliateDashboard(period);
      if (res.data?.result === 1) { setDash(res.data.data); setErr(null); }
      else setErr(res.data?.message || 'Erro ao carregar painel.');
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNotAffiliate(true);
      else setErr(errorMessage(e, 'Erro ao carregar painel.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadLists = useCallback(async () => {
    try {
      const [c, r, cm, p] = await Promise.all([
        apiGateway.getAffiliateCoupons(),
        apiGateway.getAffiliateRedemptions({ limit: 15 }),
        apiGateway.getAffiliateCommissions({ limit: 15 }),
        apiGateway.getAffiliatePayouts({ limit: 15 }),
      ]);
      if (c.data?.result === 1) setCoupons(c.data.data.coupons || []);
      if (r.data?.result === 1) setRedemptions(r.data.data.redemptions || []);
      if (cm.data?.result === 1) setCommissions(cm.data.data.commissions || []);
      if (p.data?.result === 1) setPayouts(p.data.data.payouts || []);
    } catch { /* mostra o que carregou */ }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDash();
  }, [loadDash]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!notAffiliate) loadLists();
  }, [notAffiliate, loadLists]);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* ignore */ }
  };

  if (isLoading || loading) {
    return <div className="w-full px-3 sm:px-6 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  if (notAffiliate || (user && !user.isAffiliate && !dash)) {
    return (
      <div className="w-full px-3 sm:px-6 py-16">
        <div className="max-w-md mx-auto text-center rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="grid place-items-center h-14 w-14 mx-auto rounded-2xl bg-teal-500/15 ring-1 ring-teal-500/30 mb-4"><Handshake className="text-teal-300" size={26} /></div>
          <h1 className="text-lg font-bold text-white mb-1">Programa de Afiliados</h1>
          <p className="text-sm text-gray-400">Sua conta ainda não é afiliada. Fale com o suporte para participar do programa e começar a ganhar comissões indicando o ArbPrime.</p>
          <button onClick={() => router.push('/plans')} className="mt-5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">Ver planos</button>
        </div>
      </div>
    );
  }

  const aff = dash?.affiliate;
  const bal = dash?.balances;
  const totals = dash?.totals;
  const maxDaily = Math.max(1, ...(dash?.daily || []).map((d) => d.commissionCents));
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/plans` : '';
  const commissionLabel = aff ? (aff.commissionType === 'percent' ? `${aff.commissionValue}% por venda` : `${brlCents(Math.round(aff.commissionValue * 100))} por venda`) : '';

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Handshake className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Programa de Afiliados</h1>
            <p className="text-sm text-gray-400">Acompanhe suas indicações e comissões</p>
          </div>
        </div>
        {aff && !aff.isActive && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 bg-rose-500/15 text-rose-300 ring-rose-500/30">Conta suspensa</span>
        )}
      </header>

      {err && <div className="mb-4 text-sm px-4 py-2.5 rounded-xl ring-1 bg-rose-500/10 ring-rose-500/30 text-rose-200">{err}</div>}

      {/* Código + compartilhar */}
      {aff && (
        <div className="mb-6 rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-transparent p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div>
              <div className="text-xs text-gray-400 mb-1">Seu código de afiliado</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-wider text-white font-mono">{aff.code}</span>
                <button onClick={() => copy(aff.code, 'code')} className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200" title="Copiar código">
                  {copied === 'code' ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">Comissão configurada</div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-200"><TrendingUp size={15} /> {commissionLabel}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Liberação após {aff.holdDays} dia(s) de garantia</div>
            </div>
            <button onClick={() => copy(shareUrl, 'link')} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm inline-flex items-center gap-2 self-start">
              {copied === 'link' ? <Check size={15} className="text-emerald-300" /> : <Share2 size={15} />} Compartilhar link
            </button>
          </div>
        </div>
      )}

      {/* Saldos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Wallet size={15} />} label="Disponível" value={brlCents(bal?.availableCents || 0)} hint="Pronto para repasse" tone="emerald" />
        <StatCard icon={<Clock size={15} />} label="Pendente" value={brlCents(bal?.pendingCents || 0)} hint="Em período de garantia" tone="amber" />
        <StatCard icon={<BadgeCheck size={15} />} label="Já recebido" value={brlCents(bal?.paidCents || 0)} tone="teal" />
        <StatCard icon={<Users size={15} />} label="Indicações" value={String(totals?.totalReferrals || 0)} hint={`${totals?.totalRedemptions || 0} usos de cupom`} tone="violet" />
      </div>

      {/* Período + gráfico */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-white">Comissões no período</div>
            <div className="text-2xl font-bold text-teal-300">{brlCents(totals?.periodCommissionCents || 0)}</div>
            <div className="text-[11px] text-gray-500">{totals?.periodSalesCount || 0} venda(s) • {brlCents(totals?.periodSalesCents || 0)} em vendas</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-3 py-1.5 rounded-lg text-xs ring-1 transition ${period === p.key ? 'bg-teal-500/20 ring-teal-500/50 text-teal-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}>{p.label}</button>
            ))}
          </div>
        </div>
        {(dash?.daily?.length || 0) > 0 ? (
          <div className="flex items-end gap-1 h-28">
            {dash!.daily.map((d) => (
              <div key={d.date} className="flex-1 group relative flex flex-col items-center justify-end">
                <div className="w-full rounded-t bg-teal-500/60 hover:bg-teal-400 transition-all" style={{ height: `${Math.max(3, (d.commissionCents / maxDaily) * 100)}%` }} />
                <div className="absolute -top-7 hidden group-hover:block whitespace-nowrap text-[10px] bg-black/80 text-white px-1.5 py-0.5 rounded">{dateOnly(d.date)}: {brlCents(d.commissionCents)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-28 grid place-items-center text-sm text-gray-500">Sem comissões no período.</div>
        )}
      </div>

      {/* Cupons */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white"><Ticket size={16} className="text-teal-300" /> Seus cupons</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {coupons.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white">{c.code}</span>
                <button onClick={() => copy(c.code, `coupon-${c.id}`)} className="text-gray-400 hover:text-white">{copied === `coupon-${c.id}` ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}</button>
              </div>
              <div className="text-xs text-teal-300 mt-1">{c.discountType === 'percent' ? `${c.discountValue}% de desconto` : `${brlCents(Math.round(c.discountValue * 100))} de desconto`}</div>
              <div className="text-[11px] text-gray-500 mt-1">{c.timesRedeemed} uso(s){c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''} • {c.isActive ? 'ativo' : 'inativo'}</div>
            </div>
          ))}
          {coupons.length === 0 && <div className="text-sm text-gray-500">Nenhum cupom ainda.</div>}
        </div>
      </div>

      {/* Abas de histórico */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex border-b border-white/10">
          {([['commissions', 'Comissões'], ['redemptions', 'Usos de cupom'], ['payouts', 'Repasses']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-3 text-sm font-medium transition ${tab === k ? 'text-teal-300 border-b-2 border-teal-400 bg-white/5' : 'text-gray-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>

        {tab === 'commissions' && (
          <div className="divide-y divide-white/5">
            {commissions.map((c) => {
              const st = COMMISSION_STATUS[c.status] || COMMISSION_STATUS.pending;
              return (
                <div key={c.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white">{c.customer}</div>
                    <div className="text-[11px] text-gray-500">Cupom {c.couponCode || '—'} • venda {brlCents(c.baseAmountCents)}</div>
                  </div>
                  <span className="md:w-40 text-xs text-gray-400">{dateTime(c.createdAt)}</span>
                  {c.status === 'pending' && <span className="md:w-32 text-[11px] text-amber-300/80">libera {dateOnly(c.availableAt)}</span>}
                  <span className="md:w-28 md:text-right text-sm font-semibold text-emerald-300">{brlCents(c.amountCents)}</span>
                  <span className="md:w-24 md:text-center"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span></span>
                </div>
              );
            })}
            {commissions.length === 0 && <div className="px-4 py-12 text-center text-gray-500 text-sm">Nenhuma comissão ainda.</div>}
          </div>
        )}

        {tab === 'redemptions' && (
          <div className="divide-y divide-white/5">
            {redemptions.map((r) => (
              <div key={r.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white">{r.customer}</div>
                  <div className="text-[11px] text-gray-500">Cupom {r.couponCode}</div>
                </div>
                <span className="md:w-40 text-xs text-gray-400">{dateTime(r.createdAt)}</span>
                <span className="md:w-28 md:text-right text-xs text-teal-300">−{brlCents(r.discountAmountCents)}</span>
                <span className="md:w-28 md:text-right text-sm font-semibold text-white">{brlCents(r.finalAmountCents)}</span>
              </div>
            ))}
            {redemptions.length === 0 && <div className="px-4 py-12 text-center text-gray-500 text-sm">Nenhum uso de cupom ainda.</div>}
          </div>
        )}

        {tab === 'payouts' && (
          <div className="divide-y divide-white/5">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white inline-flex items-center gap-2"><ArrowDownToLine size={14} className="text-teal-300" /> Repasse {p.method.toUpperCase()}</div>
                  <div className="text-[11px] text-gray-500">{p.commissionsCount} comissão(ões){p.reference ? ` • ref ${p.reference}` : ''}</div>
                </div>
                <span className="md:w-40 text-xs text-gray-400">{dateTime(p.createdAt)}</span>
                <span className="md:w-28 md:text-right text-sm font-semibold text-teal-300">{brlCents(p.amountCents)}</span>
              </div>
            ))}
            {payouts.length === 0 && <div className="px-4 py-12 text-center text-gray-500 text-sm">Nenhum repasse recebido ainda.</div>}
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-gray-600 flex items-center gap-1.5"><ShieldCheck size={13} /> A comissão é calculada sobre o valor pago e liberada após o período de garantia.</p>
    </div>
  );
};

export default AffiliatePanel;
