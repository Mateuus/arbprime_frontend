import React from 'react';
import { BetStatusValue } from '@/gateways/api.gateway';
import { BET_STATUS_LABELS, BET_STATUS_STYLE } from './format';

/** Pílula de status da aposta (Aberta / Parcial / Liquidada / Anulada). */
export default function StatusBadge({ status }: { status: BetStatusValue }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${BET_STATUS_STYLE[status]}`}>
      {BET_STATUS_LABELS[status]}
    </span>
  );
}
