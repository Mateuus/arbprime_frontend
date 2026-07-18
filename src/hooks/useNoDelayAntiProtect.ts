import { useState, useEffect, useCallback } from 'react';

/**
 * Mercados com "Anti Proteção" ligado (por navegador — localStorage). Quando um
 * mercado está aqui, ele NÃO some da Aposta Rápida mesmo que a casa suspenda ou
 * RETIRE o mercado (a "proteção" da casa no lance perigoso) — fica travado na tela
 * até a odd voltar, pronto p/ o disparo em 1 toque.
 *
 * A chave é o `marketKeyOf` (MarketTypeId||nome), a MESMA do quadro — estável
 * entre a troca de linha (delete+add), que mantém o MarketTypeId.
 */
const KEY = 'nodelay:antiprotect:v1';

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useNoDelayAntiProtect() {
  const [antiProtect, setAntiProtect] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAntiProtect(new Set(load()));
  }, []);

  const persist = (s: Set<string>) => {
    try { window.localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* quota/priv */ }
  };

  const toggle = useCallback((key: string) => {
    setAntiProtect((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const isAntiProtect = useCallback((key: string) => antiProtect.has(key), [antiProtect]);

  return { antiProtect, toggle, isAntiProtect };
}
