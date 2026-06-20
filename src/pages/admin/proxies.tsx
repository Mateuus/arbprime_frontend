import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { apiGateway, ProxyDTO } from '@/gateways/api.gateway';
import {
  Network, Plus, RefreshCcw, Pencil, Trash2, X, Search,
  ClipboardList, Server, CheckCircle2, XCircle, Globe, Gauge, Loader2
} from 'lucide-react';

// Providers disponíveis (extensível — novos providers entram aqui e no backend).
const PROVIDERS = [{ value: 'proxy-seller', label: 'Proxy-Seller' }];
const PROTOCOLS = ['http', 'https', 'socks5'];
const IP_TYPES = ['ipv4', 'ipv6', 'resident', 'mobile', 'isp', 'mix'];

interface ProxyForm {
  ip: string;
  port: string;
  protocol: string;
  ipType: string;
  login: string;
  password: string;
}

const emptyForm: ProxyForm = { ip: '', port: '', protocol: 'http', ipType: 'ipv4', login: '', password: '' };

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

// Pílula de status/tipo
const Pill = ({ tone, children }: { tone: 'green' | 'gray' | 'teal' | 'violet' | 'slate'; children: React.ReactNode }) => {
  const tones: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    gray: 'bg-white/5 text-gray-400 ring-white/10',
    teal: 'bg-teal-500/15 text-teal-300 ring-teal-500/30',
    violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
    slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30'
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
};

// Resultado do teste de conectividade de um proxy (mantido só no client).
type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';
interface TestResult {
  status: TestStatus;
  latencyMs?: number | null;
  exitIp?: string | null;
  message?: string;
}

// Cor da bolinha conforme o status/latência do teste.
const dotColor = (r: TestResult | undefined): string => {
  if (!r || r.status === 'idle') return 'bg-gray-500';
  if (r.status === 'testing') return 'bg-amber-400 animate-pulse';
  if (r.status === 'fail') return 'bg-rose-500';
  // ok: verde se rápido, amarelo se lento (>1.5s)
  return (r.latencyMs ?? 0) > 1500 ? 'bg-yellow-400' : 'bg-emerald-400';
};

const dotLabel = (r: TestResult | undefined): string => {
  if (!r || r.status === 'idle') return 'Não testado — clique no medidor para testar';
  if (r.status === 'testing') return 'Testando...';
  return r.message || (r.status === 'ok' ? 'OK' : 'Falhou');
};

// useLayoutEffect dá warning no SSR do Next; em ambiente sem window cai no useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Bolinha de status com tooltip ao passar o mouse / tocar.
// Usa posição `fixed` (calculada do rect da bolinha) para não ser cortada pelo
// overflow da tabela e ficar acima de qualquer stacking context. A posição é
// dinâmica: mede a largura real do tooltip e clampa para nunca passar da tela.
const StatusDot = ({ result }: { result: TestResult | undefined }) => {
  const [anchor, setAnchor] = useState<{ cx: number; top: number } | null>(null);
  const [left, setLeft] = useState(0);
  const tipRef = useRef<HTMLSpanElement>(null);

  const show = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top });
  };

  // Após renderizar o tooltip, clampa sua borda esquerda dentro da viewport.
  useIsoLayoutEffect(() => {
    if (!anchor || !tipRef.current) return;
    const margin = 8;
    const w = tipRef.current.offsetWidth;
    const vw = window.innerWidth;
    setLeft(Math.min(Math.max(anchor.cx - w / 2, margin), vw - w - margin));
  }, [anchor]);

  const hide = () => setAnchor(null);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={show}
      onTouchEnd={hide}
    >
      <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-black/30 ${dotColor(result)}`} />
      {anchor && (
        <span
          ref={tipRef}
          style={{ left, top: anchor.top - 8 }}
          className="pointer-events-none fixed z-[9999] -translate-y-full max-w-[90vw] rounded-lg bg-black/90 px-2.5 py-1.5 text-[11px] leading-snug text-gray-100 ring-1 ring-white/10 shadow-xl whitespace-normal sm:whitespace-nowrap"
        >
          {dotLabel(result)}
        </span>
      )}
    </span>
  );
};

const AdminProxiesPage = () => {
  const [proxies, setProxies] = useState<ProxyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('proxy-seller');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProxyDTO | null>(null);
  const [form, setForm] = useState<ProxyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkProtocol, setBulkProtocol] = useState('http');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [testingAll, setTestingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getProxies();
      if (res.data?.result === 1) {
        setProxies(res.data.data || []);
      } else {
        setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar proxies.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar proxies.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSync = async (type: string) => {
    setSyncing(type);
    setMsg(null);
    try {
      const res = await apiGateway.syncProxies(provider, type);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Sincronizado.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao sincronizar com o provider.') });
    } finally {
      setSyncing(null);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: ProxyDTO) => {
    setEditing(p);
    setForm({ ip: p.ip, port: String(p.port), protocol: p.protocol, ipType: p.ipType, login: p.login, password: p.password });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.ip.trim() || !form.port.trim()) {
      setMsg({ type: 'err', text: 'IP e porta são obrigatórios.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ip: form.ip.trim(),
        port: Number(form.port),
        protocol: form.protocol,
        ipType: form.ipType,
        login: form.login,
        password: form.password
      };
      if (editing) {
        await apiGateway.updateProxy(editing.id, payload);
        setMsg({ type: 'ok', text: 'Proxy atualizado.' });
      } else {
        await apiGateway.addProxy(payload);
        setMsg({ type: 'ok', text: 'Proxy adicionado.' });
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar proxy.') });
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async () => {
    if (!bulkText.trim()) {
      setMsg({ type: 'err', text: 'Cole ao menos um proxy.' });
      return;
    }
    setBulkSaving(true);
    try {
      const res = await apiGateway.bulkAddProxies(bulkText, bulkProtocol);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Lista importada.' });
      setBulkOpen(false);
      setBulkText('');
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao importar lista.') });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleToggle = async (p: ProxyDTO) => {
    try {
      await apiGateway.toggleProxy(p.id, !p.isEnabled);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao alterar status.') });
    }
  };

  const handleTest = async (p: ProxyDTO): Promise<TestResult> => {
    setTests((prev) => ({ ...prev, [p.id]: { ...prev[p.id], status: 'testing' } }));
    try {
      const res = await apiGateway.testProxy(p.id);
      const data = res.data?.data || {};
      const result: TestResult = {
        status: res.data?.result === 1 ? 'ok' : 'fail',
        latencyMs: data.latencyMs ?? null,
        exitIp: data.exitIp ?? null,
        message: res.data?.message
      };
      setTests((prev) => ({ ...prev, [p.id]: result }));
      return result;
    } catch (e: unknown) {
      const result: TestResult = { status: 'fail', message: errorMessage(e, 'Erro ao testar proxy.') };
      setTests((prev) => ({ ...prev, [p.id]: result }));
      return result;
    }
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      // Testa em paralelo, com um limite simples para não disparar tudo de uma vez.
      const list = [...filtered];
      const CONCURRENCY = 5;
      for (let i = 0; i < list.length; i += CONCURRENCY) {
        await Promise.all(list.slice(i, i + CONCURRENCY).map((p) => handleTest(p)));
      }
    } finally {
      setTestingAll(false);
    }
  };

  const handleDelete = async (p: ProxyDTO) => {
    if (!window.confirm(`Remover proxy ${p.ip}:${p.port}?`)) return;
    try {
      await apiGateway.deleteProxy(p.id);
      setMsg({ type: 'ok', text: 'Proxy removido.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover proxy.') });
    }
  };

  // Derivados (durante o render — sem efeitos)
  const q = query.trim().toLowerCase();
  const filtered = q
    ? proxies.filter((p) =>
        [p.ip, p.login, p.country, p.provider, p.ipType].some((v) => (v || '').toLowerCase().includes(q))
      )
    : proxies;

  const stats = {
    total: proxies.length,
    active: proxies.filter((p) => p.isEnabled).length,
    inactive: proxies.filter((p) => !p.isEnabled).length,
    provider: proxies.filter((p) => p.provider !== 'manual').length
  };

  const bulkCount = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;

  const cards = [
    { label: 'Total', value: stats.total, icon: Server, tone: 'text-teal-300' },
    { label: 'Ativos', value: stats.active, icon: CheckCircle2, tone: 'text-emerald-300' },
    { label: 'Inativos', value: stats.inactive, icon: XCircle, tone: 'text-rose-300' },
    { label: 'Do provider', value: stats.provider, icon: Globe, tone: 'text-violet-300' }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Network className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Proxies</h1>
            <p className="text-sm text-gray-400">Gerencie os proxies usados pelo sistema</p>
          </div>
        </div>
        <button
          onClick={() => load()}
          className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
          title="Atualizar"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-gray-400">{c.label}</span>
              <c.icon className={c.tone} size={18} />
            </div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4 space-y-3">
        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por IP, login, país..."
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Provider + importar do provider */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">Provider</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={`${inputClass} w-auto`}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            <div className="flex shrink-0 rounded-lg overflow-hidden border border-teal-500/30">
              <button
                onClick={() => handleSync('ipv4')}
                disabled={syncing !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-teal-200 bg-teal-500/10 hover:bg-teal-500/20 disabled:opacity-50 transition"
              >
                <RefreshCcw size={14} className={syncing === 'ipv4' ? 'animate-spin' : ''} /> IPv4
              </button>
              <div className="w-px bg-teal-500/30" />
              <button
                onClick={() => handleSync('ipv6')}
                disabled={syncing !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-teal-200 bg-teal-500/10 hover:bg-teal-500/20 disabled:opacity-50 transition"
              >
                <RefreshCcw size={14} className={syncing === 'ipv6' ? 'animate-spin' : ''} /> IPv6
              </button>
            </div>
          </div>

          {/* Ações à direita */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              onClick={handleTestAll}
              disabled={testingAll || filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-200 disabled:opacity-50 transition"
              title="Testar todos os proxies visíveis"
            >
              {testingAll ? <Loader2 size={15} className="animate-spin" /> : <Gauge size={15} />} Testar todos
            </button>

            <button
              onClick={() => { setBulkText(''); setBulkProtocol('http'); setBulkOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition"
            >
              <ClipboardList size={15} /> <span className="hidden sm:inline">Importar lista</span>
            </button>

            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition"
            >
              <Plus size={15} /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Tabela (desktop) */}
      <div className="hidden lg:block rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Protocolo</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Network className="mx-auto text-gray-600 mb-3" size={32} />
                    <p className="text-gray-400">{q ? 'Nenhum proxy encontrado para a busca.' : 'Nenhum proxy cadastrado ainda.'}</p>
                    {!q && (
                      <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200">
                        <Plus size={15} /> Adicionar o primeiro
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.04] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StatusDot result={tests[p.id]} />
                        <div>
                          <div className="font-mono text-gray-100">{p.ip}<span className="text-gray-500">:{p.port}</span></div>
                          {p.login && <div className="text-[11px] text-gray-500 font-mono truncate max-w-[180px]">{p.login}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Pill tone="slate">{p.ipType?.toUpperCase()}</Pill></td>
                    <td className="px-4 py-3"><span className="text-xs uppercase text-gray-400">{p.protocol}</span></td>
                    <td className="px-4 py-3">
                      <Pill tone={p.provider === 'manual' ? 'gray' : 'violet'}>{p.provider}</Pill>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.country || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        {p.isEnabled
                          ? <Pill tone="green"><CheckCircle2 size={12} /> Ativo</Pill>
                          : <Pill tone="gray"><XCircle size={12} /> Inativo</Pill>}
                        {tests[p.id]?.status === 'ok' && tests[p.id]?.latencyMs != null && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                            <Gauge size={11} /> {tests[p.id]!.latencyMs}ms
                          </span>
                        )}
                        {tests[p.id]?.status === 'fail' && (
                          <span className="text-[11px] text-rose-400">offline</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleTest(p)}
                          disabled={tests[p.id]?.status === 'testing'}
                          className="p-2 rounded-lg text-gray-400 hover:text-sky-300 hover:bg-white/10 disabled:opacity-50 transition"
                          title="Testar proxy (latência e conectividade)"
                        >
                          {tests[p.id]?.status === 'testing'
                            ? <Loader2 size={15} className="animate-spin" />
                            : <Gauge size={15} />}
                        </button>
                        <button
                          onClick={() => handleToggle(p)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.isEnabled ? 'bg-emerald-500' : 'bg-white/15'}`}
                          title={p.isEnabled ? 'Desativar' : 'Ativar'}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${p.isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards (mobile) */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center">
            <Network className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">{q ? 'Nenhum proxy encontrado para a busca.' : 'Nenhum proxy cadastrado ainda.'}</p>
            {!q && (
              <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200">
                <Plus size={15} /> Adicionar o primeiro
              </button>
            )}
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusDot result={tests[p.id]} />
                  <div className="min-w-0">
                    <div className="font-mono text-gray-100 break-all">{p.ip}<span className="text-gray-500">:{p.port}</span></div>
                    {p.login && <div className="text-[11px] text-gray-500 font-mono break-all">{p.login}</div>}
                  </div>
                </div>
                {p.isEnabled
                  ? <Pill tone="green"><CheckCircle2 size={12} /> Ativo</Pill>
                  : <Pill tone="gray"><XCircle size={12} /> Inativo</Pill>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Pill tone="slate">{p.ipType?.toUpperCase()}</Pill>
                <span className="uppercase text-gray-400">{p.protocol}</span>
                <Pill tone={p.provider === 'manual' ? 'gray' : 'violet'}>{p.provider}</Pill>
                {p.country && <span className="text-gray-400">{p.country}</span>}
                {tests[p.id]?.status === 'ok' && tests[p.id]?.latencyMs != null && (
                  <span className="inline-flex items-center gap-1 text-gray-400 font-mono">
                    <Gauge size={11} /> {tests[p.id]!.latencyMs}ms
                  </span>
                )}
                {tests[p.id]?.status === 'fail' && <span className="text-rose-400">offline</span>}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 border-t border-white/5 pt-3">
                <button
                  onClick={() => handleTest(p)}
                  disabled={tests[p.id]?.status === 'testing'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sky-300 hover:bg-white/10 disabled:opacity-50 transition text-sm"
                >
                  {tests[p.id]?.status === 'testing'
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Gauge size={15} />} Testar
                </button>
                <button
                  onClick={() => handleToggle(p)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.isEnabled ? 'bg-emerald-500' : 'bg-white/15'}`}
                  title={p.isEnabled ? 'Desativar' : 'Ativar'}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${p.isEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
                <button onClick={() => openEdit(p)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">{filtered.length} de {proxies.length} proxies</p>
      )}

      {/* Modal Adicionar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Editar proxy' : 'Adicionar proxy manual'}</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 text-xs text-gray-400">
                  IP
                  <input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} className={`${inputClass} mt-1`} placeholder="127.0.0.1" />
                </label>
                <label className="text-xs text-gray-400">
                  Porta
                  <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className={`${inputClass} mt-1`} placeholder="8080" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  Protocolo
                  <select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })} className={`${inputClass} mt-1`}>
                    {PROTOCOLS.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-400">
                  Tipo
                  <select value={form.ipType} onChange={(e) => setForm({ ...form, ipType: e.target.value })} className={`${inputClass} mt-1`}>
                    {IP_TYPES.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  Login
                  <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className={`${inputClass} mt-1`} />
                </label>
                <label className="text-xs text-gray-400">
                  Senha
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inputClass} mt-1`} />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar lista */}
      {bulkOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-lg rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setBulkOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1">Importar lista</h2>
            <p className="text-xs text-gray-400 mb-4">Um proxy por linha, no formato <span className="font-mono text-teal-300">login:senha@ip:porta</span> (auth opcional).</p>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={9}
              spellCheck={false}
              placeholder={'muvucasbars:senha@181.215.11.213:50100\nmuvucasbars:senha@62.192.172.112:50100'}
              className={`${inputClass} font-mono text-xs leading-relaxed resize-y`}
            />

            <div className="flex items-center justify-between mt-3">
              <label className="text-xs text-gray-400 flex items-center gap-2">
                Protocolo
                <select value={bulkProtocol} onChange={(e) => setBulkProtocol(e.target.value)} className={`${inputClass} w-auto`}>
                  {PROTOCOLS.map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>)}
                </select>
              </label>
              <span className="text-xs text-gray-500">{bulkCount} linha{bulkCount === 1 ? '' : 's'}</span>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setBulkOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleBulk} disabled={bulkSaving || bulkCount === 0} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold">
                {bulkSaving ? 'Importando...' : `Importar ${bulkCount || ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProxiesPage;
