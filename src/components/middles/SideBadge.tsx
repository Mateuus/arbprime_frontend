import { ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { MiddleLeg } from '@/interfaces/middle.interface';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * Selo da ponta da aposta, com tooltip explicativo (estilizado, não o nativo).
 * Totais: Over = seta pra CIMA (acima da linha), Under = seta pra BAIXO. Handicap:
 * Casa = C, Fora = F. Cor por lado (esquerda/"mais" = emerald; direita/"menos" =
 * rose) — combina com a reta do miolo.
 */
export function SideBadge({ side, selection }: { side: MiddleLeg['side']; selection?: string }) {
  const map: Record<string, { cls: string; node: ReactNode; expl: ReactNode }> = {
    over: {
      cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
      node: <ArrowUp size={14} strokeWidth={2.75} />,
      expl: <><strong className="text-emerald-300">Over (acima)</strong> — esta ponta ganha quando o resultado fica <strong className="text-white">acima</strong> da linha (Mais de).</>,
    },
    under: {
      cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
      node: <ArrowDown size={14} strokeWidth={2.75} />,
      expl: <><strong className="text-rose-300">Under (abaixo)</strong> — esta ponta ganha quando o resultado fica <strong className="text-white">abaixo</strong> da linha (Menos de).</>,
    },
    home: {
      cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
      node: <span className="text-[10px] font-bold">C</span>,
      expl: <><strong className="text-emerald-300">Casa (mandante)</strong> — handicap asiático do time da casa.</>,
    },
    away: {
      cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
      node: <span className="text-[10px] font-bold">F</span>,
      expl: <><strong className="text-rose-300">Fora (visitante)</strong> — handicap asiático do time visitante.</>,
    },
  };
  const m = map[side] || { cls: 'bg-white/5 text-gray-300 ring-white/15', node: <span className="text-[10px] font-bold">·</span>, expl: 'Ponta da aposta' };
  // Tooltip "interativo": além de explicar o lado, mostra A SELEÇÃO real desta perna.
  const label = (
    <>
      {m.expl}
      {selection && <div className="mt-1 border-t border-white/10 pt-1">Esta perna: <strong className="text-white">{selection}</strong></div>}
    </>
  );
  return (
    <Tooltip label={label} className="shrink-0">
      <span className={`grid h-6 w-6 cursor-help place-items-center rounded-md ring-1 ${m.cls}`}>
        {m.node}
      </span>
    </Tooltip>
  );
}

export default SideBadge;
