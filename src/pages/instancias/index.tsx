import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useBetInstances } from '@/hooks/useBetInstances';
import { apiGateway } from '@/gateways/api.gateway';
import { BetInstance } from '@/interfaces/betinstance.interface';
import { statusMeta, SUPPORTED_HOUSES, houseName } from '@/utils/betInstanceUi';
import { ProxySelect } from '@/components/instancias/ProxySelect';
import { Bot, Play, Pause, Square, Plus, Settings2, Loader2, X, ShieldCheck, ShieldAlert } from 'lucide-react';

const errMsg = (e: unknown, fb: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

const inputCls =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition';

function StatusBadge({ status }: { status: BetInstance['status'] }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

export default function InstancesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserContext();
  const { data: instances, loading } = useBetInstances(isAuthenticated);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const act = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try { await fn(); } catch (e) { alert(errMsg(e, 'Falha na ação.')); } finally { setBusy(null); }
  }, []);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Bot className="mx-auto text-cyan-300" size={28} />
          <h1 className="mt-3 text-lg font-bold text-white">Instâncias de Bet</h1>
          <p className="mt-1 text-sm text-gray-400">Entre para criar instâncias que apostam value bets automaticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 ring-1 ring-cyan-500/30">
            <Bot className="text-cyan-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Instâncias</h1>
            <p className="text-sm text-gray-400">Robôs que logam na casa e apostam value bets automaticamente.</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-white transition">
          <Plus size={16} /> Nova instância
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Carregando…</div>
      ) : instances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-gray-400">
          Nenhuma instância ainda. Crie a primeira em <span className="text-cyan-300">Nova instância</span>.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {instances.map((inst) => {
            const running = inst.desiredState === 'running';
            const b = busy === inst.id;
            return (
              <div key={inst.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{inst.name}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">{inst.bookmakerSlug}</div>
                  </div>
                  <StatusBadge status={inst.status} />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className={`rounded-md px-2 py-0.5 ring-1 ${inst.config.dryRun ? 'bg-white/5 text-gray-400 ring-white/10' : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'}`}>
                    {inst.config.dryRun ? 'DRY-RUN' : 'AO VIVO'}
                  </span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-gray-400 ring-1 ring-white/10">tiers {inst.config.tiers.join(',') || '—'}</span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-gray-400 ring-1 ring-white/10">edge ≥ {inst.config.edgeMin}%</span>
                  {!inst.hasCredentials && <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-rose-300 ring-1 ring-rose-500/30">sem login</span>}
                </div>

                {inst.lastError && <div className="mt-2 truncate text-[11px] text-rose-300/80" title={inst.lastError}>⚠ {inst.lastError}</div>}

                <div className="mt-4 flex items-center gap-2">
                  {running ? (
                    <button disabled={b} onClick={() => act(inst.id, () => apiGateway.pauseInstance(inst.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 transition">
                      {b ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />} Pausar
                    </button>
                  ) : (
                    <button disabled={b || !inst.hasCredentials} onClick={() => act(inst.id, () => apiGateway.startInstance(inst.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-50 transition">
                      {b ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Iniciar
                    </button>
                  )}
                  {inst.desiredState !== 'stopped' && (
                    <button disabled={b} onClick={() => act(inst.id, () => apiGateway.stopInstance(inst.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50 transition" title="Parar">
                      <Square size={14} />
                    </button>
                  )}
                  <button onClick={() => router.push(`/instancias/${inst.id}`)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-white/10 hover:bg-white/10 transition">
                    <Settings2 size={14} /> Configurar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewInstanceModal onClose={() => setShowNew(false)} onCreated={(id) => router.push(`/instancias/${id}`)} />}
    </div>
  );
}

function NewInstanceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [bookmakerSlug, setBookmakerSlug] = useState('betano');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [proxyId, setProxyId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hn = houseName(bookmakerSlug);

  const doTest = async () => {
    setTesting(true); setTest(null);
    try {
      const r = await apiGateway.testInstanceLogin({ username, password, proxyId: proxyId || undefined });
      const d = r.data?.data as { ok: boolean; kind?: string; customerId?: number };
      setTest(d?.ok ? { ok: true, text: `Login OK (id ${d.customerId})` } : { ok: false, text: `Falhou: ${d?.kind || '?'}` });
    } catch (e) { setTest({ ok: false, text: errMsg(e, 'Erro no teste.') }); } finally { setTesting(false); }
  };

  const doCreate = async () => {
    setCreating(true); setError(null);
    try {
      const r = await apiGateway.createInstance({ name, bookmakerSlug, username: username || undefined, password: password || undefined, config: { proxyId } });
      if (r.data?.result === 1) onCreated((r.data.data as BetInstance).id);
      else setError(r.data?.message || 'Erro ao criar.');
    } catch (e) { setError(errMsg(e, 'Erro ao criar.')); } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-brand-dark p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Nova instância</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs text-gray-400">Casa de aposta
            <select value={bookmakerSlug} onChange={(e) => setBookmakerSlug(e.target.value)} className={`${inputCls} mt-1`}>
              {SUPPORTED_HOUSES.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
            </select>
          </label>
          <label className="block text-xs text-gray-400">Nome
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Ex.: ${hn} Value #1`} className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-gray-400">Usuário {hn}
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs text-gray-400">Senha {hn}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${inputCls} mt-1`} />
          </label>
          <ProxySelect value={proxyId} onChange={setProxyId} getCreds={() => ({ username, password })} />

          <div className="flex items-center gap-2">
            <button disabled={testing || !username || !password} onClick={doTest} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50 transition">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Testar login
            </button>
            {test && (
              <span className={`inline-flex items-center gap-1 text-xs ${test.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                {test.ok ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />} {test.text}
              </span>
            )}
          </div>

          {error && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">{error}</div>}
          <p className="text-[11px] text-gray-500">A instância nasce parada e em <span className="text-cyan-300">DRY-RUN</span>. Ajuste tiers, stake e limites em Configurar antes de tirar o dry-run.</p>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition">Cancelar</button>
            <button disabled={creating || !name.trim()} onClick={doCreate} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 transition">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
