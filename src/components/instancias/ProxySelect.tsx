import { useEffect, useState, useCallback } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { InstanceProxy, ProxyCheckResult } from '@/interfaces/betinstance.interface';
import { Loader2, ShieldCheck, ShieldAlert, RadioTower, Zap } from 'lucide-react';

/**
 * Seletor de proxy com VERIFICAÇÃO: lista os proxies e, ao clicar "Verificar",
 * roda o checkBetanoProxy (via login se houver creds) e marca quais FUNCIONAM
 * (vivo+Cloudflare+DataDome) + latência, ordenando os bons primeiro e auto-
 * selecionando o mais rápido. `getCreds` fornece user/senha p/ o teste de login.
 */
export function ProxySelect({
  value, onChange, getCreds,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  getCreds: () => { username: string; password: string };
}) {
  const [proxies, setProxies] = useState<InstanceProxy[]>([]);
  const [results, setResults] = useState<Record<string, ProxyCheckResult>>({});
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    apiGateway.getInstanceProxies()
      .then((r) => { if (r.data?.result === 1) setProxies(r.data.data as InstanceProxy[]); })
      .catch(() => {});
  }, []);

  const verify = useCallback(async () => {
    const c = getCreds();
    const withLogin = !!(c.username && c.password);
    setChecking(true); setNote(null);
    try {
      const r = await apiGateway.checkInstanceProxies({ username: c.username, password: c.password, withLogin });
      const rows = (r.data?.data || []) as ProxyCheckResult[];
      setResults(Object.fromEntries(rows.map((x) => [x.id, x])));
      const ok = rows.filter((x) => x.functional).length;
      setNote(`${ok}/${rows.length} funcionando${withLogin ? ' (login testado)' : ' (só liveness — preencha login p/ testar DataDome)'}`);
      const best = rows.find((x) => x.functional);
      if (best) onChange(best.id);
    } catch {
      setNote('Falha ao verificar.');
    } finally {
      setChecking(false);
    }
  }, [getCreds, onChange]);

  // ordena: funcional > desconhecido > falho; dentro, por latência
  const ordered = [...proxies].sort((a, b) => {
    const ra = results[a.id], rb = results[b.id];
    const sa = ra ? (ra.functional ? 0 : 2) : 1;
    const sb = rb ? (rb.functional ? 0 : 2) : 1;
    return sa - sb || ((ra?.latencyMs ?? 9e9) - (rb?.latencyMs ?? 9e9));
  });

  const Row = ({ id, label, sub, res }: { id: string | null; label: string; sub?: string; res?: ProxyCheckResult }) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
          active ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-black/20 hover:bg-black/30'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm text-white">{label}</span>
          {sub && <span className="block text-[10px] text-gray-500">{sub}</span>}
        </span>
        {res && (
          res.functional ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck size={12} /> {res.latencyMs}ms</span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-rose-300" title={res.reason}><ShieldAlert size={12} /> {res.dataDomeOk === false ? 'DataDome' : 'falhou'}</span>
          )
        )}
      </button>
    );
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-gray-400">Proxy <span className="text-gray-600">(escolha um que funciona)</span></span>
        <button type="button" onClick={verify} disabled={checking} className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] font-medium text-cyan-200 ring-1 ring-cyan-500/30 hover:bg-white/10 disabled:opacity-50 transition">
          {checking ? <Loader2 size={12} className="animate-spin" /> : <RadioTower size={12} />} Verificar
        </button>
      </div>
      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        <Row id={null} label="Sem proxy (IP direto)" sub="usa o IP do servidor" />
        {ordered.map((p) => (
          <Row key={p.id} id={p.id} label={`${p.ip}:${p.port}`} sub={p.iptype} res={results[p.id]} />
        ))}
      </div>
      {note && <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-400"><Zap size={11} className="text-cyan-300" /> {note}</div>}
    </div>
  );
}
