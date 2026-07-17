import { useState, useEffect, useCallback } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance } from '@/interfaces/nodelay.interface';

const errText = (e: unknown, fb: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
const isForbidden = (e: unknown): boolean =>
  (e as { response?: { status?: number } })?.response?.status === 403;

/** Instâncias do usuário (o backend auto-cria uma padrão na 1ª vez se já houver contas). */
export function useNoDelayInstances(enabled: boolean) {
  const [instances, setInstances] = useState<NoDelayInstance[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const r = await apiGateway.getNoDelayInstances();
      if (r.data?.result === 1) setInstances(r.data.data || []);
      setDenied(false);
    } catch (e) {
      if (isForbidden(e)) setDenied(true);
      else setError(errText(e, 'Não foi possível carregar as instâncias.'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [enabled, reload]);

  return { instances, loading, denied, error, reload };
}
