import { useEffect, useRef } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { refreshAllAccounts } from '@/services/nodelay/connect';

/**
 * Mantém as sessões do NoDelay VIVAS sozinho. De tempos em tempos revalida as
 * contas e, se alguma caiu, RECONECTA automático (login novo com a credencial do
 * cofre — a conta volta sem clique). Só roda com a aba visível; ao terminar
 * chama `onDone` (reload) para a UI refletir saldo/estado novos.
 *
 * Feito para não pesar: nunca roda dois ciclos ao mesmo tempo, faz um 1º ciclo
 * ~20s após montar (cura a sessão que já entrou caída) e depois a cada ~4min.
 */
const FIRST_DELAY_MS = 20_000;
const INTERVAL_MS = 240_000; // ~4 min

export function useNoDelaySessionKeeper(houses: NoDelayBookmaker[], onDone: () => void, enabled: boolean) {
  const busyRef = useRef(false);
  const housesRef = useRef(houses);
  const onDoneRef = useRef(onDone);

  // Mantém os refs com os valores mais novos sem recriar o timer.
  useEffect(() => {
    housesRef.current = houses;
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const tick = async () => {
      if (!alive || busyRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const ready = housesRef.current.filter((h) => h.ready && h.rogueUrl);
      if (ready.length === 0) return;
      busyRef.current = true;
      try {
        await refreshAllAccounts(ready, undefined, { autoReconnect: true });
        if (alive) onDoneRef.current();
      } catch {
        /* background — silencioso; o Atualizar manual reporta erro */
      } finally {
        busyRef.current = false;
      }
    };

    const first = window.setTimeout(tick, FIRST_DELAY_MS);
    const iv = window.setInterval(tick, INTERVAL_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, [enabled]);
}
