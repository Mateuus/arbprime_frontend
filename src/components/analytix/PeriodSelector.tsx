import React from 'react';
import { PERIODS, PeriodKey } from './format';

interface Props {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
}

/** Seletor de período (7d | 30d | 90d | Ano | Tudo). */
export default function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/5 ring-1 ring-white/10 p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
            value === p.key ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:bg-white/10'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
