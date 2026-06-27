import { useState, useRef, useEffect, useCallback } from 'react';

export interface AnchoredPos { top: number; left: number; width: number }

/**
 * Posiciona um popover/dropdown preso a um botão-âncora usando `position: fixed`
 * calculado do getBoundingClientRect e CLAMPADO dentro da viewport — então o menu
 * nunca abre fora da tela. Resolve o bug clássico do mobile em que uma row com
 * `flex-wrap` joga o botão para perto da borda e o painel (largura ~100vw) com
 * `absolute left-0/right-0` estoura para fora, criando scroll horizontal.
 *
 * Uso (botão único ou vários — só um aberto por vez):
 *   const pop = usePopover(open, () => setOpen(false), { align: 'right' });
 *   <button onClick={(e) => { if (!open) pop.place(e.currentTarget); setOpen(o => !o); }} />
 *   {open && pop.pos && (
 *     <div ref={pop.menuRef} style={{ position:'fixed', top: pop.pos.top, left: pop.pos.left, width: pop.pos.width }} />
 *   )}
 *
 * `align`: 'left' alinha a borda esquerda do menu ao botão; 'right' alinha a direita.
 * Em ambos os casos o clamp garante que o menu fique visível. Fecha ao rolar a
 * página/redimensionar (o menu é fixed e descolaria); o scroll INTERNO do menu é
 * ignorado para não fechar quando a lista é grande.
 */
export function usePopover(
  open: boolean,
  onClose: () => void,
  opts?: { align?: 'left' | 'right'; width?: number; gap?: number },
) {
  const align = opts?.align ?? 'left';
  const gap = opts?.gap ?? 12;      // margem mínima das bordas da tela
  const desired = opts?.width ?? 320; // 20rem, igual ao layout antigo
  const [pos, setPos] = useState<AnchoredPos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback((anchor: HTMLElement | null) => {
    if (!anchor || typeof window === 'undefined') return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(desired, vw - gap * 2);
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.min(left, vw - gap - width); // não passa da direita
    left = Math.max(left, gap);              // não passa da esquerda
    setPos({ top: r.bottom + 4, left, width });
  }, [align, gap, desired]);

  // Fecha ao rolar/redimensionar; ignora o scroll de dentro do próprio menu.
  // (pos não é zerado ao fechar de propósito: o menu só renderiza com `open && pos`,
  // e place() recalcula a posição na próxima abertura.)
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, onClose]);

  return { pos, place, menuRef };
}
