import { useState, useEffect, useMemo, useRef } from 'react';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { getAccountK, pickCalibrationSample } from '@/services/nodelay/maxStake';

/**
 * Calibra o `K` (fator do cliente p/ o max stake) da conta de referência e o
 * mantém — 1 `calculateBets` logado no começo + a cada ~5min (o `getAccountK` já
 * dedup/cacheia). Recalcula só quando a conta/host/amostra mudam (não a cada tick
 * de odd). Devolve `null` até calibrar. Ver [[nodelay-feature]] / BRIEF-maxstake.
 */
const RECALIBRATE_MS = 5 * 60_000;

export function useNoDelayMaxStake(
  rogueUrl: string | null,
  accountId: string | null,
  detail: LiveGameDetail | null,
): number | null {
  const [k, setK] = useState<number | null>(null);

  const sample = useMemo(() => pickCalibrationSample(detail), [detail]);
  const sampleId = sample?.sel.id ?? '';

  // Guarda a amostra mais nova sem re-disparar o efeito a cada tick.
  const sampleRef = useRef(sample);
  useEffect(() => { sampleRef.current = sample; });

  // Ao trocar a conta/casa de referência, ESQUECE o K anterior (senão mostraria o
  // máx da conta antiga enquanto recalibra). Keyed só na conta/host, não no tick.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setK(null);
  }, [rogueUrl, accountId]);

  useEffect(() => {
    if (!rogueUrl || !accountId || !sampleId) return;
    let alive = true;
    const run = async () => {
      const s = sampleRef.current;
      if (!s) return;
      const v = await getAccountK(rogueUrl, accountId, s);
      if (alive && v && v > 0) setK(v);
    };
    void run();
    const iv = window.setInterval(() => { void run(); }, RECALIBRATE_MS);
    return () => { alive = false; window.clearInterval(iv); };
  }, [rogueUrl, accountId, sampleId]);

  return k;
}
