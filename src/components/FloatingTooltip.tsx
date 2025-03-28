'use client';
import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: ReactNode;
  position: { x: number; y: number };
  visible: boolean;
  onClose: () => void;
  autoCloseAfterMs?: number;
}

export default function FloatingTooltip({
  children,
  position,
  visible,
  onClose,
  autoCloseAfterMs = 4000,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    const timeout = setTimeout(() => {
      onClose();
    }, autoCloseAfterMs);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timeout);
    };
  }, [visible, onClose, autoCloseAfterMs]);

  if (!visible) return null;

  const TOOLTIP_WIDTH = 160;
  const TOOLTIP_PADDING = 12;
  const isTooCloseToRight = position.x + TOOLTIP_WIDTH + TOOLTIP_PADDING > window.innerWidth;

  const style: React.CSSProperties = {
    top: position.y + 12,
    left: isTooCloseToRight ? position.x - TOOLTIP_WIDTH - 10 : position.x + 10,
    position: 'fixed',
    zIndex: 9999,
  };

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="bg-gray-800 text-white text-[11px] rounded p-2 shadow-lg whitespace-nowrap pointer-events-auto transition-all duration-100"
    >
      {children}
    </div>,
    document.body
  );
}
