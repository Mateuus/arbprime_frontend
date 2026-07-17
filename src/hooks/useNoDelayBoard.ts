import { useState, useEffect, useCallback } from 'react';

/**
 * "Quadro" de mercados do NoDelay (estilo Trello, por navegador — localStorage).
 * O usuário cria colunas nomeadas (Gols, Cartões, Livre…) e coloca os mercados
 * que quer em cada uma. A Aposta Rápida mostra esse quadro em qualquer jogo.
 *
 * A chave do mercado é o **MarketTypeId** da rogue (ex.: 'ML39', 'OU249',
 * 'ML237') — estável entre eventos (o `_id` do mercado tem o eventId embutido e
 * NÃO serve). Assim "Próximo gol (Gol 3)" (ML237) reaparece no próximo jogo
 * mesmo que o nome mude, desde que a casa ofereça e o SSE traga.
 */
export interface BoardColumn {
  id: string;
  name: string;
  keys: string[]; // MarketTypeIds, na ordem
}

const KEY = 'nodelay:board:v1';

const DEFAULT_BOARD: BoardColumn[] = [
  { id: 'col-principais', name: 'Principais', keys: [] },
  { id: 'col-gols', name: 'Gols', keys: [] },
  { id: 'col-livre', name: 'Livre', keys: [] },
];

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `col-${crypto.randomUUID().slice(0, 8)}` : `col-${Date.now()}`;

function load(): BoardColumn[] {
  if (typeof window === 'undefined') return DEFAULT_BOARD;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BOARD;
    const cols = JSON.parse(raw) as BoardColumn[];
    return Array.isArray(cols) && cols.length ? cols : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

function persist(cols: BoardColumn[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(cols)); } catch { /* quota/priv */ }
}

export function useNoDelayBoard() {
  const [columns, setColumns] = useState<BoardColumn[]>(DEFAULT_BOARD);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColumns(load());
  }, []);

  // Aplica uma transformação sobre o estado ATUAL e persiste (evita closure velho).
  const mutate = useCallback((fn: (cols: BoardColumn[]) => BoardColumn[]) => {
    setColumns((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const addColumn = useCallback((name: string) => {
    mutate((cols) => [...cols, { id: uid(), name: name.trim() || 'Nova coluna', keys: [] }]);
  }, [mutate]);

  const renameColumn = useCallback((id: string, name: string) => {
    mutate((cols) => cols.map((c) => (c.id === id ? { ...c, name } : c)));
  }, [mutate]);

  const removeColumn = useCallback((id: string) => {
    mutate((cols) => cols.filter((c) => c.id !== id));
  }, [mutate]);

  const moveColumn = useCallback((id: string, dir: -1 | 1) => {
    mutate((cols) => {
      const next = [...cols];
      const i = next.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= next.length) return cols;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, [mutate]);

  /** Move um mercado (marketKey) para uma coluna, tirando de qualquer outra. */
  const assign = useCallback((marketKey: string, columnId: string, index?: number) => {
    mutate((cols) => {
      const next = cols.map((c) => ({ ...c, keys: c.keys.filter((k) => k !== marketKey) }));
      const target = next.find((c) => c.id === columnId);
      if (!target) return next;
      if (index == null || index >= target.keys.length) target.keys.push(marketKey);
      else target.keys.splice(Math.max(0, index), 0, marketKey);
      return next;
    });
  }, [mutate]);

  /** Tira o mercado do quadro (volta ao "pool"). */
  const unassign = useCallback((marketKey: string) => {
    mutate((cols) => cols.map((c) => ({ ...c, keys: c.keys.filter((k) => k !== marketKey) })));
  }, [mutate]);

  const isOnBoard = useCallback((marketKey: string) => columns.some((c) => c.keys.includes(marketKey)), [columns]);

  return { columns, addColumn, renameColumn, removeColumn, moveColumn, assign, unassign, isOnBoard };
}

/** Chave estável do mercado p/ o quadro (MarketTypeId; cai no nome se faltar). */
export const marketKeyOf = (m: { marketTypeId?: string; name: string }): string => m.marketTypeId || m.name;
