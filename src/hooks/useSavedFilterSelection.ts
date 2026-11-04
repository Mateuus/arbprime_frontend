import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiGateway from '@/gateways/api.gateway';

export interface SavedFilterItem { id: string; name: string }

// Evento disparado pelo gateway quando um filtro é criado/editado/excluído
// (a tela de gerenciar filtros fica num modal por cima da página).
export const ABFILTERS_CHANGED = 'abfilters:changed';

const NO_FILTER_LABEL = 'Sem filtro (ver tudo)';

const readLegacy = (key?: string): string | null => {
  if (!key || typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
};

/**
 * Filtro salvo (ABFilter) ativo de uma página.
 * - A escolha é salva NO SERVIDOR por página (vale p/ recarga e outros aparelhos).
 * - O padrão é sempre um filtro do próprio usuário (o backend cria "Padrão" se não houver).
 * - "Sem filtro" só fica ativo se o usuário escolher; é a última opção da lista.
 */
export function useSavedFilterSelection(page: string, legacyStorageKey?: string) {
  const [savedFilters, setSavedFilters] = useState<SavedFilterItem[]>([]);
  const [activeFilterId, setActiveFilterId] = useState('');
  const [version, setVersion] = useState(0);
  const chosen = useRef<string | null>(null); // escolha conhecida (servidor ou clique)

  const load = useCallback(async () => {
    try {
      const [fr, sr] = await Promise.all([
        apiGateway.getUserFilters(),
        apiGateway.getFilterSelections().catch(() => null),
      ]);
      if (fr.data?.result !== 1 || !Array.isArray(fr.data.data)) return;
      const list: SavedFilterItem[] = fr.data.data.map((f: { id: string | number; name: string }) => ({ id: String(f.id), name: f.name }));
      setSavedFilters(list);

      const selections: Record<string, string> = sr?.data?.result === 1 && sr.data.data ? sr.data.data : {};
      let pick: string | null = chosen.current ?? (page in selections ? String(selections[page] ?? '') : null);
      let fromLegacy = false;
      if (pick === null) {
        // Migração: escolha antiga guardada só no aparelho ("" antigo é ignorado).
        const legacy = readLegacy(legacyStorageKey);
        if (legacy && list.some((f) => f.id === legacy)) { pick = legacy; fromLegacy = true; }
      }
      if (pick !== '' && !(pick && list.some((f) => f.id === pick))) pick = list[0]?.id ?? '';
      chosen.current = pick;
      setActiveFilterId(pick);
      if (fromLegacy) apiGateway.setFilterSelection(page, pick).catch(() => {});
    } catch { /* mantém o estado atual */ }
  }, [page, legacyStorageKey]);

  // Página mudou (ex.: arbbets ↔ duplo green) → recarrega a escolha daquela página.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() é assíncrono (fetch)
  useEffect(() => { chosen.current = null; load(); }, [load]);

  useEffect(() => {
    const onChanged = () => { load(); setVersion((v) => v + 1); };
    window.addEventListener(ABFILTERS_CHANGED, onChanged);
    return () => window.removeEventListener(ABFILTERS_CHANGED, onChanged);
  }, [load]);

  const selectFilter = useCallback((id: string) => {
    chosen.current = id;
    setActiveFilterId(id);
    apiGateway.setFilterSelection(page, id).catch(() => {});
  }, [page]);

  const filterOptions = useMemo(
    () => [...savedFilters.map((f) => ({ value: f.id, label: f.name })), { value: '', label: NO_FILTER_LABEL }],
    [savedFilters]
  );

  // `version` muda quando um filtro é editado → páginas recarregam a config dele.
  return { savedFilters, activeFilterId, selectFilter, filterOptions, version };
}
