// CalculatorPage.tsx com wsManager
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { wsManager } from '@/services/wsManager';
import { useWsDispatcher } from '@/hooks/useWsDispatcher';
import { MonitorPairsResponse } from '@/hooks/wsMessageTypes';

const CalculatorPage: React.FC = () => {
  const router = useRouter();
  const { symbol, spot, future } = router.query;

  const [data, setData] = useState<MonitorPairsResponse['data'] | null>(null);

  // Envio automático quando os parâmetros estiverem disponíveis
  useEffect(() => {
    if (symbol && spot && future) {
      wsManager.sendWhenReady({
        method: 'monitor_pairs',
        options: {
          symbol,
          exchangeA: spot,
          exchangeA_type: 'spot',
          exchangeB: future,
          exchangeB_type: 'future',
        },
      }).catch((err) => {
        console.error('[WS] Falha ao enviar monitor_pairs:', err.message);
      });
    }
  }, [symbol, spot, future]);

  // Disparador de resposta automática
  useWsDispatcher({
    monitor_pairs: (msg) => {
      setData(msg.data);
    },
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full">
        <h1 className="text-blue-400 text-2xl font-bold mb-6 text-center">Calculadora de Arbitragem</h1>

        {data ? (
          <>
            {/* Spot */}
            <div className="mb-6">
              <h2 className="text-gray-300 text-lg mb-2">Spot ({data.dataA[0]?.exchange || 'N/A'})</h2>
              <div className="bg-gray-700 p-4 rounded-md text-sm text-gray-400">
                <p><span className="text-red-500 text-xl font-medium">{data.dataA[0]?.ask.toFixed(5) || 'N/A'}</span></p>
                <p><span className="text-white font-bold">Volume:</span> {data.dataA[0]?.volume.toLocaleString('en-US') || 'N/A'}</p>
              </div>
            </div>

            {/* Future */}
            <div className="mb-6">
              <h2 className="text-gray-300 text-lg mb-2">Future ({data.dataB[0]?.exchange || 'N/A'})</h2>
              <div className="bg-gray-700 p-4 rounded-md text-sm text-gray-400">
                <p><span className="text-green-500 text-xl font-medium">{data.dataB[0]?.bid.toFixed(5) || 'N/A'}</span></p>
                <p><span className="text-white font-bold">Volume:</span> {data.dataB[0]?.volume.toLocaleString('en-US') || 'N/A'}</p>
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