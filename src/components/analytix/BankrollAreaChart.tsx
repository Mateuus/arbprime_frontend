import React from 'react';
import {
  ResponsiveContainer, Area, XAxis, YAxis, CartesianGrid, Tooltip, Line, ComposedChart,
} from 'recharts';
import { TimeseriesPointDTO } from '@/gateways/api.gateway';
import { BRL, signedBRL } from './format';

const fmtAxisDate = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const fmtAxisK = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

interface TooltipProps { active?: boolean; payload?: { payload: TimeseriesPointDTO }[]; label?: string }
const ChartTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload as TimeseriesPointDTO;
  return (
    <div className="rounded-lg bg-brand-dark border border-white/15 shadow-xl px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{fmtAxisDate(label || '')}</div>
      <div className="text-white">Banca: <strong>{BRL(p.bankroll)}</strong></div>
      <div className="text-emerald-300">Lucro acum.: <strong>{signedBRL(p.cumulativeProfit)}</strong></div>
    </div>
  );
};

/** Curva de evolução da banca (área) + lucro acumulado (linha). */
export default function BankrollAreaChart({ data, height = 280 }: { data: TimeseriesPointDTO[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtAxisDate} stroke="#52525b" fontSize={11} tickMargin={8} minTickGap={24} />
          <YAxis tickFormatter={fmtAxisK} stroke="#52525b" fontSize={11} width={44} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="bankroll" stroke="#34d399" strokeWidth={2} fill="url(#bankrollFill)" />
          <Line type="monotone" dataKey="cumulativeProfit" stroke="#5eead4" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
