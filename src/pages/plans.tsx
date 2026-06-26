import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGateway, PlanDTO, SubscriptionInfoDTO, CheckoutDTO } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import {
  CreditCard, Check, Loader2, X, Copy, Gift, ShieldCheck, Clock, Sparkles, QrCode, BadgeCheck
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// ===================== Modal de checkout PIX =====================

const CheckoutModal = ({ plan, onClose, onPaid }: { plan: PlanDTO; onClose: () => void; onPaid: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<CheckoutDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGateway.createCheckout(plan.id);
        if (!mounted) return;
        if (res.data?.result === 1) {
          setCheckout(res.data.data);
          setStatus(res.data.data.status);
        } else {
          setError(res.data?.message || 'Erro ao gerar cobrança.');
        }
      } catch (e: unknown) {
        if (mounted) setError(errorMessage(e, 'Erro ao gerar cobrança PIX.'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; stopPolling(); };
  }, [plan.id]);

  // Polling do status após gerar a cobrança.
  useEffect(() => {
    if (!checkout?.txid || status === 'completed') return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiGateway.getCheckoutStatus(checkout.txid);
        if (res.data?.result === 1) {
          const st = res.data.data.status;
          setStatus(st);
          if (st === 'completed') { stopPolling(); onPaid(); }
          else if (st === 'cancelled' || st === 'failed') stopPolling();
        }
      } catch { /* silencioso, tenta de novo */ }
    }, 4000);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout?.txid, status]);

  const copy = async () => {
    if (!checkout?.pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(checkout.pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <div className="flex items-center gap-2 mb-1">
          <QrCode className="text-teal-300" size={20} />
          <h2 className="text-lg font-bold text-white">Pagar com PIX</h2>
        </div>
        <p className="text-xs text-gray-400 mb-5">{plan.name} — {brl(plan.finalPrice)}</p>

        {loading ? (
          <div className="py-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-3" /> Gerando cobrança...</div>
        ) : error ? (
          <div className="py-8 text-center">
            <div className="bg-rose-500/10 ring-1 ring-rose-500/30 text-rose-200 rounded-xl px-4 py-3 text-sm">{error}</div>
          </div>
        ) : status === 'completed' ? (
          <div className="py-10 text-center">
            <div className="grid place-items-center h-16 w-16 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 mx-auto mb-4">
              <BadgeCheck className="text-emerald-300" size={34} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Pagamento confirmado!</h3>
            <p className="text-sm text-gray-400 mb-5">Sua assinatura {plan.name} foi ativada.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">Concluir</button>
          </div>
        ) : (
          <div className="space-y-4">
            {checkout?.pixQrCodeImage && (
              <div className="bg-white rounded-xl p-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={checkout.pixQrCodeImage} alt="QR Code PIX" className="w-48 h-48 object-contain" />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">PIX Copia e Cola</label>
              <div className="flex items-stretch gap-2">
                <input readOnly value={checkout?.pixCopiaECola || ''} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 font-mono truncate" />
                <button onClick={copy} className="px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold inline-flex items-center gap-1.5 text-sm">
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-amber-200 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-xl px-3 py-2.5">
              <Loader2 className="animate-spin" size={15} /> Aguardando pagamento...
            </div>
            <p className="text-[11px] text-gray-500 text-center">A liberação é automática assim que o pagamento for compensado. Pode deixar esta janela aberta.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ===================== Card de plano =====================

const PlanCard = ({ plan, current, onSubscribe }: { plan: PlanDTO; current: boolean; onSubscribe: (p: PlanDTO) => void }) => {
  const featured = plan.durationInDays >= 30;
  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col ${featured ? 'border-teal-500/50 bg-gradient-to-b from-teal-500/10 to-transparent ring-1 ring-teal-500/30' : 'border-white/10 bg-white/5'}`}>
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-teal-500 text-slate-900 text-[11px] font-bold px-3 py-1">
          <Sparkles size={12} /> MAIS POPULAR
        </span>
      )}
      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
      <p className="text-sm text-gray-400 mt-1 min-h-[40px]">{plan.description}</p>

      <div className="mt-4">
        {plan.hasPromotion && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 line-through">{brl(plan.price)}</span>
            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/30 rounded-full px-2 py-0.5">
              -{plan.promotionType === 'percent' ? `${plan.promotionValue}%` : brl(plan.discount)}
            </span>
          </div>
        )}
        <div className="flex items-end gap-1 mt-1">
          <span className="text-3xl font-extrabold text-white">{brl(plan.finalPrice)}</span>
          <span className="text-sm text-gray-400 mb-1">/ {plan.durationInDays} dias</span>
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-gray-300 flex-1">
        <li className="flex items-center gap-2"><Check size={15} className="text-teal-300 shrink-0" /> Acesso completo por {plan.durationInDays} dias</li>
        <li className="flex items-center gap-2"><Check size={15} className="text-teal-300 shrink-0" /> Surebets em tempo real</li>
        <li className="flex items-center gap-2"><Check size={15} className="text-teal-300 shrink-0" /> Calculadoras e filtros</li>
        <li className="flex items-center gap-2"><Check size={15} className="text-teal-300 shrink-0" /> Suporte prioritário</li>
      </ul>

      <button
        onClick={() => onSubscribe(plan)}
        disabled={current}
        className={`mt-6 w-full py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-2 transition ${
          current
            ? 'bg-white/5 text-gray-400 cursor-default ring-1 ring-white/10'
            : featured
              ? 'bg-teal-500 hover:bg-teal-400 text-slate-900'
              : 'bg-white/10 hover:bg-white/15 text-white'
        }`}
      >
        {current ? <><ShieldCheck size={16} /> Plano atual</> : <><CreditCard size={16} /> Assinar agora</>}
      </button>
    </div>
  );
};

// ===================== Página =====================

const PlansPage = () => {
  const { isAuthenticated } = useUserContext();
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [sub, setSub] = useState<SubscriptionInfoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDTO | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const plansRes = await apiGateway.getPlans();
      if (plansRes?.data?.result === 1) setPlans(plansRes.data.data || []);
      if (isAuthenticated) {
        const subRes = await apiGateway.getMySubscription();
        if (subRes?.data?.result === 1) setSub(subRes.data.data || null);
      } else {
        setSub(null);
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar planos.') });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSubscribe = (plan: PlanDTO) => {
    if (!isAuthenticated) { setMsg({ type: 'err', text: 'Faça login para assinar um plano.' }); return; }
    setCheckoutPlan(plan);
  };

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      const res = await apiGateway.activateTrial();
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Teste ativado.' });
      if (res.data?.result === 1) await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao ativar teste.') });
    } finally {
      setTrialLoading(false);
    }
  };

  const currentPlanId = sub?.subscription?.plan?.id || null;
  const trialAvailable = !!sub?.trial?.available;

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
          <CreditCard className="text-teal-300" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Planos</h1>
          <p className="text-sm text-gray-400">Escolha o plano ideal e libere o acesso completo ao ArbPrime</p>
        </div>
      </header>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Status da assinatura atual */}
      {isAuthenticated && sub?.hasActivePlan && sub.subscription && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-emerald-200">
            <ShieldCheck size={18} />
            <span className="font-semibold">Assinatura ativa: {sub.subscription.plan?.name || '—'}{sub.subscription.isTrial ? ' (teste)' : ''}</span>
          </div>
          <span className="text-sm text-emerald-100/80 inline-flex items-center gap-1.5"><Clock size={14} /> Expira em {formatDate(sub.subscription.expirationDate)}</span>
        </div>
      )}

      {/* Teste gratuito */}
      {isAuthenticated && trialAvailable && sub?.trial?.plan && (
        <div className="mb-6 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-violet-500/20 ring-1 ring-violet-500/40">
              <Gift className="text-violet-300" size={22} />
            </div>
            <div>
              <h3 className="font-bold text-white">Teste grátis por {sub.trial.plan.durationInDays} dias</h3>
              <p className="text-sm text-gray-400">Experimente todos os recursos sem custo. Uma vez por conta.</p>
            </div>
          </div>
          <button onClick={handleTrial} disabled={trialLoading} className="px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-semibold text-sm inline-flex items-center gap-2">
            {trialLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Ativar teste grátis
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-3" /> Carregando planos...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center">
          <CreditCard className="mx-auto text-gray-600 mb-3" size={32} />
          <p className="text-gray-400">Nenhum plano disponível no momento.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} current={p.id === currentPlanId} onSubscribe={handleSubscribe} />
          ))}
        </div>
      )}

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onPaid={() => { load(); }}
        />
      )}
    </div>
  );
};

export default PlansPage;
