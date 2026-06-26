import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { LineChart, RefreshCcw, ArrowLeft, Gem, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { apiGateway, ClvSummaryDTO, ClvBreakdownRowDTO, ClvPendingDTO, JuiceRowDTO } from '@/gateways/api.gateway';
import { marketLabel } from '@/utils/surebet';
import { houseVigTone, fmtVigPct } from '@/utils/valuebet';
import { InfoButton } from '@/components/info/InfoButton';
import HelpLabel from '@/components/analytix/HelpLabel';

interface TsPoint { day: string; tier: number | null; n: number; clvAvgPct: number | null }

const fmtPct = (v: number | null | undefined, digits = 2) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);
const clvColor = (v: number | null | undefined) => (v == null ? 'text-gray-400' : v > 0 ? 'text-emerald-300' : v < 0 ? 'text-rose-300' : 'text-gray-300');

// KPI card. `tip` adiciona um "?" ao lado do rótulo explicando a métrica.
function Kpi({ label, value, tone = 'text-white', sub, tip }: { label: string; value: string; tone?: string; sub?: string; tip?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">
        {tip ? <HelpLabel help={tip}>{label}</HelpLabel> : label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
    </div>
  );
}

// Sparkline inline (sem dependência) do CLV médio diário (agregado entre tiers).
function Sparkline({ points }: { points: { x: string; y: number }[] }) {
  if (points.length < 2) return <div className="text-xs text-gray-500">Dados insuficientes para a série.</div>;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 0);
  const range = max - min || 1;
  const W = 600, H = 80;
  const stepX = W / (points.length - 1);
  const toY = (y: number) => H - ((y - min) / range) * H;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${toY(p.y).toFixed(1)}`).join(' ');
  const zeroY = toY(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="#a78bfa" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const dimensionLabel = (dim: string, key: string) => (dim === 'market' ? marketLabel(key) : dim === 'tier' ? `Tier ${key}` : key);

export default function ValuebetClvPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();

  const [days, setDays] = useState(30);
  const [dimension, setDimension] = useState<'bookmaker' | 'market' | 'tier'>('bookmaker');
  const [juiceDim, setJuiceDim] = useState<'bookmaker' | 'market'>('bookmaker');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ClvSummaryDTO | null>(null);
  const [rows, setRows] = useState<ClvBreakdownRowDTO[]>([]);
  const [juiceRows, setJuiceRows] = useState<JuiceRowDTO[]>([]);
  const [ts, setTs] = useState<TsPoint[]>([]);
  const [pending, setPending] = useState<ClvPendingDTO[]>([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const PENDING_PAGE_SIZE = 10;

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setUnavailable(null);
    try {
      const [s, b, j, t, p] = await Promise.all([
        apiGateway.getClvSummary(days),
        apiGateway.getClvBreakdown(dimension, days),
        apiGateway.getJuiceBreakdown(juiceDim, days),
        apiGateway.getClvTimeseries(days),
        apiGateway.getClvPending(50),
      ]);
      if (s.data?.result === 1) setSummary(s.data.data as ClvSummaryDTO);
      else if (s.data?.message) setUnavailable(s.data.message);
      if (b.data?.result === 1) setRows((b.data.data?.rows || []) as ClvBreakdownRowDTO[]);
      if (j.data?.result === 1) setJuiceRows((j.data.data?.rows || []) as JuiceRowDTO[]);
      if (t.data?.result === 1) setTs((t.data.data?.points || []) as TsPoint[]);
      if (p.data?.result === 1) { setPending((p.data.data || []) as ClvPendingDTO[]); setPendingPage(1); }
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string } } })?.response;
      setUnavailable(resp?.data?.message || 'Não foi possível carregar o CLV.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, days, dimension, juiceDim]);

  useEffect(() => { void load(); }, [load]);

  // Série diária agregada (CLV médio ponderado por nº de apostas, entre tiers).
  const dailySpark = useMemo(() => {
    const byDay = new Map<string, { wsum: number; n: number }>();
    for (const pt of ts) {
      if (pt.clvAvgPct == null) continue;
      const cur = byDay.get(pt.day) || { wsum: 0, n: 0 };
      cur.wsum += pt.clvAvgPct * pt.n;
      cur.n += pt.n;
      byDay.set(pt.day, cur);
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ x: day, y: v.n ? v.wsum / v.n : 0 }));
  }, [ts]);

  // Paginação dos pendentes (a lista pode ter dezenas de itens).
  const pendingPageCount = Math.max(1, Math.ceil(pending.length / PENDING_PAGE_SIZE));
  const pendingPageSafe = Math.min(pendingPage, pendingPageCount);
  const pagedPending = useMemo(
    () => pending.slice((pendingPageSafe - 1) * PENDING_PAGE_SIZE, pendingPageSafe * PENDING_PAGE_SIZE),
    [pending, pendingPageSafe],
  );

  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {authLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Verificando acesso...</div>
          ) : (
            <>
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-violet-500/15 ring-1 ring-violet-500/30 mb-4"><Gem className="text-violet-300" size={24} /></div>
              <h2 className="text-lg font-bold text-white">Entre para ver o desempenho</h2>
              <p className="text-sm text-gray-400 mt-1 mb-5">O dashboard de CLV é exclusivo para usuários logados.</p>
              <button onClick={() => router.push('/valuebets')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white font-semibold transition">Voltar</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Tooltip label="Voltar para os value bets">
            <button onClick={() => router.push('/valuebets')} className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-violet-200 transition" aria-label="Voltar para os value bets">
              <ArrowLeft size={16} />
            </button>
          </Tooltip>
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 ring-1 ring-violet-500/30">
            <LineChart className="text-violet-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Desempenho · CLV</h1>
            <p className="text-sm text-gray-400">Closing Line Value — o sinal de edge real (preenche após o jogo começar).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select className="w-32" value={String(days)} onChange={(v) => setDays(parseInt(v, 10))}
            options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }]} />
          <Tooltip label="O que é o CLV?">
            <InfoButton topic="clv" size={16} label="O que é o CLV?"
              className="h-9 w-9 rounded-lg border bg-white/5 border-white/10 hover:border-violet-500/40 hover:text-violet-200" />
          </Tooltip>
          <Tooltip label="Recarregar">
            <button onClick={load} className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-violet-200 transition" aria-label="Recarregar">
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </Tooltip>
        </div>
      </header>

      {unavailable && (
        <div className="mb-4 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-3 py-2 text-xs text-amber-200">{unavailable}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Kpi label="CLV médio" value={fmtPct(summary?.clvAvgPct)} tone={clvColor(summary?.clvAvgPct)} sub={`${summary?.windowDays ?? days}d`}
          tip="Média do CLV das apostas liquidadas na janela. Compara a odd que você pegou com a odd justa no fechamento do jogo. Positivo e estável = você trava preços melhores que o mercado = edge real." />
        <Kpi label="% CLV positivo" value={summary?.clvPositivePct == null ? '—' : `${summary.clvPositivePct.toFixed(1)}%`}
          tip="Percentual das apostas liquidadas que fecharam com CLV acima de zero. Acima de 50% de forma sustentada indica que você costuma pegar odds melhores que o fechamento." />
        <Kpi label="Apostas liquidadas" value={summary ? String(summary.settledCount) : '—'}
          tip="Quantas apostas já tiveram o CLV calculado (o jogo já começou). É a base estatística do painel — quanto maior o número, mais confiável a leitura." />
        <Kpi label="Edge médio (tomado)" value={fmtPct(summary?.edgeAvgPct)}
          tip="O valor médio que estimamos no momento da captura (antes do jogo). Compare com o CLV realizado: se baterem, a estimativa de odd justa está bem calibrada." />
        <Kpi label="Pendentes" value={summary ? String(summary.pendingCount) : '—'} sub="aguardando jogo"
          tip="Value bets lançados cujo jogo ainda não começou. O CLV só é calculado após o apito inicial (liquidação ~10 min depois), então eles ainda não entram nas médias." />
      </div>

      {/* Série temporal */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">CLV médio por dia</h2>
          <span className="text-[10px] text-gray-500">agregado entre tiers</span>
        </div>
        <Sparkline points={dailySpark} />
      </section>

      {/* Quebra por dimensão */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-white">Quebra de CLV</h2>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
            {([['bookmaker', 'Por casa'], ['market', 'Por mercado'], ['tier', 'Por tier']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setDimension(v)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${dimension === v ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {dimension === 'tier' && (
          <p className="mb-2 inline-flex items-center gap-1 text-[11px] text-amber-300/80"><Info size={11} /> Tier 3 usa uma referência mais conservadora (que pode incluir a própria casa) — viés. Não compare 1:1 com T1/T2.</p>
        )}
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">Sem apostas liquidadas com CLV nesta janela.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">{dimension === 'bookmaker' ? 'Casa' : dimension === 'market' ? 'Mercado' : 'Tier'}</th>
                  <th className="py-2 px-3 font-medium text-right">Apostas</th>
                  <th className="py-2 px-3 font-medium text-right">CLV médio</th>
                  <th className="py-2 px-3 font-medium text-right">% positivo</th>
                  <th className="py-2 pl-3 font-medium text-right">Edge médio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">{dimensionLabel(dimension, r.key)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-300">{r.n}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${clvColor(r.clvAvgPct)}`}>{fmtPct(r.clvAvgPct)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-300">{r.clvPositivePct == null ? '—' : `${r.clvPositivePct.toFixed(0)}%`}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-gray-300">{fmtPct(r.edgeAvgPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Margem média das casas (juice) — estrutural, sobre TODAS as emissões (não só liquidadas) */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
            Margem média das casas (juice)
            <InfoButton topic="juice" size={14} label="O que é o juice (margem da casa)?" />
          </h2>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
            {([['bookmaker', 'Por casa'], ['market', 'Por mercado']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setJuiceDim(v)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${juiceDim === v ? 'bg-violet-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 inline-flex items-start gap-1 text-[11px] text-gray-500"><Info size={11} className="mt-0.5 shrink-0" /> <span>Estimativa de quanto a casa embute de margem, calculada das odds das duas pontas (sobre todas as emissões com juice medível, não só liquidadas) — é aproximada, não o valor exato cobrado. Menor = mais honesta.</span></p>
        {juiceRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">Sem juice medível nesta janela.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">{juiceDim === 'market' ? 'Mercado' : 'Casa'}</th>
                  <th className="py-2 px-3 font-medium text-right">Emissões</th>
                  <th className="py-2 pl-3 font-medium text-right">Juice médio</th>
                </tr>
              </thead>
              <tbody>
                {juiceRows.map((r) => (
                  <tr key={r.key} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">{juiceDim === 'market' ? marketLabel(r.key) : r.key}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-300">{r.n}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {r.juiceAvgPct == null ? <span className="text-gray-500">—</span>
                        : <span className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${houseVigTone(r.juiceAvgPct / 100)}`}>{r.juiceAvgPct.toFixed(2).replace('.', ',')}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pendentes */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          Pendentes (aguardando o jogo)
          {pending.length > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-300">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">Nenhum value bet pendente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3 font-medium">Casa</th>
                  <th className="py-2 px-3 font-medium">Mercado</th>
                  <th className="py-2 px-3 font-medium">Seleção</th>
                  <th className="py-2 px-3 font-medium text-right">Odd</th>
                  <th className="py-2 px-3 font-medium text-right">Margem casa</th>
                  <th className="py-2 pl-3 font-medium text-right">Edge</th>
                </tr>
              </thead>
              <tbody>
                {pagedPending.map((p) => (
                  <tr key={p.emissionId} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-white">{p.bookmaker}</td>
                    <td className="py-2 px-3 text-gray-300">{marketLabel(p.market)}</td>
                    <td className="py-2 px-3 text-gray-300">{p.selection}{p.handicap ? ` (${p.handicap})` : ''}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-teal-300">{p.oddTaken.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {p.houseVig == null ? <span className="text-gray-500">—</span>
                        : <span className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${houseVigTone(p.houseVig)}`}>{fmtVigPct(p.houseVig)}</span>}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-emerald-300">+{p.edgeTakenPct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pendingPageCount > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-400">
                <span>
                  Mostrando {(pendingPageSafe - 1) * PENDING_PAGE_SIZE + 1}–{Math.min(pendingPageSafe * PENDING_PAGE_SIZE, pending.length)} de {pending.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={pendingPageSafe <= 1}
                    className="grid place-items-center h-7 w-7 rounded-md border border-white/10 bg-white/5 text-gray-300 transition enabled:hover:text-violet-200 disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-1 tabular-nums">{pendingPageSafe} / {pendingPageCount}</span>
                  <button
                    onClick={() => setPendingPage((p) => Math.min(pendingPageCount, p + 1))}
                    disabled={pendingPageSafe >= pendingPageCount}
                    className="grid place-items-center h-7 w-7 rounded-md border border-white/10 bg-white/5 text-gray-300 transition enabled:hover:text-violet-200 disabled:opacity-40"
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
