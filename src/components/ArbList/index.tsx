import React, { useState, useEffect } from 'react';
import { Arbitrage } from '@/interfaces';
import { openMarketsSideBySide } from '@/utils/functions';
import Tooltip from '@/components/Tooltip';
import { Binoculars, Trash } from 'lucide-react';
import Image from 'next/image';

interface ArbListProps {
  data: Arbitrage[];
  previousData?: Arbitrage[];
}

const ArbList: React.FC<ArbListProps> = ({ data, previousData = [] }) => {
  const [profitChanges, setProfitChanges] = useState<string[]>(Array(data.length).fill(''));
  const [rowHighlights, setRowHighlights] = useState<string[]>(Array(data.length).fill(''));
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const newProfitChanges = [...profitChanges];
    const newRowHighlights = [...rowHighlights];

    data.forEach((item, index) => {
      if (previousData[index]) {
        if (item.profit !== previousData[index].profit) {
          newRowHighlights[index] = item.profit > previousData[index].profit ? 'pulse-border-green' : 'pulse-border-red';
          newProfitChanges[index] = item.profit > previousData[index].profit ? 'flash-green' : 'flash-red';

          setTimeout(() => {
            setProfitChanges((prev) => {
              const updated = [...prev];
              updated[index] = '';
              return updated;
            });
            setRowHighlights((prev) => {
              const updated = [...prev];
              updated[index] = '';
              return updated;
            });
          }, 2000);
        }
      }
    });

    setProfitChanges(newProfitChanges);
    setRowHighlights(newRowHighlights);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, previousData]);

  const showTooltip = (text: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipText(text);
    setTooltipPosition({
      top: rect.top + window.scrollY - 10, // Adiciona o deslocamento vertical (scrollY)
      left: rect.left + rect.width / 2 + window.scrollX, // Adiciona o deslocamento horizontal (scrollX)
    });
    setTooltipVisible(true);
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="arbitrage-table-container bg-gray-800 p-4 rounded-lg shadow-md overflow-x-auto">
        <table className="w-full text-white text-sm">
          <thead>
            <tr className="border-b border-gray-600">
            <th className="py-2">Símbolo</th>
            <th className="py-2">Exchange A</th>
            <th className="py-2">Exchange B</th>
            <th className="py-2 hidden lg:table-cell">Volume</th>
            <th className="py-2">Profit (%)</th>
            <th className="py-2">P.Net (%)</th>
            <th className="py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className={`border-b border-gray-700 hover:bg-gray-700 ${rowHighlights[index]}`}>
                <td className="py-2 text-center flex items-center justify-center space-x-2">
                  {item.symbolId ? (
                    <Image
                      src={`https://www.mexc.com/api/platform/file/download/${item.symbolId}`}
                      alt={item.symbol}
                      width={24} // Tamanho base
                      height={24} // Tamanho base
                      className="rounded-full width-6 h-6 height-6"
                    />
                  ) : (
                    <span className="text-gray-500">Imagem não disponível</span>
                  )}
                  <span>{item.symbol}</span>
                </td>
      
                {/* Exchange A */}
                <td 
                    className="py-2 text-center"
                    onMouseEnter={(e) => showTooltip(`Comprar em Spot: ${item.spots[0]?.exchange || 'N/A'}`, e)}
                    onMouseLeave={hideTooltip}
                >
                    <p className="text-red-500 font-medium">{item.spots[0]?.bid.toFixed(6) || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{item.spots[0]?.exchange || 'N/A'} (Spot)</p>
                </td>

                {/* Exchange B */}
                <td 
                    className="py-2 text-center"
                    onMouseEnter={(e) => showTooltip(`Abrir Short: ${item.futures[0]?.exchange || 'N/A'}`, e)}
                    onMouseLeave={hideTooltip}
                >
                    <p className="text-green-500 font-medium">{item.futures[0]?.ask.toFixed(6) || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{item.futures[0]?.exchange || 'N/A'} (Future)</p>
                </td>

                {/* Volume (escondido em telas pequenas) */}
                <td className="py-2 text-center hidden lg:table-cell">
                    <p className="text-white font-medium">{item.volume.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                </td>

                {/* Profit */}
                <td 
                    className="py-2 text-center"
                    onMouseEnter={(e) => showTooltip(`Spread: ${item.spread.toFixed(6) || 'N/A'}`, e)}
                    onMouseLeave={hideTooltip}
                >
                    <p className="text-blue-500 font-medium">{item.profit.toFixed(2)}%</p>
                </td>

                {/* P.Net */}
                <td 
                    className="py-2 text-center"
                    onMouseEnter={(e) => showTooltip(`Taxa Total: ${item.totalFees.toFixed(3) || 'N/A'}%`, e)}
                    onMouseLeave={hideTooltip}
                >
                    <p
                    className={`font-medium ${
                        item.profitNet >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                    >
                    {item.profitNet.toFixed(2)}%
                    </p>
                </td>

                {/* Ações */}
                <td className="py-2 text-center">
                  {/* Botões organizados horizontalmente */}
                  <div className="flex justify-center items-center space-x-4">
                    {/* Botão Monitorar */}
                    <div>
                      <button
                        onMouseEnter={(e) => showTooltip(`Monitorar`, e)}
                        onMouseLeave={hideTooltip}
                        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                        onClick={() => openMarketsSideBySide(item)}
                      >
                        <Binoculars size={20} />
                      </button>
                    </div>

                    {/* Botão Adicionar à Lista de Exclusão */}
                    <div>
                      <button
                        onMouseEnter={(e) => showTooltip('Adicionar à Lista de Exclusão', e)}
                        onMouseLeave={hideTooltip}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                        onClick={() => openMarketsSideBySide(item)}
                      >
                        <Trash size={20} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      <Tooltip text={tooltipText} visible={tooltipVisible} position={tooltipPosition} />
    </div>
  );
};

export default ArbList;