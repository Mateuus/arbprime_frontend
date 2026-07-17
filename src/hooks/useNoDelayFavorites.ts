import { useState, useEffect, useCallback } from 'react';

/**
 * Mercados favoritos do NoDelay (por navegador — localStorage). O apostador
 * "estrela" os mercados que usa no ao vivo; a Aposta Rápida mostra só esses,
 * para disparar a entrada em 1 toque.
 *
 * A chave é o NOME do mercado (o que o usuário vê e reconhece entre jogos).
 */
const KEY = 'nodelay:favmarkets:v1';

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useNoDelayFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(new Set(load()));
  }, []);

  const persist = (s: Set<string>) => {
    try { window.localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* */ }
  };

  const toggle = useCallback((key: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((key: string) => favorites.has(key), [favorites]);

  return { favorites, toggle, isFavorite };
}
