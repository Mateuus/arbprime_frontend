import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { BRL } from './format';

export interface DonutSlice { key: string; label: string; value: number }

const COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#a3e635'];

interface TooltipProps { active?: boolean; payload?: { payload: DonutSlice }[] }
const ChartTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload as DonutSlice;
  return (
    <div className="rounded-lg bg-brand-dark border border-white/15 shadow-xl px-3 py-2 text-xs">
      <div className="text-gray-300">{p.label}</div>
      <div className="text-white"><strong>{BRL(p.value)}</strong></div>
    </div>
  );
};

/** Donut de distribuição (top categorias + "Outros"). Valores negativos viram 0. */
export default function DonutBreakdown({ slices, height = 240 }: { slices: DonutSlice[]; height?: number }) {
  const positive = slices.map((s) => ({ ...s, value: Math.max(0, s.value) })).filter((s) => s.value > 0);
  if (!positive.length) {
    return <div style={{ height }} className="grid place-items-center text-sm text-gray-500">Sem dados no período</div>;
  }
  return (
    <div style={{ width: '100%', height }} className="min-w-0 flex items-center">
      <ResponsiveContainer width="60%" height="100%">
        <PieChart>
          <Pie data={positive} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {positive.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 min-w-0 space-y-1 text-xs">
        {positive.slice(0, 8).map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-gray-300 truncate flex-1">{s.label}</span>
            <span className="text-gray-400 tabular-nums shrink-0">{BRL(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Reduz uma lista a top N fatias + "Outros". */
export function topSlices(rows: { key: string; label: string; value: number }[], n = 6): DonutSlice[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  if (rest.length) {
    const sum = rest.reduce((a, r) => a + r.value, 0);
    if (sum > 0) top.push({ key: '__outros__', label: 'Outros', value: sum });
  }
  return top;
}
