import { useState, useEffect, useRef } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { openLiveListStream, RogueOp } from '@/services/nodelay/rogueClient';
import { eventToLiveGame, isFullEvent, patchLiveGame, LiveGame } from '@/services/nodelay/rogueModel';

/** Um jogo ao vivo com a casa de origem (feed UNIFICADO da instância). */
export interface InstanceLiveGame extends LiveGame {
  houseSlug: string;
  houseName: string;
}

/**
 * Feed AO VIVO UNIFICADO da instância: abre uma SSE por casa e MESCLA os jogos
 * numa lista só, cada um marcado com a casa de origem. É o "não separar por
 * casa" — tudo junto. (O matching do MESMO jogo entre casas vem depois via
 * /events; por ora o mesmo jogo em 2 casas aparece 2x, com badges diferentes.)
 */
export function useInstanceLiveGames(houses: NoDelayBookmaker[]) {
  const [games, setGames] = useState<InstanceLiveGame[]>([]);
  const [loading, setLoading] = useState(houses.length > 0);
  const [liveCount, setLiveCount] = useState(0);

  // chave de dependência estável (só os slugs prontos DA ROGUE importam — casa
  // biahosted não tem rogueUrl e é lida por outro caminho, não por SSE aqui).
  const readyKey = houses.filter((h) => h.ready && h.rogueUrl).map((h) => h.slug).sort().join(',');

  useEffect(() => {
    const ready = houses.filter((h) => h.ready && h.rogueUrl);
    if (ready.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let alive = true;
    // Um mapa de jogos POR CASA — assim uma casa não apaga os jogos de outra.
    const byHouse = new Map<string, Map<string, InstanceLiveGame>>();
    const liveHouses = new Set<string>();
    const delivered = new Set<string>(); // casas que já mandaram o 1º lote
    let dirty = false;

    const flush = () => {
      if (!alive || !dirty) return;
      dirty = false;
      const all: InstanceLiveGame[] = [];
      for (const m of byHouse.values()) all.push(...m.values());
      setGames(all);
    };

    const streams = ready.map((house) => {
      const map = new Map<string, InstanceLiveGame>();
      byHouse.set(house.slug, map);
      const hostHost = { slug: house.slug, rogueUrl: house.rogueUrl! };

      const onOps = (ops: RogueOp[]) => {
        for (const op of ops) {
          const type = String(op.Type || '');
          const opr = String(op.Operation || '');
          const ref = op.Reference as Record<string, unknown> | undefined;
          const cs = op.Changeset as Record<string, unknown> | undefined;
          if (type === 'market') continue;
          const id = String(ref?.EventId ?? cs?._id ?? '');
          if (!id) continue;
          if (opr === 'delete' || ref?.IsLive === false) { if (map.delete(id)) dirty = true; continue; }
          if (!cs) continue;
          if (isFullEvent(cs)) {
            const g = eventToLiveGame(cs);
            if (g) {
              const prev = map.get(g.id);
              const merged: InstanceLiveGame = {
                ...(prev ? { ...g, info: { ...prev.info, ...g.info } } : g),
                houseSlug: house.slug,
                houseName: house.name,
              };
              map.set(g.id, merged);
              dirty = true;
            }
          } else if (type === 'event') {
            const prev = map.get(id);
            if (prev) { map.set(id, { ...patchLiveGame(prev, cs), houseSlug: house.slug, houseName: house.name }); dirty = true; }
          }
        }
        // Só tira o "carregando" quando TODAS as casas prontas já entregaram —
        // senão a 1ª casa a responder (mesmo vazia) mostraria "sem jogos" à toa.
        // O timeout de 8s abaixo é a rede de segurança se alguma casa engasgar.
        delivered.add(house.slug);
        if (alive) { if (delivered.size >= ready.length) setLoading(false); flush(); }
      };

      return openLiveListStream(hostHost, null, onOps, (isLive) => {
        if (!alive) return;
        if (isLive) liveHouses.add(house.slug); else liveHouses.delete(house.slug);
        setLiveCount(liveHouses.size);
      });
    });

    const t = window.setTimeout(() => { if (alive) setLoading(false); }, 8000);

    return () => {
      alive = false;
      window.clearTimeout(t);
      for (const s of streams) s.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  return { games, loading, liveCount };
}
