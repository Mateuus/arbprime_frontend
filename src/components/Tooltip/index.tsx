import React from 'react';

interface TooltipProps {
  text: string;
  visible: boolean;
  position: { top: number; left: number };
}

const Tooltip: React.FC<TooltipProps> = ({ text, position = { top: 0, left: 0 }, visible }) => {
    if (!visible) return null;
  
    return (
      <div
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          whiteSpace: 'nowrap',
          transform: 'translate(-50%, -100%)', // Centraliza acima do elemento
        }}
      >
        {text}
      </div>
    );
};
  

export default Tooltip;