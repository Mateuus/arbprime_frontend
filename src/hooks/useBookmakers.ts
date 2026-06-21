import { useState, useEffect, useMemo } from 'react';
import { apiGateway, BookmakerDTO } from '@/gateways/api.gateway';

/**
 * Carrega o registro de casas (slug → nome/logo/cor) UMA vez e compartilha o
 * cache entre todos os componentes (cache em nível de módulo). Assim vários
 * <BookmakerTag> na tela não disparam N requisições.
 */
let cache: BookmakerDTO[] | null = null;
let inflight: Promise<BookmakerDTO[]> | null = null;
const listeners = new Set<(v: BookmakerDTO[]) => void>();

function loadOnce(): Promise<BookmakerDTO[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = apiGateway
      .getBookmakers()
      .then((r) => {
        cache = r.data?.result === 1 ? (r.data.data as BookmakerDTO[]) : [];
        listeners.forEach((l) => l(cache!));
        return cache;
      })
      .catch(() => {
        cache = [];
        return cache;
      });
  }
  return inflight;
}

export interface UseBookmakers {
  bookmakers: BookmakerDTO[];
  getBookmaker: (slug: string) => BookmakerDTO | undefined;
  loaded: boolean;
}

export function useBookmakers(): UseBookmakers {
  const [list, setList] = useState<BookmakerDTO[]>(cache || []);

  useEffect(() => {
    let active = true;
    listeners.add(setList);
    loadOnce().then((v) => { if (active) setList(v); });
    return () => { active = false; listeners.delete(setList); };
  }, []);

  const map = useMemo(() => {
    const m = new Map<string, BookmakerDTO>();
    for (const b of list) m.set(b.slug.toLowerCase(), b);
    return m;
  }, [list]);

  return {
    bookmakers: list,
    getBookmaker: (slug: string) => map.get((slug || '').toLowerCase()),
    loaded: cache !== null
  };
}
