import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';

// useLayoutEffect dá warning no SSR do Next; sem window cai no useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Tooltip em formato de "card" no tema do site (substitui o `title` nativo).
 * O texto SEMPRE quebra dentro de uma largura fixa — vira um cartão compacto,
 * nunca uma linha gigante atravessando a tela. Posição `fixed` calculada do
 * elemento, clampada na horizontal e com flip vertical (abre embaixo quando não
 * cabe em cima). Funciona com hover (desktop) e toque (mobile).
 */
export function Tooltip({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  const [anchor, setAnchor] = useState<{ cx: number; top: number; bottom: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const tipRef = useRef<HTMLSpanElement>(null);

  const show = (e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ cx: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  };
  const hide = () => setAnchor(null);

  useIsoLayoutEffect(() => {
    if (!anchor || !tipRef.current) return;
    const margin = 8;
    const w = tipRef.current.offsetWidth;
    const h = tipRef.current.offsetHeight;
    const left = Math.min(Math.max(anchor.cx - w / 2, margin), window.innerWidth - w - margin);
    // Abre acima do elemento; se não couber, faz flip e abre embaixo.
    const above = anchor.top - margin - h;
    const top = above >= margin ? above : anchor.bottom + margin;
    setPos({ left, top });
  }, [anchor]);

  return (
    <span className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide} onTouchStart={show} onTouchEnd={hide}>
      {children}
      {anchor && (
        <span
          ref={tipRef}
          style={{ left: pos.left, top: pos.top }}
          className="pointer-events-none fixed z-[10000] w-max max-w-[260px] whitespace-normal break-words rounded-xl bg-zinc-900/95 px-3 py-2 text-[12px] font-normal leading-relaxed text-gray-100 ring-1 ring-white/15 shadow-2xl backdrop-blur-sm"
        >
          {label}
        </span>
      )}
    </span>
  );
}

export default Tooltip;
