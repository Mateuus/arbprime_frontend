import React from 'react';
import Sparkline from './Sparkline';

interface Props {
  label: string;
  value: string;
  valueClass?: string;
  delta?: string;
  deltaClass?: string;
  spark?: number[];
  sparkColor?: string;
  icon?: React.ReactNode;
  loading?: boolean;
}

/** Card de KPI: rótulo, número grande, variação opcional e sparkline. */
export default function KpiCard({ label, value, valueClass = 'text-white', delta, deltaClass = 'text-zinc-400', spark, sparkColor, icon, loading }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-zinc-400 truncate">{label}</span>
        {icon && <span className="text-teal-300/70 shrink-0">{icon}</span>}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-24 rounded bg-white/10 animate-pulse" />
      ) : (
        <div className={`mt-1 text-2xl sm:text-3xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      )}
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className={`text-xs tabular-nums ${deltaClass}`}>{delta || ' '}</span>
        {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor} width={84} height={28} />}
      </div>
    </div>
  );
}
