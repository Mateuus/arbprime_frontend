import React from 'react';
import { LegStatusValue } from '@/gateways/api.gateway';
import { LEG_STATUS_LABELS, LEG_STATUS_STYLE } from './format';

/** Pílula de status de UMA perna (Pendente / Ganha / Perdida / Anulada / ...). */
export default function LegStatusBadge({ status, className = '' }: { status: LegStatusValue; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${LEG_STATUS_STYLE[status]} ${className}`}>
      {LEG_STATUS_LABELS[status]}
    </span>
  );
}
