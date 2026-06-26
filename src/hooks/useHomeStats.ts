import { useEffect, useRef, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';

export interface HomeStats {
  /** Total de surebets (somando todas as oportunidades de cada evento). */
  totalSurebets: number;
  /** Surebets com lucro >= 1%. */
  surebetsAbove1: number;
  /** Melhor lucro encontrado no momento (%). */
  bestProfit: number;
  /** Oportunidades de arbitragem cripto com lucro líquido positivo. */
  cryptoOps: number;
  /** Eventos próximos no catálogo /events (grupos deduplicados entre casas). */
  events: number;
  /** Casas de apostas monitoradas (registro). */
  bookmakers: number;
  /** Já chegou ao menos uma resposta do servidor? */
  live: boolean;
}

const EMPTY: HomeStats = {
  totalSurebets: 0,
  surebetsAbove1: 0,
  bestProfit: 0,
  cryptoOps: 0,
  events: 0,
  bookmakers: 0,
  live: false,
};

/**
 * Busca as métricas agregadas da landing via REST (`GET /stats`) e revalida a
 * cada `intervalMs`. O endpoint é PÚBLICO e devolve só números — a home nunca
 * recebe a lista de surebets/odds (conteúdo gated), nem precisa do WebSocket.
 */
export function useHomeStats(intervalMs = 20000): HomeStats {
  const [stats, setStats] = useState<HomeStats>(EMPTY);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      try {
        const res = await apiGateway.getHomeStats();
        const d = res?.data?.result === 1 ? res.data.data : null;
        if (d && aliveRef.current) {
          setStats({
            totalSurebets: d.totalSurebets ?? 0,
            surebetsAbove1: d.surebetsAbove1 ?? 0,
            bestProfit: d.bestProfit ?? 0,
            cryptoOps: d.cryptoOps ?? 0,
            events: d.events ?? 0,
            bookmakers: d.bookmakers ?? 0,
            live: true,
          });
        }
      } catch {
        /* silencioso: mantém o último valor conhecido */
      }
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return stats;
}
