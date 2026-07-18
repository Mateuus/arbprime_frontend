import { useState, useEffect } from 'react';

/**
 * Re-renderiza a cada `intervalMs` (retorna um contador). Usado para reavaliar
 * regras baseadas em TEMPO (ex.: esconder mercado suspenso há >10s) mesmo quando
 * não chega delta da SSE. Barato: um setState a cada tick.
 */
export function useNowTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}
