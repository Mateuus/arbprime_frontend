'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SurebetData } from '@/interfaces/arbitragem.interface';
import { CheckCircle, ListOrdered, XCircle } from 'lucide-react';

interface ArbCalcProps {
  data: SurebetData;
  selectedSurebetIndex?: number;
  showToggleButton?: boolean;
  showMobileDetails?: boolean;
  setShowMobileDetails?: (value: boolean) => void;
}

export default function ArbCalc({
  data,
  selectedSurebetIndex = 0,
  showToggleButton = false,
  showMobileDetails,
  setShowMobileDetails,
}: ArbCalcProps) {
  const latestData = useRef<SurebetData>(data);

  const [base, setBase] = useState(1000);
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);
  const [oddInputs, setOddInputs] = useState<string[]>([]);
  const [originalOddsMap, setOriginalOddsMap] = useState<Map<string, number[]>>(new Map());
  const [stakes, setStakes] = useState<number[]>([]);
  const [stakeInputs, setStakeInputs] = useState<string[]>([]);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => {
    const surebet = latestData.current.surebets[selectedSurebetIndex];
    if (!surebet) return;

    const initialOdds = surebet.surebet;
    const bookmakers = initialOdds.map(o => o.bookmaker);
    const odds = initialOdds.map(o => o.price.toString().replace('.', ','));

    const oddsMap = new Map<string, number[]>();
    initialOdds.forEach((odd, i) => {
      const all = [odd, ...(odd.otherOdds || [])];
      all.forEach(o => {
        if (!oddsMap.has(o.bookmaker)) oddsMap.set(o.bookmaker, []);
        oddsMap.get(o.bookmaker)![i] = o.price;
      });
    });

    const totalInverse = initialOdds.reduce((acc, o) => acc + 1 / o.price, 0);
    const initialStakes = initialOdds.map((o) => (base * (1 / o.price)) / totalInverse);

    setSelectedBookmakers(bookmakers);
    setOriginalOddsMap(oddsMap);
    setOddInputs(odds);
    setStakes(initialStakes);
    setStakeInputs(initialStakes.map(s => s.toFixed(2).replace('.', ',')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurebetIndex]);

  // Durante o render usamos a prop `data` (sempre a mais recente). O ref `latestData`
  // serve apenas para o efeito de recálculo evitar closures obsoletas sem depender de `data`.
  const surebet = data.surebets[selectedSurebetIndex];
  if (!surebet) return null;

  const oddsAsNumbers = oddInputs.map(o => parseFloat(o.replace(',', '.')));
  const expectedReturn = Math.min(...stakes.map((s, i) => s * oddsAsNumbers[i]));
  const netProfit = expectedReturn - base;
  const profit = (netProfit / base) * 100;

  const handleStakeTyping = (index: number, value: string) => {
    const updatedInputs = [...stakeInputs];
    updatedInputs[index] = value;
    setStakeInputs(updatedInputs);
  };

  const updateStakeFromOdds = (updatedOdds: number[]) => {
    const totalInv = updatedOdds.reduce((acc, price) => acc + 1 / price, 0);
    const newStakes = updatedOdds.map((price) => (base * (1 / price)) / totalInv);
    setStakes(newStakes);
    setStakeInputs(newStakes.map(s => s.toFixed(2).replace('.', ',')));
  };

  return (
    <div className="p-2 bg-[#f5f6f7] text-sm text-black rounded">
      <div className="flex justify-between items-center font-bold mb-2">
        <div className="text-green-700">{profit.toFixed(2)}%</div>
        <div className="text-gray-600">
          {data.sport} - {data.home} x {data.away}
        </div>
      </div>

      {surebet.surebet.map((odd, index) => {
        const allOptions = [odd, ...(odd.otherOdds || [])];
        const uniqueOptions = allOptions.filter(
          (opt, idx, self) =>
            self.findIndex(o => o.bookmaker === opt.bookmaker) === idx
        );
        const currentBookmaker = selectedBookmakers[index];
        const currentOdd = parseFloat(oddInputs[index]?.replace(',', '.'));

        return (
          <div key={index} className="flex flex-wrap items-center bg-[#e6f5e5] mb-2 rounded px-2 py-1 gap-2">
            <div className="min-w-[100px] font-semibold text-gray-700">{odd.option}</div>

            {/* Casa de aposta */}
            <select
              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs"
              value={currentBookmaker}
              onChange={(e) => {
                const updated = [...selectedBookmakers];
                updated[index] = e.target.value;
                setSelectedBookmakers(updated);

                const resetPrice = originalOddsMap.get(e.target.value)?.[index];
                if (resetPrice) {
                  const updatedOdds = [...oddInputs];
                  updatedOdds[index] = resetPrice.toString().replace('.', ',');
                  setOddInputs(updatedOdds);
                  updateStakeFromOdds(updatedOdds.map(p => parseFloat(p.replace(',', '.'))));
                }
              }}
            >
              {uniqueOptions.map((o, i) => (
                <option key={i} value={o.bookmaker}>
                  {o.bookmaker}: {o.price}
                </option>
              ))}
            </select>

            {/* Refresh odd */}
            <button
              title="Restaurar odd original"
              className="text-blue-600 hover:text-blue-800"
              onClick={() => {
                const resetPrice = originalOddsMap.get(currentBookmaker)?.[index];
                if (resetPrice) {
                  const updatedOdds = [...oddInputs];
                  updatedOdds[index] = resetPrice.toString().replace('.', ',');
                  setOddInputs(updatedOdds);
                  updateStakeFromOdds(updatedOdds.map(p => parseFloat(p.replace(',', '.'))));
                }
              }}
            >
              🔄
            </button>

            {/* Cotação (editável) */}
            <input
              type="text"
              className="w-[100px] text-center bg-white border border-gray-300 rounded px-2 py-1"
              value={oddInputs[index]}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const updated = [...oddInputs];
                updated[index] = e.target.value;
                setOddInputs(updated);
                const parsed = parseFloat(e.target.value.replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) {
                  updateStakeFromOdds(updated.map(p => parseFloat(p.replace(',', '.'))));
                }
              }}
            />

            {/* Stake (editável) */}
            <input
              type="text"
              className="w-[80px] text-right bg-white border border-gray-300 rounded px-2 py-1"
              value={stakeInputs[index] || ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => handleStakeTyping(index, e.target.value)}
              onBlur={() => {
                const val = stakeInputs[index];
                const parsed = parseFloat(val.replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) {
                  const totalInv = oddsAsNumbers.reduce((acc, price) => acc + 1 / price, 0);
                  const newBase = (parsed * totalInv) / (1 / oddsAsNumbers[index]);
                  const newStakes = oddsAsNumbers.map((price) => (newBase * (1 / price)) / totalInv);

                  setBase(newBase);
                  setStakes(newStakes);
                  setStakeInputs(newStakes.map(s => s.toFixed(2).replace('.', ',')));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />

            {/* Lucro estimado */}
            <div className="w-[50px] text-center text-green-600 font-bold">
              {((currentOdd * stakes[index]) - base).toFixed(2)}
            </div>

            {/* Ação futura */}
            <button className="ml-auto bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-1 rounded">
              BET
            </button>
          </div>
        );
      })}

      {/* Rodapé com total + toggle */}
      <div className="mt-3 flex justify-between items-center text-xs text-gray-700">
        <div className="flex items-center gap-1">
          Total:
          <input
            type="text"
            className="w-[80px] text-right bg-white border border-gray-300 rounded px-2 py-1"
            value={base.toString().replace('.', ',')}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(',', '.');
              let parsed = parseFloat(raw);
              if (isNaN(parsed) || parsed <= 0) parsed = 1000;
              setBase(parsed);
              const totalInv = oddsAsNumbers.reduce((acc, price) => acc + 1 / price, 0);
              const newStakes = oddsAsNumbers.map((price) => (parsed * (1 / price)) / totalInv);
              setStakes(newStakes);
              setStakeInputs(newStakes.map(s => s.toFixed(2).replace('.', ',')));
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span>
            Retorno: <strong>{expectedReturn.toFixed(2)}</strong> | Lucro: <strong>{netProfit.toFixed(2)}</strong>
          </span>

          {showToggleButton && setShowMobileDetails && (
          <button
            onClick={() => setShowMobileDetails(!showMobileDetails)}
            className="relative flex items-center justify-center w-7 h-7"
            title={showMobileDetails ? 'Voltar' : 'Ver Detalhes'}
          >
            <ListOrdered size={20} className="text-black" />
            {showMobileDetails ? (
              <CheckCircle size={14} className="text-green-500 absolute -bottom-1 -left-1 bg-gray-800 rounded-full" />
            ) : (
              <XCircle size={14} className="text-red-500 absolute -bottom-1 -left-1 bg-gray-800 rounded-full" />
            )}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
