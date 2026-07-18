import { useState, useCallback, ReactNode } from 'react';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { scoreOf, clockOf } from '@/utils/nodelayLive';
import { Radio, ChevronDown, Flag, Target, Circle, Hand, ArrowRightLeft, Goal } from 'lucide-react';

/**
 * Painel central de estatística AO VIVO da Aposta Rápida. Placar grande sempre à
 * vista; a grade detalhada (escanteios, cartões, chutes, faltas…) abre/fecha e a
 * escolha fica salva. Os dados vêm de `game.liveStats` (Score.AdditionalScores da
 * rogue), atualizado sozinho pelos deltas de evento — sem F5.
 */
const LS_KEY = 'nodelay:stats:collapsed';

type StatKey = 'corners' | 'yellowCards' | 'redCards' | 'shotsOnTarget' | 'shots' | 'fouls' | 'throwIns' | 'goalKicks';

// bar = [cor do lado casa (forte), cor do lado fora (fraca)]. Classes LITERAIS
// (Tailwind não gera classe dinâmica), por isso o mapa explícito por linha.
const ROWS: { key: StatKey; label: string; bar: [string, string]; onlyIfAny?: boolean }[] = [
  { key: 'corners', label: 'Escanteios', bar: ['bg-sky-400/80', 'bg-sky-400/30'] },
  { key: 'yellowCards', label: 'Amarelos', bar: ['bg-amber-400/80', 'bg-amber-400/30'] },
  { key: 'redCards', label: 'Vermelhos', bar: ['bg-rose-500/80', 'bg-rose-500/30'] },
  { key: 'shotsOnTarget', label: 'No gol', bar: ['bg-emerald-400/80', 'bg-emerald-400/30'] },
  { key: 'shots', label: 'Finalizações', bar: ['bg-lime-400/80', 'bg-lime-400/30'] },
  { key: 'fouls', label: 'Faltas', bar: ['bg-orange-400/80', 'bg-orange-400/30'] },
  { key: 'throwIns', label: 'Laterais', bar: ['bg-slate-300/70', 'bg-slate-300/25'], onlyIfAny: true },
  { key: 'goalKicks', label: 'Tiros de meta', bar: ['bg-slate-300/70', 'bg-slate-300/25'], onlyIfAny: true },
];

function iconFor(key: StatKey): ReactNode {
  const c = 'text-gray-400';
  switch (key) {
    case 'corners': return <Flag size={11} className={c} />;
    case 'yellowCards': return <span className="inline-block h-3 w-2 rounded-[1px] bg-amber-400" />;
    case 'redCards': return <span className="inline-block h-3 w-2 rounded-[1px] bg-rose-500" />;
    case 'shotsOnTarget': return <Target size={11} className={c} />;
    case 'shots': return <Circle size={11} className={c} />;
    case 'fouls': return <Hand size={11} className={c} />;
    case 'throwIns': return <ArrowRightLeft size={11} className={c} />;
    case 'goalKicks': return <Goal size={11} className={c} />;
  }
}

function StatRow({ label, icon, home, away, bar }: { label: string; icon: ReactNode; home: number; away: number; bar: [string, string] }) {
  const total = home + away;
  const homePct = total ? (home / total) * 100 : 50;
  const homeLead = home > away;
  const awayLead = away > home;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        {/* Pontas = por time */}
        <span className={`w-6 shrink-0 text-left font-bold tabular-nums ${homeLead ? 'text-white' : 'text-gray-500'}`}>{home}</span>
        {/* Centro = rótulo + TOTAL (o número que decide o over/under) */}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-1 truncate text-[10px] font-medium uppercase tracking-wide text-gray-400">{icon}{label}</span>
          <span className="shrink-0 rounded bg-white/10 px-1.5 text-[11px] font-bold tabular-nums text-white ring-1 ring-white/10">{total}</span>
        </span>
        <span className={`w-6 shrink-0 text-right font-bold tabular-nums ${awayLead ? 'text-white' : 'text-gray-500'}`}>{away}</span>
      </div>
      <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${bar[0]}`} style={{ width: `${homePct}%` }} />
        <div className={`h-full ${bar[1]}`} style={{ width: `${100 - homePct}%` }} />
      </div>
    </div>
  );
}

export function LiveStatsPanel({ game }: { game: LiveGameDetail }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const n = !c;
      try { window.localStorage.setItem(LS_KEY, n ? '1' : '0'); } catch { /* ignora */ }
      return n;
    });
  }, []);

  const score = scoreOf(game);
  const clock = clockOf(game);
  const st = game.liveStats;
  const rows = st ? ROWS.filter((r) => !r.onlyIfAny || st[r.key].home + st[r.key].away > 0) : [];
  // Placar do 1º tempo só interessa quando o jogo passou dele (já tem gol no 1ºT
  // ou o relógio passou de 45') — evita mostrar "1ºT 0-0" no início da partida.
  const ht = st && (st.firstHalf.home + st.firstHalf.away > 0) ? st.firstHalf : null;

  return (
    <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
      {/* Placar — sempre visível; a barra toda alterna a grade */}
      <button onClick={toggle} className="flex w-full items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <span className="hidden shrink-0 items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-300 ring-1 ring-rose-500/30 sm:inline-flex">
          <Radio size={8} className="animate-pulse" /> Ao vivo
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <span className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-white sm:text-sm">{game.home}</span>
          <span className="flex shrink-0 flex-col items-center">
            <span className="rounded-lg bg-black/40 px-3 py-0.5 text-lg font-bold tabular-nums text-white ring-1 ring-white/10 sm:text-xl">
              {score ? `${score.home} - ${score.away}` : '–'}
            </span>
            {ht && <span className="mt-0.5 text-[9px] text-gray-500">1ºT {ht.home}-{ht.away}</span>}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-white sm:text-sm">{game.away}</span>
        </div>
        {clock && <span className="shrink-0 text-xs font-bold tabular-nums text-lime-300">{clock}</span>}
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {/* Grade de estatística — colapsável */}
      {!collapsed && st && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-2 px-3 pb-3 sm:grid-cols-2 sm:px-4">
          <div className="col-span-full text-center text-[9px] uppercase tracking-wide text-gray-600">
            nas pontas: por time · <span className="rounded bg-white/10 px-1 font-bold text-gray-300">n</span> no centro: total
          </div>
          {rows.map((r) => (
            <StatRow key={r.key} label={r.label} icon={iconFor(r.key)} home={st[r.key].home} away={st[r.key].away} bar={r.bar} />
          ))}
        </div>
      )}
      {!collapsed && !st && (
        <div className="px-4 pb-3 text-center text-[10px] text-gray-600">Sem estatística ao vivo para este evento.</div>
      )}
    </div>
  );
}
