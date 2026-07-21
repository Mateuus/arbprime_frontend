import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/context/UserContext';

/**
 * Config de aposta do NoDelay (por navegador — localStorage). São as escolhas
 * do apostador para a entrada rápida: quanto apostar, se aceita fracionar quando
 * a casa limita, e se aceita a odd mudar entre o clique e o place.
 *
 * `selectedAccountIds = null` = nunca escolheu → o padrão é "todas as conectadas".
 */
export interface NoDelaySettings {
  defaultStake: number;
  minStake: number;           // piso ao fracionar (allowPartial)
  maxStakeMode: boolean;      // ignora o defaultStake e aposta SEMPRE o máx permitido da conta
  allowPartial: boolean;      // aceita valor menor se a casa não pegar o limite todo
  acceptOddsChange: boolean;  // aceita a odd mudar (default sempre ligado)
  selectedAccountIds: string[] | null;
  // ---- filtros de mercado (delay trade) ----
  delayTradeOnly: boolean;    // esconde as seleções "Menos de" (Under) — só entradas de Mais
  hidePriceless: boolean;     // esconde o que está sem odd ("—"); reaparece quando a odd chega
  // ---- TEMPORÁRIO (teste): aposta REAL em vez de mock ----
  realBets: boolean;
  instantFire: boolean; // dispara direto, sem o modal de confirmação
}

const KEY = 'nodelay:betsettings:v1';

export const DEFAULT_SETTINGS: NoDelaySettings = {
  defaultStake: 2,
  minStake: 1,
  maxStakeMode: false,
  allowPartial: true,
  acceptOddsChange: true,
  selectedAccountIds: null,
  delayTradeOnly: false,
  hidePriceless: true, // "por natureza": limpa os "—" por padrão
  realBets: true,      // todo mundo aposta REAL; só admin pode voltar pro mock
  instantFire: false,  // por padrão confirma antes
};

function load(): NoDelaySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NoDelaySettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useNoDelaySettings() {
  const { user } = useUserContext();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<NoDelaySettings>(DEFAULT_SETTINGS);

  // Carrega do localStorage no cliente (evita mismatch de hidratação).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(load());
  }, []);

  const update = useCallback((patch: Partial<NoDelaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota/priv */ }
      return next;
    });
  }, []);

  /** Marca/desmarca uma conta. Materializa "todas" na 1ª mudança. */
  const toggleAccount = useCallback((id: string, allConnectedIds: string[]) => {
    setSettings((prev) => {
      const base = prev.selectedAccountIds ?? allConnectedIds;
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      const merged = { ...prev, selectedAccountIds: next };
      try { window.localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* */ }
      return merged;
    });
  }, []);

  // Só admin controla o mock (realBets). Para todo o resto, aposta é SEMPRE real —
  // coage aqui pra um valor antigo salvo em localStorage não deixar ninguém no mock.
  const effective = isAdmin ? settings : (settings.realBets ? settings : { ...settings, realBets: true });

  return { settings: effective, update, toggleAccount, isAdmin };
}

/** Contas que de fato vão apostar = as marcadas ∩ conectadas (ou todas se nunca marcou). */
export function effectiveSelected(selected: string[] | null, connectedIds: string[]): string[] {
  if (selected == null) return connectedIds;
  const set = new Set(selected);
  return connectedIds.filter((id) => set.has(id));
}
