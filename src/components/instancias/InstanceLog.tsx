import { useState, useEffect, useCallback } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { BetInstanceEvent } from '@/interfaces/betinstance.interface';
import { eventLevelCls, eventTypeCls, hhmmss } from '@/utils/betInstanceUi';
import { RefreshCcw, Trash2, Loader2 } from 'lucide-react';

const TYPES = [
  { v: 'all', l: 'Todos' }, { v: 'place', l: 'Aposta' }, { v: 'skip', l: 'Pulado' },
  { v: 'login', l: 'Login' }, { v: 'session', l: 'Sessão' }, { v: 'settle', l: 'Settle' },
  { v: 'error', l: 'Erro' }, { v: 'state', l: 'Estado' }, { v: 'proxy', l: 'Proxy' },
];

const inputCls = 'bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40';

/** Monta uma linha de detalhe a partir das chaves conhecidas do meta. */
function metaLine(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  const p: string[] = [];
  if (meta.betId) p.push(`betId ${meta.betId}`);
  if (meta.odd != null) p.push(`odd ${meta.odd}`);
  if (meta.stake != null) p.push(`R$ ${Number(meta.stake).toFixed(2)}`);
  if (meta.reason) p.push(String(meta.reason));
  if (meta.count != null) p.push(`${meta.count} aposta(s)`);
  if (meta.balance != null) p.push(`saldo R$ ${Number(meta.balance).toFixed(2)}`);
  if (meta.customerId) p.push(`cid ${meta.customerId}`);
  if (meta.emissionId) p.push(`#${String(meta.emissionId).slice(0, 8)}`);
  if (meta.kind) p.push(String(meta.kind));
  return p.join(' · ');
}

export function InstanceLog({ instanceId }: { instanceId: string }) {
  const [events, setEvents] = useState<BetInstanceEvent[]>([]);
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const filtering = !!(from || to || type !== 'all');

  const load = useCallback(async () => {
    if (!instanceId) return;
    try {
      const r = await apiGateway.getInstanceEvents(instanceId, { limit: 300, from: from || undefined, to: to || undefined, type });
      if (r.data?.result === 1) setEvents(r.data.data as BetInstanceEvent[]);
    } catch { /* */ } finally { setLoading(false); }
  }, [instanceId, from, to, type]);

  useEffect(() => { setLoading(true); void load(); }, [load]);
  // "ao vivo" só sem filtro de período (com período fixo é consulta histórica).
  useEffect(() => {
    if (from || to) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [load, from, to]);

  const clear = async () => {
    if (!confirm('Limpar todo o log desta instância?')) return;
    setClearing(true);
    try { await apiGateway.clearInstanceEvents(instanceId); await load(); } catch { /* */ } finally { setClearing(false); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Log {filtering ? '(filtrado)' : 'ao vivo'}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => { setLoading(true); void load(); }} className="grid place-items-center h-7 w-7 rounded-md text-gray-400 hover:text-cyan-200 hover:bg-white/5" title="Atualizar">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          </button>
          <button onClick={clear} disabled={clearing} className="grid place-items-center h-7 w-7 rounded-md text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-50" title="Limpar log">
            {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} w-full`}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="block text-[10px] text-gray-500">De<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full mt-0.5`} /></label>
          <label className="block text-[10px] text-gray-500">Até<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full mt-0.5`} /></label>
        </div>
        {filtering && <button onClick={() => { setFrom(''); setTo(''); setType('all'); }} className="text-[10px] text-cyan-300 hover:underline">limpar filtros · voltar ao vivo</button>}
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-500">Sem eventos{filtering ? ' no filtro' : ' ainda'}.</div>
      ) : (
        <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
          {events.map((ev) => {
            const m = metaLine(ev.meta as Record<string, unknown> | null);
            return (
              <div key={ev.id} className="rounded-lg bg-black/20 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${eventTypeCls(ev.type)}`}>{ev.type}</span>
                  <span className="text-[10px] text-gray-600">{filtering ? new Date(ev.createdAt).toLocaleString('pt-BR') : hhmmss(ev.createdAt)}</span>
                </div>
                <div className={`mt-1 text-[11px] ${eventLevelCls(ev.level)}`}>{ev.message}</div>
                {m && <div className="mt-0.5 text-[10px] text-gray-500">{m}</div>}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 text-right text-[10px] text-gray-600">{events.length} evento(s)</div>
    </div>
  );
}
