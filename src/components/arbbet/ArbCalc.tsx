'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, ListOrdered } from 'lucide-react';
import { SurebetData, SurebetOdd } from '@/interfaces/arbitragem.interface';

interface ArbCalcProps {
  data: SurebetData;
  showToggleButton?: boolean;
  showMobileDetails?: boolean;
  setShowMobileDetails?: (value: boolean) => void;
  selectedSurebetIndex?: number;
}

export default function ArbCalc({
  data,
  showToggleButton = false,
  showMobileDetails,
  setShowMobileDetails,
  selectedSurebetIndex = 0
}: ArbCalcProps) {
  const latestData = useRef<SurebetData>(data);
  const [base, setBase] = useState(5000);
  const [selectedOdds, setSelectedOdds] = useState<SurebetOdd[]>([]);
  const [stakes, setStakes] = useState<number[]>([]);
  const [stakeInputs, setStakeInputs] = useState<string[]>([]);
  const [editedStake, setEditedStake] = useState<boolean[]>([]);

  // Atualiza a ref sempre que `data` mudar (WebSocket)
  useEffect(() => {
    latestData.current = data;
  }, [data]);

  // Só atualiza os campos quando o selectedSurebetIndex muda
  useEffect(() => {
    const surebet = latestData.current.surebets[selectedSurebetIndex];
    if (!surebet) return;
    const initialOdds = surebet.surebet;
    const defaultBase = 5000;
    const totalInverse = initialOdds.reduce((acc, o) => acc + 1 / o.price, 0);
    const newStakes = initialOdds.map((o) => (defaultBase * (1 / o.price)) / totalInverse);
    setBase(defaultBase);
    setSelectedOdds(initialOdds);
    setStakes(newStakes);
    setStakeInputs(newStakes.map(s => s.toFixed(2).replace('.', ',')));
    setEditedStake(new Array(newStakes.length).fill(false));
  }, [selectedSurebetIndex]);

  const surebet = latestData.current.surebets[selectedSurebetIndex];
  if (!surebet) return null;

  function handleOddChange(index: number, newOdd: SurebetOdd) {
    const updated = [...selectedOdds];
    updated[index] = newOdd;
    setSelectedOdds(updated);
  }

  function handleStakeTyping(index: number, value: string) {
    const updatedInputs = [...stakeInputs];
    updatedInputs[index] = value;
    setStakeInputs(updatedInputs);
    const updatedEdited = [...editedStake];
    updatedEdited[index] = true;
    setEditedStake(updatedEdited);
  }

  function applyStakeChange(index: number) {
    const parsed = parseFloat(stakeInputs[index].replace(',', '.'));
    if (isNaN(parsed)) return;

    const fixed = parsed;
    const fixedOdd = selectedOdds[index];
    const totalInv = selectedOdds.reduce((acc, o) => acc + 1 / o.price, 0);
    const newBase = (fixed * totalInv) / (1 / fixedOdd.price);
    const newStakes = selectedOdds.map((o) => (newBase * (1 / o.price)) / totalInv);

    setStakes(newStakes);
    setStakeInputs(newStakes.map(s => s.toFixed(2).replace('.', ',')));
    setBase(newBase);
    const updatedEdited = [...editedStake];
    updatedEdited[index] = false;
    setEditedStake(updatedEdited);
  }

  const totalInverse = selectedOdds.reduce((acc, o) => acc + 1 / o.price, 0);
  const newProfit = (1 - totalInverse) * 100;
  const expectedReturn = Math.min(...stakes.map((s, i) => s * selectedOdds[i].price));
  const netProfit = expectedReturn - base;

  function getOtherOptions(baseOdd: SurebetOdd): SurebetOdd[] {
    return baseOdd.otherOdds?.map((alt) => ({
      ...baseOdd,
      bookmaker: alt.bookmaker,
      price: alt.price
    })) || [];
  }

  return (
    <div className="flex flex-col h-full text-sm bg-[#2e3340] rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#1f2937] text-white">
        <div className="flex items-center gap-2">
          <div className={`px-2 font-bold ${newProfit >= 0 ? 'bg-[#9adb52] text-black' : 'bg-red-500 text-white'}`}>{newProfit.toFixed(2)}%</div>
          <div className="font-semibold">{data.sport}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          <span>{formatTimer(surebet.update_at)}</span>
        </div>
      </div>

      {/* Event */}
      <div className="bg-[#232b3b] text-white px-2 py-1 text-xs font-semibold border-b border-black">
        {data.home} x {data.away}
      </div>

      {/* Odds */}
      <div className="flex-1 bg-[#3b4252] text-white p-2 space-y-3">
        {selectedOdds.map((odd, index) => {
          const otherOptions = getOtherOptions(odd);
          const fullList = [odd, ...otherOptions.filter(o => o.bookmaker !== odd.bookmaker)];

          return (
            <div key={index} className="bg-[#2d3648] p-2 rounded space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="font-bold min-w-[120px]">{odd.option}</div>
                <select
                  value={odd.bookmaker + '_' + odd.price}
                  onChange={(e) => {
                    const [bookmaker, price] = e.target.value.split('_');
                    const newOdd = fullList.find(o => o.bookmaker === bookmaker && o.price === Number(price));
                    if (newOdd) handleOddChange(index, newOdd);
                  }}
                  className="bg-white text-black text-xs px-2 py-1 rounded w-full sm:w-auto"
                >
                  {fullList.map((o, i) => (
                    <option key={i} value={o.bookmaker + '_' + o.price}>
                      {o.bookmaker}: {o.price.toFixed(2)} ({i})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Stake:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="text-black text-xs rounded px-1 w-full max-w-[120px]"
                  value={stakeInputs[index] || ''}
                  onChange={(e) => handleStakeTyping(index, e.target.value)}
                />
                {editedStake[index] && (
                  <button
                    onClick={() => applyStakeChange(index)}
                    className="text-green-500 hover:text-green-300"
                    title="Aplicar stake"
                  >
                    <CheckCircle size={18} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-2 py-2 bg-[#111318] text-white text-xs flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            Total:
            <input
              type="number"
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              className="w-20 px-1 py-0.5 text-black text-xs rounded"
            />
          </span>
          <span className="text-green-400">
            Retorno: R$ {expectedReturn.toFixed(2)} | Lucro: R$ {netProfit.toFixed(2)}
          </span>
        </div>

        {showToggleButton && setShowMobileDetails && (
          <button
            onClick={() => setShowMobileDetails(!showMobileDetails)}
            className="relative flex items-center justify-center w-7 h-7"
            title={showMobileDetails ? 'Voltar' : 'Ver Detalhes'}
          >
            <ListOrdered size={24} className="text-slate-300" />
            {showMobileDetails ? (
              <CheckCircle size={14} className="text-green-500 absolute -bottom-1 -left-1 bg-gray-800 rounded-full" />
            ) : (
              <XCircle size={14} className="text-red-500 absolute -bottom-1 -left-1 bg-gray-800 rounded-full" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimer(updateAt: string): string {
  const updateTime = new Date(updateAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - updateTime) / 1000);
  return `${seconds}s`;
}
