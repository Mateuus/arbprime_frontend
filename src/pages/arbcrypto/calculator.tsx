
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  

  return (
   <>
   </>
  );
};

export default CalculatorPage;