import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';

// useLayoutEffect dá warning no SSR do Next; sem window cai no useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Tooltip customizado no tema do site (substitui o `title` nativo do navegador).
 * Posição `fixed` calculada do elemento, clampada para não sair da tela.
 * Funciona com hover (desktop) e toque (mobile).
 */
export function Tooltip({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  const [anchor, setAnchor] = useState<{ cx: number; top: number } | null>(null);
  const [left, setLeft] = useState(0);
  const tipRef = useRef<HTMLSpanElement>(null);

  const show = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top });
  };
  const hide = () => setAnchor(null);

  useIsoLayoutEffect(() => {
    if (!anchor || !tipRef.current) return;
    const margin = 8;
    const w = tipRef.current.offsetWidth;
    setLeft(Math.min(Math.max(anchor.cx - w / 2, margin), window.innerWidth - w - margin));
  }, [anchor]);

  return (
    <span className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onTouchStart={show} onTouchEnd={hide}>
      {children}
      {anchor && (
        <span
          ref={tipRef}
          style={{ left, top: anchor.top - 8 }}
          className="pointer-events-none fixed z-[10000] -translate-y-full max-w-[80vw] rounded-lg bg-black/90 px-2.5 py-1.5 text-[11px] leading-snug text-gray-100 ring-1 ring-white/10 shadow-xl whitespace-normal sm:whitespace-nowrap"
        >
          {label}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
