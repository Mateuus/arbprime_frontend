import React from 'react';
import { Clock, Edit, Trash2 } from 'lucide-react';
import { SurebetData } from '@/interfaces/arbitragem.interface';

interface ArbCardProps {
  data: SurebetData;
  selected?: boolean;
  onSelect?: (surebet: SurebetData) => void;
}

export default function ArbCard({ data, selected, onSelect }: ArbCardProps) {
  const bestSurebet = data.surebets[0]; // já está ordenado por profitMargin

  return (
    <div className="overflow-hidden shadow-sm text-sm">
      {/* Top Bar */}
      <div
        className={`
          flex justify-between items-center bg-cyan-700 px-2 py-1 relative cursor-pointer 
          ${selected ? 'bg-[repeating-linear-gradient(45deg,#92c5e6_0px,#92c5e6_10px,#a7d3f1_10px,#a7d3f1_20px)]' : ''}
        `}
        onClick={() => onSelect?.(data)}
      >
        {/* Lucro */}
        <div className="bg-[#9adb52] text-black px-2 h-full flex items-center font-bold absolute left-0 top-0 bottom-0">
          {(bestSurebet.profitMargin * 100).toFixed(2)}%
        </div>

        {/* Esporte */}
        <div className="ml-[60px] font-semibold">
          {data.sport} 
          <span className="ml-1 text-[11px] text-gray-200">{selected && '[selected]'}</span>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 text-xs text-gray-800">
          <Clock size={14} />
          {formatTimer(data.update_at)}
          <button><Trash2 size={14} className="hover:text-red-500" /></button>
          <button><Edit size={14} className="hover:text-blue-400" /></button>
        </div>
      </div>
    </div>
  );
}

function formatTimer(updateAt: string): string {
  const updateTime = new Date(updateAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - updateTime) / 1000);
  return `${seconds} sec`;
}
