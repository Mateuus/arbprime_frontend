import { useEffect, useState } from 'react';
import { wsManager } from '@/services/wsManager';
import ArbCard from '@/components/ArbCard';
import ArbList from '@/components/ArbList';
import { Arbitrage } from '@/interfaces';
import { Pause, Play, RefreshCcw, Star, StarOff } from 'lucide-react';

const ArbCryptoPerpetuals: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [data, setData] = useState<Arbitrage[]>([]);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [highlightChange, setHighlightChange] = useState(true);
  const [previousData, setPreviousData] = useState<Arbitrage[]>([]);

  // Atualização automática/manual via wsManager
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (msg: any) => {
      if (msg.method === 'arbitrage_pairs') {
        setData(msg.data || []);
      }
    };

    wsManager.subscribe(handler);

    if (autoUpdate) {
      wsManager.send({
        method: 'arbitrage_pairs',
        options: { autoUpdate: true },
      });
    }

    return () => wsManager.unsubscribe(handler);
  }, [autoUpdate]);

  // Manual fetch para botão
  const fetchArbitrageData = () => {
    wsManager.send({ method: 'arbitrage_pairs' });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    if (highlightChange) {
      setPreviousData([...data]);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, highlightChange]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold text-white mb-4">Arbitragem ao Vivo</h1>
        <div className="flex justify-center gap-6 items-center">
          {/* Botão de Atualização Automática */}
          <div className="relative group">
            <button
              onClick={() => setAutoUpdate(!autoUpdate)}
              className={`p-3 rounded-full transition ${
                autoUpdate ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {autoUpdate ? <Pause size={24} color="white" /> : <Play size={24} color="white" />}
            </button>
            <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs px-2 py-1 rounded-md">
              {autoUpdate ? 'Desativar Atualização' : 'Ativar Atualização'}
            </span>
          </div>

          {/* Botão de Destaques */}
          <div className="relative group">
            <button
              onClick={() => setHighlightChange(!highlightChange)}
              className={`p-3 rounded-full transition ${
                highlightChange ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {highlightChange ? <Star size={24} color="white" /> : <StarOff size={24} color="white" />}
            </button>
            <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs px-2 py-1 rounded-md">
              {highlightChange ? 'Desativar Destaques' : 'Ativar Destaques'}
            </span>
          </div>

          {/* Botão de Atualização Manual */}
          {!autoUpdate && (
            <div className="relative group">
              <button
                onClick={fetchArbitrageData}
                className="p-3 rounded-full transition bg-blue-500 hover:bg-blue-600"
              >
                <RefreshCcw size={24} color="white" />
              </button>
              <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-700 text-white text-xs px-2 py-1 rounded-md">
                Atualizar Manualmente
              </span>
            </div>
          )}
        </div>
      </header>

      <div>
        {isMobile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.map((item, index) => (
              <ArbCard key={index} data={item} previousData={previousData[index]} />
            ))}
          </div>
        ) : (
          <ArbList data={data} previousData={previousData} />
        )}
      </div>
    </div>
  );
};

export default ArbCryptoPerpetuals;