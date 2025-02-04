import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface TooltipProps {
  text: string;
  visible: boolean;
  position: { top: number; left: number };
}

const Tooltip: React.FC<TooltipProps> = ({ text, visible, position }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !visible) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
        whiteSpace: 'nowrap',
      }}
      className="bg-gray-700 text-white text-xs px-4 py-2 rounded-md shadow-lg"
    >
      {text}
    </div>,
    document.body
  );
};

export default Tooltip;