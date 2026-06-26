import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AccountDTO } from '@/gateways/api.gateway';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { useBookmakers } from '@/hooks/useBookmakers';
import { accountDisplay } from './format';

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface Props {
  value: string; // slug escolhido
  onChange: (slug: string) => void;
  accounts: AccountDTO[];
  placeholder?: string;
  className?: string;
}

/**
 * Seletor de casa com BUSCA: ao abrir, lista TODAS as casas que o usuário já
 * cadastrou (com logo/nome). Digitar filtra; se nada casar, permite usar o texto
 * digitado como casa avulsa. Menu em `fixed` (não é cortado por overflow).
 */
export default function HousePicker({ value, onChange, accounts, placeholder = 'Selecione a casa', className = '' }: Props) {
  const { getBookmaker } = useBookmakers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = accounts.find((a) => a.slug === value);
  const selectedDisp = selected ? accountDisplay(selected, getBookmaker(selected.slug)) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const d = accountDisplay(a, getBookmaker(a.slug));
      return d.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
    });
  }, [accounts, query, getBookmaker]);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  };
  const toggle = () => { if (open) { setOpen(false); return; } place(); setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 10); };

  useIso(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open]);

  const pick = (slug: string) => { onChange(slug); setOpen(false); };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex items-center justify-between gap-2 w-full bg-black/20 border rounded-lg px-3 py-2 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${open ? 'border-teal-500/50' : 'border-white/10 hover:border-white/20'}`}
      >
        <span className="flex items-center gap-2 truncate flex-1 min-w-0 text-left">
          {selected ? (
            <>
              <BookmakerLogo name={selectedDisp!.name} slug={selected.slug} logoUrl={selectedDisp!.logoUrl} color={selectedDisp!.color} size={18} />
              <span className="truncate" style={{ color: selectedDisp!.color || undefined }}>{selectedDisp!.name}</span>
            </>
          ) : value ? (
            <span className="truncate text-gray-200">{value}</span>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && (
        <>
          <div className="fixed inset-0 z-[10010]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            style={{ left: rect.left, top: rect.top, minWidth: rect.width }}
            className="fixed z-[10011] w-72 max-w-[90vw] rounded-xl border border-white/10 bg-brand-dark p-1.5 shadow-2xl"
          >
            <div className="relative mb-1.5">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar casa..."
                className="w-full bg-white/5 ring-1 ring-white/10 rounded-lg pl-8 pr-2 py-1.5 text-sm text-white focus:outline-none focus:ring-teal-500/50"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((a) => {
                const d = accountDisplay(a, getBookmaker(a.slug));
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => pick(a.slug)}
                    className={`flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-sm transition ${a.slug === value ? 'bg-teal-500/15 text-teal-200' : 'text-gray-200 hover:bg-white/10'}`}
                  >
                    <BookmakerLogo name={d.name} slug={a.slug} logoUrl={d.logoUrl} color={d.color} size={18} />
                    <span className="truncate flex-1 min-w-0" style={{ color: d.color || undefined }}>{d.name}</span>
                    {a.slug === value && <Check size={14} className="shrink-0 text-teal-300" />}
                  </button>
                );
              })}
              {accounts.length === 0 && (
                <div className="px-2.5 py-4 text-center text-xs text-gray-500">Você ainda não cadastrou casas.<br />Cadastre em &quot;Minhas Casas&quot;.</div>
              )}
              {accounts.length > 0 && filtered.length === 0 && query.trim() && (
                <button type="button" onClick={() => pick(query.trim().toLowerCase())} className="flex items-center gap-2 w-full text-left rounded-lg px-2.5 py-1.5 text-sm text-teal-300 hover:bg-white/10">
                  Usar &quot;{query.trim()}&quot;
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
