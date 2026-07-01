import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useBetInstances } from '@/hooks/useBetInstances';
import { apiGateway } from '@/gateways/api.gateway';
import { BetInstance, BetInstanceConfig } from '@/interfaces/betinstance.interface';
import { statusMeta, timeAgo } from '@/utils/betInstanceUi';
import { ProxySelect } from '@/components/instancias/ProxySelect';
import { InstanceLog } from '@/components/instancias/InstanceLog';
import { ArrowLeft, Play, Pause, Square, Save, Loader2, Bot, Trash2, ShieldCheck, ShieldAlert, Wallet, RefreshCw, RotateCw, Clock, AlertTriangle } from 'lucide-react';

const errMsg = (e: unknown, fb: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

const inputCls = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition';

function NumField({ label, value, onChange, step = '0.01', hint }: { label: string; value: number; onChange: (v: number) => void; step?: string; hint?: string }) {
  return (
    <label className="block text-xs text-gray-400">{label}
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(parseFloat(e.target.value))} className={`${inputCls} mt-1 tabular-nums`} />
      {hint && <span className="mt-0.5 block text-[10px] text-cyan-300/70">{hint}</span>}
    </label>
  );
}
function NullNumField({ label, value, onChange, step = '1' }: { label: string; value: number | null; onChange: (v: number | null) => void; step?: string }) {
  return (
    <label className="block text-xs text-gray-400">{label} <span className="text-gray-600">(vazio = sem limite)</span>
      <input type="number" step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className={`${inputCls} mt-1 tabular-nums`} />
    </label>
  );
}
function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:bg-black/30">
      <span><span className="text-sm text-white">{label}</span>{hint && <span className="block text-[11px] text-gray-500">{hint}</span>}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-cyan-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>
    {children}
  </section>
);

type Tab = 'valuebet' | 'stake' | 'advanced' | 'account';
type ClvRow = { key: string; n: number; clvAvgPct: number | null; clvPositivePct: number | null };
type BankrollLite = { id: string; name: string; kind: string; currency: string; currentBalance: number };
type AccountLite = { id: string; slug: string; label?: string | null; balance?: number };
type BalanceInfo = { cash: number; betting: number; bonus: number; total: number; openBetsCount: number; openBetsBalance: number; currency: string; symbol: string; fetchedAt: number };
type SessionInfo = { loggedAt: string; ageMs: number; maxAgeMs: number; customerId?: number };
type BalanceResp = { balance: BalanceInfo | null; session: SessionInfo | null; live: boolean; liveError: string | null; hasSession: boolean };

export default function InstanceDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const { isAuthenticated } = useUserContext();
  const { data: liveList } = useBetInstances(isAuthenticated);
  const live = useMemo(() => liveList.find((i) => i.id === id), [liveList, id]);

  const [inst, setInst] = useState<BetInstance | null>(null);
  const [name, setName] = useState('');
  const [cfg, setCfg] = useState<BetInstanceConfig | null>(null);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [banks, setBanks] = useState<BankrollLite[]>([]);
  const [accts, setAccts] = useState<AccountLite[]>([]);
  const [bankrollId, setBankrollId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [clv, setClv] = useState<Record<string, ClvRow>>({});
  const [tab, setTab] = useState<Tab>('valuebet');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [bal, setBal] = useState<BalanceResp | null>(null);
  const [balLoading, setBalLoading] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await apiGateway.getInstance(id);
      if (r.data?.result === 1) {
        const d = r.data.data as BetInstance;
        setInst(d); setName(d.name); setCfg(d.config);
        setBankrollId(d.bankrollId ?? ''); setAccountId(d.accountId ?? '');
        setCreds({ username: d.username ?? '', password: '' });
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiGateway.getBankrolls().then((r) => { if (r.data?.result === 1) setBanks(r.data.data as BankrollLite[]); }).catch(() => {});
    apiGateway.getMyAccounts().then((r) => { if (r.data?.result === 1) setAccts(r.data.data as AccountLite[]); }).catch(() => {});
  }, []);
  useEffect(() => {
    apiGateway.getClvBreakdown('tier', 30).then((r) => {
      if (r.data?.result === 1) {
        const rows = (r.data.data?.rows || []) as ClvRow[];
        setClv(Object.fromEntries(rows.map((x) => [String(x.key), x])));
      }
    }).catch(() => {});
  }, []);

  const patch = (p: Partial<BetInstanceConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));
  const toggleTier = (t: number) => patch({ tiers: cfg!.tiers.includes(t) ? cfg!.tiers.filter((x) => x !== t) : [...cfg!.tiers, t].sort() });

  const save = async () => {
    if (!cfg) return;
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { name, config: cfg, bankrollId: bankrollId || null, accountId: accountId || null };
      if (creds.username && creds.password) { body.username = creds.username; body.password = creds.password; }
      const r = await apiGateway.updateInstance(id, body);
      if (r.data?.result === 1) { const d = r.data.data as BetInstance; setInst(d); setCfg(d.config); setCreds({ username: '', password: '' }); setMsg({ type: 'ok', text: 'Configuração salva.' }); }
      else setMsg({ type: 'err', text: r.data?.message || 'Erro ao salvar.' });
    } catch (e) { setMsg({ type: 'err', text: errMsg(e, 'Erro ao salvar.') }); } finally { setSaving(false); }
  };

  const control = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load(); } catch (e) { alert(errMsg(e, 'Falha.')); } finally { setBusy(false); } };

  const doTest = async () => {
    setTesting(true); setTest(null);
    try {
      const body = creds.username && creds.password ? { username: creds.username, password: creds.password, proxyId: cfg?.proxyId || undefined } : { instanceId: id };
      const r = await apiGateway.testInstanceLogin(body);
      const d = r.data?.data as { ok: boolean; kind?: string; customerId?: number };
      setTest(d?.ok ? { ok: true, text: `Login OK (id ${d.customerId})` } : { ok: false, text: `Falhou: ${d?.kind || '?'}` });
    } catch (e) { setTest({ ok: false, text: errMsg(e, 'Erro.') }); } finally { setTesting(false); }
  };

  const doDelete = async () => {
    if (!confirm('Remover esta instância?')) return;
    try { await apiGateway.deleteInstance(id); router.push('/instancias'); } catch (e) { alert(errMsg(e, 'Falha ao remover.')); }
  };

  const loadBalance = useCallback(async (live = false) => {
    if (!id) return;
    setBalLoading(true);
    try {
      const r = await apiGateway.getInstanceBalance(id, live);
      if (r.data?.result === 1) setBal(r.data.data as BalanceResp);
    } catch { /* silencioso */ } finally { setBalLoading(false); }
  }, [id]);

  useEffect(() => { if (tab === 'account') void loadBalance(false); }, [tab, loadBalance]);

  const doRenew = async () => {
    setRenewing(true); setMsg(null);
    try {
      await apiGateway.renewInstanceSession(id);
      setMsg({ type: 'ok', text: 'Renovação solicitada — a sessão será refeita no próximo ciclo.' });
      setTimeout(() => void loadBalance(false), 4000);
    } catch (e) { setMsg({ type: 'err', text: errMsg(e, 'Falha ao renovar.') }); } finally { setRenewing(false); }
  };

  const ensureVbBanca = async () => {
    try {
      const r = await apiGateway.ensureValuebetBankroll();
      if (r.data?.result === 1) { const b = r.data.data as BankrollLite; setBanks((prev) => (prev.some((x) => x.id === b.id) ? prev : [...prev, b])); setBankrollId(b.id); }
    } catch { /* */ }
  };

  if (loading || !cfg || !inst) {
    return <div className="w-full px-3 sm:px-6 py-6"><div className="flex items-center justify-center gap-2 py-20 text-gray-400"><Loader2 className="animate-spin" size={18} /> Carregando…</div></div>;
  }

  const status = live?.status ?? inst.status;
  const desired = live?.desiredState ?? inst.desiredState;
  const sm = statusMeta(status);
  const running = desired === 'running';

  const b = bal?.balance ?? null;
  const sess = bal?.session ?? null;
  const sym = b?.symbol ?? 'R$';
  const lowBal = b != null && b.cash < cfg.minStake;
  const renewInH = sess ? Math.max(0, (sess.maxAgeMs - sess.ageMs) / 3600000) : null;
  const ageH = sess ? sess.ageMs / 3600000 : null;

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <button onClick={() => router.push('/instancias')} className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-cyan-200"><ArrowLeft size={15} /> Instâncias</button>

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 ring-1 ring-cyan-500/30"><Bot className="text-cyan-300" size={22} /></div>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-white">{inst.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${sm.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />{sm.label}</span>
            </div>
            <p className="text-xs text-gray-500">{inst.bookmakerSlug} · último sinal {timeAgo(live?.lastHeartbeatAt ?? inst.lastHeartbeatAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button disabled={busy} onClick={() => control(() => apiGateway.pauseInstance(id))} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Pause size={15} />} Pausar</button>
          ) : (
            <button disabled={busy || !inst.hasCredentials} onClick={() => control(() => apiGateway.startInstance(id))} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Iniciar</button>
          )}
          {desired !== 'stopped' && <button disabled={busy} onClick={() => control(() => apiGateway.stopInstance(id))} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"><Square size={15} /></button>}
          <button onClick={doDelete} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 text-gray-400 ring-1 ring-white/10 hover:text-rose-300 hover:bg-rose-500/10" title="Remover"><Trash2 size={15} /></button>
        </div>
      </header>

      {(live?.lastError || inst.lastError) && <div className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">⚠ {live?.lastError || inst.lastError}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* CONFIG */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-1 rounded-lg bg-white/5 p-1 text-sm">
            {([['valuebet', 'Valuebet'], ['stake', 'Stake'], ['advanced', 'Avançado'], ['account', 'Conta']] as [Tab, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${tab === k ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40' : 'text-gray-400 hover:text-white'}`}>{lbl}</button>
            ))}
          </div>

          {tab === 'valuebet' && (
            <>
              <Section title="Tiers — quebra de CLV atual (30d)">
                <p className="mb-3 text-[11px] text-gray-500">Escolha os tiers que a instância aposta. O CLV histórico ajuda a decidir (positivo = pegou odd melhor que o fechamento).</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((t) => {
                    const on = cfg.tiers.includes(t); const c = clv[String(t)];
                    return (
                      <button key={t} onClick={() => toggleTier(t)} className={`rounded-lg border p-3 text-left transition ${on ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'}`}>
                        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">Tier {t}</span>{on && <span className="text-[10px] text-cyan-300">ativo</span>}</div>
                        <div className="mt-1 text-[11px] text-gray-400">{t === 1 ? 'Pinnacle núcleo' : t === 2 ? 'Pinnacle secundário' : 'Consenso'}</div>
                        {c ? (
                          <div className="mt-2 space-y-0.5">
                            <div className={`text-sm font-bold ${(c.clvAvgPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>CLV {c.clvAvgPct == null ? '—' : `${c.clvAvgPct.toFixed(2)}%`}</div>
                            <div className="text-[10px] text-gray-500">{c.n} apostas · {c.clvPositivePct == null ? '—' : `${c.clvPositivePct.toFixed(0)}% positivo`}</div>
                          </div>
                        ) : <div className="mt-2 text-[10px] text-gray-600">sem dados</div>}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title="Filtros de entrada">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <NumField label="Edge mín. (%)" step="0.1" value={cfg.edgeMin} onChange={(v) => patch({ edgeMin: v })} />
                  <NumField label="Odd mínima" step="0.05" value={cfg.oddMin} onChange={(v) => patch({ oddMin: v })} />
                  <NumField label="Odd máxima" step="0.1" value={cfg.oddMax} onChange={(v) => patch({ oddMax: v })} />
                  <NumField label="Confiança mín." step="0.05" value={cfg.confidenceMin} onChange={(v) => patch({ confidenceMin: v })} hint={`${(cfg.confidenceMin * 100).toFixed(0)}%`} />
                </div>
              </Section>
            </>
          )}

          {tab === 'stake' && (
            <>
            <Section title="Banca (Analytix)">
              <p className="mb-3 text-[11px] text-gray-500">Onde a instância registra as apostas e de onde calcula o stake (fração × saldo). Vazio = usa/cria a Banca Value Bet.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-gray-400">Banca
                  <select value={bankrollId} onChange={(e) => setBankrollId(e.target.value)} className={`${inputCls} mt-1`}>
                    <option value="">Auto — Banca Value Bet</option>
                    {banks.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.kind} · R$ {Number(b.currentBalance ?? 0).toFixed(2)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-400">Conta da casa <span className="text-gray-600">(opcional, p/ saldo)</span>
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${inputCls} mt-1`}>
                    <option value="">Nenhuma</option>
                    {accts.map((a) => <option key={a.id} value={a.id}>{a.label || a.slug}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" onClick={ensureVbBanca} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-white/10 transition">
                <Wallet size={13} /> Criar/usar Banca Value Bet
              </button>
            </Section>
            <Section title="Dimensionamento do stake">
              <div className="mb-3 flex gap-1 rounded-lg bg-black/20 p-1 text-xs w-fit">
                {(['kelly', 'flat'] as const).map((m) => (
                  <button key={m} onClick={() => patch({ stakeMode: m })} className={`rounded-md px-3 py-1 font-medium capitalize ${cfg.stakeMode === m ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40' : 'text-gray-400'}`}>{m}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cfg.stakeMode === 'kelly'
                  ? <NumField label="Multiplicador de Kelly" step="0.05" value={cfg.kellyMultiplier} onChange={(v) => patch({ kellyMultiplier: v })} hint="sobre a fração Kelly já sugerida" />
                  : <NumField label="Valor fixo (R$)" step="0.5" value={cfg.flatStake ?? 0} onChange={(v) => patch({ flatStake: v })} />}
                <NumField label="Stake mínimo (R$)" step="0.5" value={cfg.minStake} onChange={(v) => patch({ minStake: v })} />
                <NumField label="Stake máx./aposta (R$)" step="0.5" value={cfg.maxStakePerBet} onChange={(v) => patch({ maxStakePerBet: v })} />
                <label className="block text-xs text-gray-400">Arredondar stake
                  <select value={cfg.stakeRounding} onChange={(e) => patch({ stakeRounding: Number(e.target.value) })} className={`${inputCls} mt-1`}>
                    <option value={0}>Sem arredondar (centavos)</option>
                    <option value={0.5}>Múltiplo de R$ 0,50</option>
                    <option value={1}>Múltiplo de R$ 1</option>
                    <option value={2}>Múltiplo de R$ 2</option>
                    <option value={5}>Múltiplo de R$ 5</option>
                    <option value={10}>Múltiplo de R$ 10</option>
                  </select>
                </label>
              </div>
            </Section>
            </>
          )}

          {tab === 'advanced' && (
            <>
              <Section title="Operação">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumField label="Intervalo do loop (s)" step="1" value={cfg.pollIntervalSec} onChange={(v) => patch({ pollIntervalSec: v })} />
                  <label className="block text-xs text-gray-400">Escopo de dedupe
                    <select value={cfg.dedupeScope} onChange={(e) => patch({ dedupeScope: e.target.value as BetInstanceConfig['dedupeScope'] })} className={`${inputCls} mt-1`}>
                      <option value="perEvent">1 por evento</option>
                      <option value="perEventSelection">1 por seleção</option>
                      <option value="perEmission">1 por emissão</option>
                    </select>
                  </label>
                  <NumField label="Máx. apostas/evento" step="1" value={cfg.maxBetsPerEvent} onChange={(v) => patch({ maxBetsPerEvent: v })} />
                  <NullNumField label="Só jogos até (dias)" step="1" value={cfg.maxEventDays} onChange={(v) => patch({ maxEventDays: v })} />
                </div>
                <div className="mt-3">
                  <ProxySelect value={cfg.proxyId} onChange={(pid) => patch({ proxyId: pid })} getCreds={() => ({ username: creds.username, password: creds.password })} />
                </div>
              </Section>
              <Section title="Limites de segurança">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NullNumField label="Máx. apostas/dia" value={cfg.maxBetsPerDay} onChange={(v) => patch({ maxBetsPerDay: v })} />
                  <NullNumField label="Máx. stake/dia (R$)" step="1" value={cfg.maxStakePerDay} onChange={(v) => patch({ maxStakePerDay: v })} />
                  <NullNumField label="Stop-loss/dia (R$)" step="1" value={cfg.stopLossDay} onChange={(v) => patch({ stopLossDay: v })} />
                </div>
              </Section>
              <Section title="Resiliência">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-gray-400">Política de reinício
                    <select value={cfg.restartPolicy} onChange={(e) => patch({ restartPolicy: e.target.value as BetInstanceConfig['restartPolicy'] })} className={`${inputCls} mt-1`}>
                      <option value="on-failure">Em falha</option>
                      <option value="always">Sempre</option>
                      <option value="never">Nunca</option>
                    </select>
                  </label>
                  <NumField label="Máx. tentativas (0 = ∞)" step="1" value={cfg.maxRetries} onChange={(v) => patch({ maxRetries: v })} />
                </div>
                <div className="mt-3"><Toggle label="Modo DRY-RUN" on={cfg.dryRun} onChange={(v) => patch({ dryRun: v })} hint="Simula: monta a aposta e loga, mas NÃO efetiva nem grava. Desligue para apostar de verdade." /></div>
              </Section>
            </>
          )}

          {tab === 'account' && (
            <>
            <Section title="Saldo & sessão da casa">
              {!bal?.hasSession && !balLoading ? (
                <p className="text-[11px] text-gray-500">Sem sessão ativa. Inicie a instância para logar na casa e ler o saldo real.</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400"><Wallet size={13} /> Saldo para apostar</div>
                      <div className={`mt-1 text-2xl font-bold tabular-nums ${lowBal ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {b ? `${sym}${b.cash.toFixed(2)}` : (balLoading ? '…' : '—')}
                      </div>
                      {b && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                          <span>Bônus {sym}{b.bonus.toFixed(2)}</span>
                          <span>Abertas {b.openBetsCount} ({sym}{b.openBetsBalance.toFixed(2)})</span>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400"><Clock size={13} /> Sessão</div>
                      {sess ? (
                        <>
                          <div className="mt-1 text-sm text-white">Logado há <span className="font-semibold tabular-nums">{ageH! < 1 ? `${Math.round(ageH! * 60)}min` : `${ageH!.toFixed(1)}h`}</span></div>
                          <div className="mt-0.5 text-[10px] text-gray-500">{renewInH != null && renewInH > 0 ? `renova automático em ~${renewInH.toFixed(1)}h (limite 23h da casa)` : 'renovando na próxima volta…'}{sess.customerId ? ` · id ${sess.customerId}` : ''}</div>
                        </>
                      ) : <div className="mt-1 text-sm text-gray-500">—</div>}
                    </div>
                  </div>
                  {lowBal && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
                      <AlertTriangle size={14} className="mt-px shrink-0" />
                      <span>Saldo abaixo do stake mínimo ({sym}{cfg.minStake.toFixed(2)}). A instância <b>pausa as apostas</b> até recarregar — assim não fica martelando a casa (o que gerava os erros 429/422).</span>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button disabled={balLoading} onClick={() => loadBalance(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50">{balLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar saldo</button>
                    <button disabled={renewing || !bal?.hasSession} onClick={doRenew} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-white/10 disabled:opacity-50">{renewing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />} Renovar sessão</button>
                    {bal?.liveError && <span className="text-[11px] text-rose-300">falha ao ler ao vivo: {bal.liveError}</span>}
                    {b && <span className="text-[10px] text-gray-600">atualizado {timeAgo(new Date(b.fetchedAt).toISOString())}</span>}
                  </div>
                </>
              )}
            </Section>
            <Section title="Credenciais da casa">
              <p className="mb-3 text-[11px] text-gray-500">{inst.hasCredentials ? 'Login definido ✓ (mostrado abaixo). A senha fica em branco por segurança — para trocar, preencha usuário E senha.' : 'Defina usuário e senha para poder iniciar.'} Guardadas cifradas; a senha nunca é exibida.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-gray-400">Usuário<input value={creds.username} onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))} autoComplete="off" className={`${inputCls} mt-1`} /></label>
                <label className="block text-xs text-gray-400">Senha<input type="password" value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} autoComplete="new-password" className={`${inputCls} mt-1`} /></label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button disabled={testing} onClick={doTest} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50">{testing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Testar login</button>
                {test && <span className={`inline-flex items-center gap-1 text-xs ${test.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{test.ok ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />} {test.text}</span>}
              </div>
            </Section>
            </>
          )}

          {msg && <div className={`rounded-lg px-3 py-2 text-xs ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/10 text-rose-300 ring-rose-500/30'}`}>{msg.text}</div>}
          <div className="flex justify-end"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar</button></div>
        </div>

        {/* LOG AO VIVO */}
        <div className="lg:col-span-1">
          <InstanceLog instanceId={id} />
        </div>
      </div>
    </div>
  );
}
