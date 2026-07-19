import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { PrimeTvAdminEvent, PrimeTvCompetition, PrimeTvEvent } from '@/interfaces/primetv.interface';

/**
 * Lista do PrimeTV via REST, com auto-refresh (dados são MOCK por enquanto).
 * `mode: 'admin'` usa o endpoint admin (inclui ocultos + estado do override).
 * Não usa WebSocket: o WS do projeto é dedicado às arbbets e a lista de TV é
 * leve o suficiente para poll curto. Espelha o padrão de useHomeStats (loader
 * inline no efeito) e expõe `refetch` para as ações do admin.
 */
export function usePrimeTv(mode: 'public' | 'admin' = 'public', autoUpdate = true, intervalMs = 15000) {
  const [events, setEvents] = useState<(PrimeTvEvent | PrimeTvAdminEvent)[]>([]);
  const [competitions, setCompetitions] = useState<PrimeTvCompetition[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  // Guarda o loader atual do efeito para o refetch chamado de fora (ações admin).
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    alive.current = true;

    const load = async () => {
      try {
        const res = mode === 'admin' ? await apiGateway.getPrimeTvEventsAdmin() : await apiGateway.getPrimeTvEvents();
        if (!alive.current) return;
        if (res.data?.result === 1) {
          const d = res.data.data;
          setEvents(d.events || []);
          setCompetitions(d.competitions || []);
          setLiveTotal(d.liveTotal || 0);
          setError(null);
        } else {
          setError(res.data?.message || 'Erro ao carregar o PrimeTV.');
        }
      } catch (e) {
        if (!alive.current) return;
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || 'Erro ao carregar o PrimeTV.');
      } finally {
        if (alive.current) setLoading(false);
      }
    };

    loadRef.current = load;
    load();
    if (!autoUpdate) return () => { alive.current = false; };
    const t = setInterval(load, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [mode, autoUpdate, intervalMs]);

  const refetch = useCallback(() => loadRef.current(), []);

  return { events, competitions, liveTotal, loading, error, refetch };
}
