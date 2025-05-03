'use client';
import { useState, MouseEvent } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown } from 'lucide-react';
import FloatingTooltip from '@/components/FloatingTooltip';
import { SurebetOdd } from '@/interfaces/arbitragem.interface';

export function RenderPriceWithHistory({ odd }: { odd: SurebetOdd }) {
  const history = odd.historyPrice;

  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 🔒 Caso não tenha histórico ou menos de 2 valores
  if (!history || (history && history.length < 2)) {
    return (
      <span className="text-green-600 font-semibold">{odd.price.toFixed(2)}</span>
    );
  }

  const current = history[0].price;
  const previous = history[1].price;
  const diff = current - previous;

  const ArrowIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : null;
  const arrowColor = diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : '';

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowTooltip(true);
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div className="flex justify-end items-center gap-1">
        {ArrowIcon && (
          <button onClick={handleClick}>
            <ArrowIcon size={14} className={arrowColor + ' cursor-pointer'} />
          </button>
        )}
        <span className="text-green-600 font-semibold">{current.toFixed(2)}</span>
      </div>

      <FloatingTooltip
        position={position}
        visible={showTooltip}
        onClose={() => setShowTooltip(false)}
        autoCloseAfterMs={4000}
      >
        {history.slice(0, 10).map((entry, i) => {
          const formattedTime = format(new Date(entry.timestamp * 1000), 'dd MMM HH:mm');
          return (
          <div
            key={i}
            className="grid grid-cols-[auto_40px_40px] whitespace-nowrap items-center"
          >
            <span>{formattedTime}</span>
            <span className="font-semibold text-right">{entry.price.toFixed(3)}</span>
            <span className={`text-right ${i === 0 ? (diff < 0 ? 'text-red-400' : 'text-green-400') : ''}`}>
              {i === 0 ? (diff > 0 ? '+' : '') + diff.toFixed(3) : '\u00A0'}
            </span>
          </div>
          );
        })}
      </FloatingTooltip>
    </>
  );
}
