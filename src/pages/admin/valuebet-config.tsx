import { useState, useEffect, useCallback } from 'react';
import { apiGateway, ValuebetConfigDTO } from '@/gateways/api.gateway';
import { RefreshCcw, Loader2, Save, SlidersHorizontal, Lock } from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition';

// Casas conhecidas do universo de value bet (pinnacle = referência, trava ON).
const KNOWN_HOUSES = ['pinnacle', 'betano', 'bet365', 'superbet'];
const REFERENCE = 'pinnacle';

const pct = (frac: number) => `${(frac * 100).toFixed(2)}%`;

// Campo numérico com rótulo, passo e dica opcional (ex.: equivalente em %).
function NumField({ label, value, onChange, step = '0.01', hint }: { label: string; value: number; onChange: (v: number) => void; step?: string; hint?: string }) {
  return (
    <label className="block text-xs text-gray-400">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`${inputClass} mt-1 tabular-nums`}
      />
      {hint && <span className="mt-0.5 block text-[10px] text-violet-300/70">{hint}</span>}
    </label>
  );
}

const AdminValuebetConfigPage = () => {
  const [cfg, setCfg] = useState<ValuebetConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getValuebetConfig();
      if (res.data?.result === 1) setCfg(res.data.data as ValuebetConfigDTO);
      else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar config.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar config.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = (p: Partial<ValuebetConfigDTO>) => setCfg((c) => (c ? { ...c, ...p } : c));
  const setTierWeight = (tier: string, v: number) => setCfg((c) => (c ? { ...c, tierWeights: { ...c.tierWeights, [tier]: v } } : c));

  const toggleHouse = (house: string) => {
    if (house === REFERENCE) return; // referência é obrigatória
    setCfg((c) => {
      if (!c) return c;
      const set = new Set(c.allowedHouses.map((h) => h.toLowerCase()));
      if (set.has(house)) set.delete(house); else set.add(house);
      set.add(REFERENCE); // segurança
      return { ...c, allowedHouses: Array.from(set) };
    });
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiGateway.updateValuebetConfig(cfg);
      if (res.data?.result === 1) {
        setCfg(res.data.data as ValuebetConfigDTO);
        setMsg({ type: 'ok', text: 'Configuração salva. O robô aplica sem rebuild.' });
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao salvar.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 ring-1 ring-violet-500/30">
            <SlidersHorizontal className="text-violet-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Value Bets — Configuração</h1>
            <p className="text-sm text-gray-400">Limiares do motor (edge, confiança, odds, Kelly) — editável sem rebuild.</p>
          </div>
        </div>
        <button onClick={load} className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-violet-200 transition" title="Recarregar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {loading || !cfg ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Carregando configuração...</div>
      ) : (
        <div className="space-y-5">
          {/* Universo de casas */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white">Casas do universo</h2>
            <p className="text-[11px] text-gray-500 mb-3">A casa de referência é obrigatória e nunca é alvo. Só há value bet nas demais.</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...KNOWN_HOUSES, ...cfg.allowedHouses.map((h) => h.toLowerCase())])).map((h) => {
                const on = cfg.allowedHouses.map((x) => x.toLowerCase()).includes(h);
                const locked = h === REFERENCE;
                return (
                  <button
                    key={h}
                    onClick={() => toggleHouse(h)}
                    disabled={locked}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${
                      on ? 'bg-violet-500/15 text-violet-200 ring-violet-500/40' : 'bg-white/5 text-gray-400 ring-white/10 hover:bg-white/10'
                    } ${locked ? 'cursor-not-allowed opacity-90' : ''}`}
                  >
                    {locked && <Lock size={11} />} {h}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Limiares de edge / confiança */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Edge & confiança</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumField label="Edge mín. (confiança máx.)" step="0.005" value={cfg.edgeFloor} onChange={(v) => patch({ edgeFloor: v })} hint={`= ${pct(cfg.edgeFloor)}`} />
              <NumField label="Edge mín. (confiança mín.)" step="0.005" value={cfg.edgeCeil} onChange={(v) => patch({ edgeCeil: v })} hint={`= ${pct(cfg.edgeCeil)}`} />
              <NumField label="Edge máx. (teto anti-erro)" step="0.005" value={cfg.edgeMax} onChange={(v) => patch({ edgeMax: v })} hint={`= ${pct(cfg.edgeMax)}`} />
              <NumField label="Confiança mín. (cMin)" step="0.05" value={cfg.cMin} onChange={(v) => patch({ cMin: v })} hint={`= ${pct(cfg.cMin)}`} />
            </div>
          </section>

          {/* Odds & stake */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Odds & stake</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumField label="Odd mínima" step="0.05" value={cfg.oddMin} onChange={(v) => patch({ oddMin: v })} />
              <NumField label="Odd máxima" step="0.1" value={cfg.oddMax} onChange={(v) => patch({ oddMax: v })} />
              <NumField label="Fração de Kelly" step="0.05" value={cfg.kellyFraction} onChange={(v) => patch({ kellyFraction: v })} hint={`= ${pct(cfg.kellyFraction)} de Kelly`} />
            </div>
          </section>

          {/* Pesos por tier */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Pesos por tier</h2>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Tier 1" step="0.05" value={cfg.tierWeights['1'] ?? 1} onChange={(v) => setTierWeight('1', v)} />
              <NumField label="Tier 2" step="0.05" value={cfg.tierWeights['2'] ?? 0.75} onChange={(v) => setTierWeight('2', v)} />
              <NumField label="Tier 3" step="0.05" value={cfg.tierWeights['3'] ?? 0.55} onChange={(v) => setTierWeight('3', v)} />
            </div>
          </section>

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-xs ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/10 text-rose-300 ring-rose-500/30'}`}>
              {msg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm disabled:opacity-60 transition">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar configuração
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminValuebetConfigPage;
