import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { PublicCurvePointDTO } from '@/gateways/api.gateway';

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

interface TooltipProps { active?: boolean; payload?: { payload: PublicCurvePointDTO }[]; label?: string }
const ChartTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-brand-dark border border-white/15 shadow-xl px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{fmtDate(label || '')}</div>
      <div className="text-white">Índice: <strong>{p.index.toFixed(1)}</strong></div>
      {p.profitUnits != null && <div className="text-emerald-300">{p.profitUnits >= 0 ? '+' : ''}{p.profitUnits.toFixed(2)}u</div>}
    </div>
  );
};

/** Curva de evolução pública (índice base 100 — normalizado, sem R$). */
export default function PublicCurveChart({ data, height = 260 }: { data: PublicCurvePointDTO[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#52525b" fontSize={11} tickMargin={8} minTickGap={24} />
          <YAxis stroke="#52525b" fontSize={11} width={40} domain={['auto', 'auto']} />
          <ReferenceLine y={100} stroke="#52525b" strokeDasharray="4 3" />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="index" stroke="#34d399" strokeWidth={2} fill="url(#curveFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
