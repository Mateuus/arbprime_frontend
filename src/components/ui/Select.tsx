import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// useLayoutEffect dá warning no SSR do Next; sem window cai no useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  color?: string; // cor do texto do label (ex.: cor da casa de aposta)
  node?: ReactNode; // conteúdo customizado (ex.: BookmakerTag) renderizado no lugar do label
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;      // wrapper (largura)
  buttonClassName?: string;
  title?: string;
}

/**
 * Select customizado no tema do site (o <select> nativo não é estilizável no
 * macOS/alguns browsers). O menu usa posição `fixed` calculada do botão, então
 * não é cortado por containers com overflow.
 */
export function Select({ value, onChange, options, placeholder = '—', className = '', buttonClassName = '', title }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxWidth: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Clampa à viewport para o menu não estourar fora da tela no mobile quando o
    // botão está perto da borda direita (o menu pode ser mais largo que o botão).
    const gap = 8;
    const vw = typeof window !== 'undefined' ? window.innerWidth : r.right;
    const width = Math.max(r.width, Math.min(240, vw - gap * 2));
    const left = Math.max(gap, Math.min(r.left, vw - gap - width));
    setRect({ left, top: r.bottom + 4, width: r.width, maxWidth: vw - left - gap });
  };

  const toggle = () => {
    if (open) { setOpen(false); return; }
    place();
    setOpen(true);
  };

  // Fecha ao rolar a PÁGINA/container (o menu é fixed e se descolaria do botão),
  // mas IGNORA o scroll de dentro do próprio menu.
  useIsoLayoutEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={title}
        className={`flex items-center justify-between gap-2 w-full bg-black/30 border rounded-lg px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
          open ? 'border-teal-500/50' : 'border-white/10 hover:border-white/20'
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate flex-1 min-w-0">
          {selected?.node
            ? selected.node
            : <>
                {selected?.icon}
                {selected
                  ? <span className="truncate" style={{ color: selected.color }}>{selected.label}</span>
                  : <span className="text-gray-500">{placeholder}</span>}
              </>}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            style={{ left: rect.left, top: rect.top, minWidth: rect.width, maxWidth: rect.maxWidth }}
            className="fixed z-[9999] max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-brand-dark p-1 shadow-2xl"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex items-center justify-between gap-2 w-full text-left rounded-lg px-3 py-1.5 text-sm transition ${
                  o.value === value ? 'bg-teal-500/15 text-teal-200' : 'text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                  {o.node ? o.node : <>{o.icon}<span className="truncate" style={{ color: o.color }}>{o.label}</span></>}
                </span>
                {o.value === value && <Check size={14} className="shrink-0 text-teal-300" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Select;
