import React, { useState } from 'react';
import Tooltip from '@/components/Tooltip';

const ExchangeCell: React.FC<{ value: number; exchange: string }> = ({ value, exchange }) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const showTooltip = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top - 40, // Ajuste da posição vertical
      left: rect.left + rect.width / 2, // Ajuste horizontal
    });
    setTooltipVisible(true);
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      <p className="text-red-500 font-medium">{value.toFixed(6)}</p>
      <p className="text-xs text-gray-400">{exchange}</p>
      <Tooltip
        text={`Detalhes da Exchange: ${exchange}`}
        position={tooltipPosition}
        visible={tooltipVisible}
      />
    </div>
  );
};

export default ExchangeCell;