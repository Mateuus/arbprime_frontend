import { useCallback, useEffect, useState } from 'react';

/**
 * Conjunto persistido (localStorage) de itens "seguidos" — usado para seguir
 * surebets específicas e eventos. Devolve o Set, um toggle e um helper `has`.
 */
export function useWatchSet(storageKey: string) {
  const [set, setSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSet(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  const has = useCallback((id: string) => set.has(id), [set]);

  return { set, toggle, has };
}
