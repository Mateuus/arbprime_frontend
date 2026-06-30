import { useState } from 'react';
import { Trophy, Search, ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/Select';

// Sidebar de campeonatos (país → ligas) reutilizável — extraída do padrão do arbbets/Duplo
// Green. Acento configurável (classes LITERAIS p/ o JIT do Tailwind não purgar).
export type LeagueTree = { country: string; count: number; leagues: { league: string; count: number }[] }[];

export function buildLeagueTree(data: { country?: string | null; league?: string | null }[]): LeagueTree {
  const m = new Map<string, { count: number; leagues: Map<string, number> }>();
  for (const e of data) {
    const ctry = (e.country || '').trim() || 'Outros';
    const lg = (e.league || '').trim() || '—';
    if (!m.has(ctry)) m.set(ctry, { count: 0, leagues: new Map() });
    const node = m.get(ctry)!;
    node.count++;
    node.leagues.set(lg, (node.leagues.get(lg) || 0) + 1);
  }
  return Array.from(m.entries())
    .map(([ctry, v]) => ({
      country: ctry,
      count: v.count,
      leagues: Array.from(v.leagues.entries()).map(([lg, count]) => ({ league: lg, count })).sort((a, b) => b.count - a.count || a.league.localeCompare(b.league)),
    }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

type Accent = 'amber' | 'fuchsia' | 'teal' | 'indigo';
const ACCENTS: Record<Accent, { icon: string; inputFocus: string; selBg: string; selText: string }> = {
  amber:   { icon: 'text-amber-300',   inputFocus: 'focus:border-amber-500/40',   selBg: 'bg-amber-500/10',   selText: 'text-amber-100' },
  fuchsia: { icon: 'text-fuchsia-300', inputFocus: 'focus:border-fuchsia-500/40', selBg: 'bg-fuchsia-500/10', selText: 'text-fuchsia-100' },
  teal:    { icon: 'text-teal-300',    inputFocus: 'focus:border-teal-500/40',    selBg: 'bg-teal-500/10',    selText: 'text-teal-100' },
  indigo:  { icon: 'text-indigo-300',  inputFocus: 'focus:border-indigo-500/40',  selBg: 'bg-indigo-500/10',  selText: 'text-indigo-100' },
};

export function LeagueSidebar({ tree, total, country, league, onPick, accent = 'fuchsia' }: {
  tree: LeagueTree; total: number; country: string; league: string; onPick: (country: string, league: string) => void; accent?: Accent;
}) {
  const a = ACCENTS[accent];
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (c: string) => setExpanded((p) => { const s = new Set(p); s.has(c) ? s.delete(c) : s.add(c); return s; });
  const ql = q.trim().toLowerCase();
  const view = ql
    ? tree.map((t) => ({ ...t, leagues: t.leagues.filter((l) => l.league.toLowerCase().includes(ql)) })).filter((t) => t.country.toLowerCase().includes(ql) || t.leagues.length)
    : tree;
  const open = (c: string) => expanded.has(c) || !!ql || country === c;
  return (
    <aside className="hidden lg:flex flex-col shrink-0 w-60 self-start sticky top-4 max-h-[calc(100vh-2rem)] rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10"><Trophy size={15} className={a.icon} /><span className="text-sm font-semibold text-white">Campeonatos</span></div>
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar país ou campeonato…" className={`w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none ${a.inputFocus}`} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <button onClick={() => onPick('', '')} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition ${!country && !league ? `${a.selBg} ${a.selText} font-medium` : 'text-gray-200 hover:bg-white/5'}`}>
          <span>Todos os campeonatos</span><span className="tabular-nums text-xs text-gray-500">{total}</span>
        </button>
        {view.map((t) => {
          const isOpen = open(t.country);
          const countrySel = country === t.country && !league;
          return (
            <div key={t.country}>
              <div className={`flex items-center ${countrySel ? a.selBg : 'hover:bg-white/5'}`}>
                <button onClick={() => toggle(t.country)} className="grid place-items-center h-8 w-7 shrink-0 text-gray-500 hover:text-gray-200" aria-label="Expandir"><ChevronDown size={14} className={`transition ${isOpen ? '' : '-rotate-90'}`} /></button>
                <button onClick={() => onPick(t.country, '')} className={`flex flex-1 items-center justify-between gap-2 pr-3 py-2 text-sm min-w-0 transition ${countrySel ? `${a.selText} font-medium` : 'text-gray-200'}`}><span className="truncate text-left">{t.country}</span><span className="tabular-nums text-xs text-gray-500 shrink-0">{t.count}</span></button>
              </div>
              {isOpen && t.leagues.map((l) => (
                <button key={l.league} onClick={() => onPick(t.country, l.league)} className={`flex w-full items-center justify-between gap-2 pl-9 pr-3 py-1.5 text-[13px] transition ${league === l.league ? `${a.selBg} ${a.selText} font-medium` : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}><span className="truncate text-left">{l.league}</span><span className="tabular-nums text-xs text-gray-600 shrink-0">{l.count}</span></button>
              ))}
            </div>
          );
        })}
        {view.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-500">Nada encontrado.</div>}
      </div>
    </aside>
  );
}

export function LeagueFilterMobile({ tree, total, country, league, onPick }: {
  tree: LeagueTree; total: number; country: string; league: string; onPick: (country: string, league: string) => void;
}) {
  const options = [{ value: '|', label: `Todos os campeonatos (${total})` }];
  for (const t of tree) {
    options.push({ value: `${t.country}|`, label: `${t.country} (${t.count})` });
    for (const l of t.leagues) options.push({ value: `${t.country}|${l.league}`, label: `   ${l.league} (${l.count})` });
  }
  return (
    <div className="lg:hidden mb-3">
      <Select value={`${country}|${league}`} onChange={(v) => { const [c, l] = v.split('|'); onPick(c || '', l || ''); }} options={options} />
    </div>
  );
}
