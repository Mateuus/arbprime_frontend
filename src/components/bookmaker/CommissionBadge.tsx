import { Percent } from 'lucide-react';

/**
 * Selo de comissão da casa (modelo de exchange, ex.: Betfair — a comissão incide
 * sobre o lucro). Só aparece quando a casa tem comissão cadastrada (> 0). Usado na
 * lista admin, no modal de casas do usuário, nos filtros e na calculadora.
 */
export function CommissionBadge({ pct, className = '' }: { pct?: number | null; className?: string }) {
  if (pct == null || !(Number(pct) > 0)) return null;
  const txt = String(pct).replace('.', ',');
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30 ${className}`}
      title={`Comissão de ${txt}% (exchange — incide sobre o lucro). Entra automática na calculadora.`}
    >
      <Percent size={9} /> {txt}%
    </span>
  );
}

export default CommissionBadge;
