import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { WebSocketClient } from '@/hooks/websocket';

interface SpotData {
  exchange: string;
  ask: number;
  bid: number;
  volume: number;
}

interface FutureData {
  exchange: string;
  ask: number;
  bid: number;
  volume: number;
}

interface WebSocketData {
  symbol: string;
  spots: SpotData[];
  futures: FutureData[];
  spread: number;
  profit: number;
  profitNet: number;
  totalFees: number;
  volume: number;
  timestamp: number;
}

const CalculatorPage: React.FC = () => {
  const router = useRouter();
  const { symbol, spot, future } = router.query;

  const [data, setData] = useState<WebSocketData | null>(null);
  const wsClient = useMemo(() => new WebSocketClient(), []);

  useEffect(() => {
    if (symbol && spot && future) {
      const params = {
        method: 'monitor_pairs',
        symbol: symbol as string,
        spot: spot as string,
        future: future as string,
      };

      wsClient.connect<WebSocketData>(params, (response) => {
        if (response.success) {
          setData(response.data!);
        } else {
          console.error('Erro:', response.message);
        }
      });

      return () => {
        wsClient.disconnect();
      };
    }
  }, [symbol, spot, future, wsClient]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full">
        <h1 className="text-blue-400 text-2xl font-bold mb-6 text-center">Calculadora de Arbitragem</h1>

        {data ? (
          <>
            {/* Spot */}
            <div className="mb-6">
              <h2 className="text-gray-300 text-lg mb-2">Spot ({data.spots[0]?.exchange || 'N/A'})</h2>
              <div className="bg-gray-700 p-4 rounded-md text-sm text-gray-400">
                <p><span className="text-red-500 text-xl font-medium">{data.spots[0]?.ask.toFixed(5) || 'N/A'}</span></p>
                <p><span className="text-white font-bold">Volume:</span> {data.spots[0]?.volume.toLocaleString('en-US') || 'N/A'}</p>
              </div>
            </div>

            {/* Future */}
            <div className="mb-6">
              <h2 className="text-gray-300 text-lg mb-2">Future ({data.futures[0]?.exchange || 'N/A'})</h2>
              <div className="bg-gray-700 p-4 rounded-md text-sm text-gray-400">
                <p><span className="text-green-500 text-xl font-medium">{data.futures[0]?.bid.toFixed(5) || 'N/A'}</span></p>
                <p><span className="text-white font-bold">Volume:</span> {data.futures[0]?.volume.toLocaleString('en-US') || 'N/A'}</p>
              </div>
            </div>

            {/* Informações Gerais */}
            <div>
              <h2 className="text-gray-300 text-lg mb-2">Informações Gerais</h2>
              <div className="bg-gray-700 p-4 rounded-md text-sm text-gray-400">
                <p>
                  <span className="text-white font-bold">Spread:</span>
                  <span className={`text-xl font-bold ml-2 ${data.spread >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.spread.toFixed(6)}
                  </span>
                </p>
                <p>
                  <span className="text-white font-bold">Lucro:</span>
                  <span className={`text-xl font-bold ml-2 ${data.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.profit.toFixed(2)}%
                  </span>
                </p>
                <p>
                  <span className="text-white font-bold">Lucro Líquido:</span> 
                  <span className={`text-xl font-bold ml-2 ${data.profitNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.profitNet.toFixed(2)}%
                  </span>
                </p>
                <p><span className="text-white font-bold">Taxas Totais:</span> {data.totalFees.toFixed(2)}%</p>
                <p><span className="text-white font-bold">Volume:</span> {data.volume.toLocaleString('en-US')}</p>
                <p><span className="text-white font-bold">Timestamp:</span> {new Date(data.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-center">Carregando dados de arbitragem...</p>
        )}
      </div>
    </div>
  );
};

export default CalculatorPage;