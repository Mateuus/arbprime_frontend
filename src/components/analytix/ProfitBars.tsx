import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { signedBRL, profitFill } from './format';

export interface BarRow { key: string; label: string; profit: number }

const fmtAxisK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

interface TooltipProps { active?: boolean; payload?: { payload: BarRow }[] }
const ChartTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload as BarRow;
  return (
    <div className="rounded-lg bg-brand-dark border border-white/15 shadow-xl px-3 py-2 text-xs">
      <div className="text-gray-300 mb-0.5">{p.label}</div>
      <div className={p.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}><strong>{signedBRL(p.profit)}</strong></div>
    </div>
  );
};

/**
 * Gráfico de barras de lucro/prejuízo por categoria. `horizontal` = barras
 * horizontais (bom p/ casas); senão verticais divergentes (bom p/ meses).
 */
export default function ProfitBars({ rows, height = 240, horizontal = false }: { rows: BarRow[]; height?: number; horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div style={{ width: '100%', height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis type="number" tickFormatter={fmtAxisK} stroke="#52525b" fontSize={11} />
            <YAxis type="category" dataKey="label" stroke="#52525b" fontSize={11} width={90} tick={{ fill: '#a1a1aa' }} />
            <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip />} />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {rows.map((r, i) => <Cell key={i} fill={profitFill(r.profit)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="label" stroke="#52525b" fontSize={11} tickMargin={6} />
          <YAxis tickFormatter={fmtAxisK} stroke="#52525b" fontSize={11} width={44} />
          <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip />} />
          <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {rows.map((r, i) => <Cell key={i} fill={profitFill(r.profit)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
