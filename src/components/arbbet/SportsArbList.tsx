'use client';
import { SurebetData } from '@/interfaces/arbitragem.interface';
import ArbCard from './ArbCard';
import { getBestSurebet } from '@/utils/functions';

interface Props {
    data: SurebetData[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }
  
  export default function SportsArbList({ data, selectedId, onSelect }: Props) {
    return (
      <div className="overflow-y-auto h-[calc(91vh)]">
        {data.map((item) => {
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