'use client';
import { SurebetData } from '@/interfaces/arbitragem.interface';
import ArbCard from './ArbCard';
import { getBestSurebet } from '@/utils/functions';

interface Props {
    data: SurebetData[];
    selectedId: string | number;
    onSelect: (id: string | number) => void;
    sortBy: string; // <- novo
  }
  
  export default function SportsArbList({ data, selectedId, onSelect, sortBy }: Props) {
    const sorted = [...data].sort((a, b) => {
      const aValue = sortBy === 'Percent'
        ? getBestSurebet(a.surebets)?.profitMargin ?? 0
        : sortBy === 'Time'
          ? new Date(a.date).getTime()
          : new Date(a.surebets[0]?.create_at || a.create_at).getTime(); // 👈 Age
    
      const bValue = sortBy === 'Percent'
        ? getBestSurebet(b.surebets)?.profitMargin ?? 0
        : sortBy === 'Time'
          ? new Date(b.date).getTime()
          : new Date(b.surebets[0]?.create_at || b.create_at).getTime(); // 👈 Age
    
          if (sortBy === 'Percent') return bValue - aValue;
          if (sortBy === 'Age') return bValue - aValue; // 👈 mais novo primeiro
          return aValue - bValue; // Time: mais próximo primeiro
    });

    return (
      <div className="overflow-y-auto h-[calc(91vh)]">
        {sorted.map((item) => {
          const best = getBestSurebet(item.surebets);
          return (
            <ArbCard
              key={item.id}
              data={{ ...item, surebets: [best] }}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          );
        })}
      </div>
    );
  }