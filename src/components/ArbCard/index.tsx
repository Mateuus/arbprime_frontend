import React, { useState, useEffect } from 'react';
import { Arbitrage } from '@/interfaces';
import { ArrowUp, ArrowDown, Binoculars } from 'lucide-react';
import { openMarketsSideBySide } from '@/utils/functions';

interface ArbCardProps {
  data: Arbitrage;
  highlightClass?: string;
  previousData?: Arbitrage;
}

const ArbCard: React.FC<ArbCardProps> = ({ data, highlightClass, previousData }) => {
  const [profitChange, setProfitChange] = useState('');
  const [cardHighlight, setCardHighlight] = useState('');
  //const [selectedExchange, setSelectedExchange] = useState(data.spots[0]?.exchange || '');

  useEffect(() => {
    if (previousData) {
      if (data.profit !== previousData.profit) {
        const newHighlight = data.profit > previousData.profit ? 'pulse-border-green' : 'pulse-border-red';
        setProfitChange(data.profit > previousData.profit ? 'flash-green' : 'flash-red');
        setCardHighlight(newHighlight);

        setTimeout(() => {
          setProfitChange('');
          setCardHighlight('');
        }, 2000);
      }
    }
  }, [data, previousData]);
  

  return (
    <div className={`relative bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-all flex flex-col gap-4 
      ${cardHighlight}`}>

      {/* Barra de Destaque */}
      {highlightClass && <div className={`absolute top-0 left-0 bottom-0 w-2 rounded-l ${highlightClass}`} />}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{data.symbol}</h2>
        <span className={`text-blue-500 text-sm font-bold flex items-center ${profitChange}`}>
          {profitChange === 'flash-green' && <ArrowUp className="ml-1 text-green-500" size={16} />}
          {profitChange === 'flash-red' && <ArrowDown className="ml-1 text-red-500" size={16} />}
          {data.profit.toFixed(2)}% Profit
        </span>
      </div>

      {/* Preços e Exchanges */}
      <div className="grid grid-cols-2 gap-4 text-center">
        {/* Exchange A */}
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-400">Exchange A</span>
          <span className="text-red-500 text-xl font-medium">{data.spots[0]?.ask.toFixed(6) || 'N/A'}</span>
          <span className="text-xs text-gray-200">{data.spots[0]?.exchange || 'N/A'} (Spot)</span>
        </div>
        
        {/* Exchange B */}
        <div className="flex flex-col items-center">
          <span className="text-sm text-gray-400">Exchange B</span>
          <span className="text-green-500 text-xl font-medium">{data.futures[0]?.bid.toFixed(6) || 'N/A'}</span>
          <span className="text-xs text-gray-200">{data.futures[0]?.exchange || 'N/A'} (Futuros)</span>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex flex-col">
          <span className="text-sm text-gray-400">Volume</span>
          <span className={`text-white text-base font-medium flex items-center ${data.volume}`}>
            {data.volume.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-sm text-gray-400">Lucro Taxa</span>
          <span className={`text-green-500 text-base font-medium flex items-center ${profitChange}`}>
            {profitChange === 'flash-green' && <ArrowUp className="ml-1 text-green-500" size={16} />}
            {profitChange === 'flash-red' && <ArrowDown className="ml-1 text-red-500" size={16} />}
            {data.profitNet.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Botões de Ação com Tooltips */}
      <div className="flex justify-end gap-4 items-center mt-2">
        {/* Botão Ver Detalhes */}
        <div className="relative group">
        <button
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
          onClick={() => openMarketsSideBySide(data)}
        >
            <Binoculars size={20} />
          </button>
          {/* Tooltip */}
          <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs px-2 py-1 rounded-md">
            Monitorar
          </span>
        </div>

        <span className={`text-white text-sm font-bold flex items-center ${profitChange}`}>
          {data.totalFees.toFixed(4)}
        </span>

      </div>
    </div>
  );
};

export default ArbCard;