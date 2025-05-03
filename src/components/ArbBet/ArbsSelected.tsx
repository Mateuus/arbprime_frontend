import { SurebetData } from '@/interfaces/arbitragem.interface';
import ArbCard from './ArbCard';
import { Clock, Eye, List, Moon } from 'lucide-react';
import React from 'react';

interface Props {
  data?: SurebetData | null;
  onSurebetSelect: (index: number) => void;
  selectedSurebetIndex: number;
}

export default function ArbsSelected({ data, onSurebetSelect, selectedSurebetIndex }: Props) {
  return (
    <div>
      <header className="w-full h-[40px] bg-gray-600 text-white flex items-center justify-between">
        {/* Mercados */}
        <div className="relative h-full">
          {/* Ícones sempre visíveis */}
          <div className="relative z-10 flex gap-5 items-center text-gray-300 px-4 h-full">
            <button type="button" className="hover:text-white focus:outline-none">
              <Clock size={18} />
            </button>
            <button type="button" className="hover:text-white focus:outline-none">
              <List size={18} />
            </button>
            <button type="button" className="hover:text-white focus:outline-none">
              <Moon size={18} />
            </button>
          </div>
        </div>

        {/* Ações do lado direito */}
        <div className="flex gap-3 text-sm text-white px-4">
          <button type="button" className="hover:text-white focus:outline-none">
            <Eye size={24} />
          </button>
        </div>
      </header>

      <div className="w-full overflow-y-auto h-[calc(70vh-10px)]">
        {data && data.surebets.map((surebet, idx) => (
          <React.Fragment key={idx}>
            <div className={`border ${selectedSurebetIndex === idx ? 'border-cyan-400 bg-cyan-900/30' : 'border-transparent'}`}>
              <ArbCard
                data={{ ...data, surebets: [surebet] }}
                selected={selectedSurebetIndex === idx}
                onSelect={() => onSurebetSelect(idx)}
              />
            </div>
          </React.Fragment>
        ))}

        {!data && (
          <div className="items-center text-center text-gray-400">Nenhuma surebet selecionada</div>
        )}
      </div>
    </div>
  );
}
