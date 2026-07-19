import { useState, useEffect, useRef } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { openLiveListStream, RogueOp } from '@/services/nodelay/rogueClient';
import { eventToLiveGame, isFullEvent, patchLiveGame, LiveGame } from '@/services/nodelay/rogueModel';

/**
 * Lista de jogos AO VIVO (TODOS os esportes) via ROGUE SSE — a fonte real do
 * site 7games.
 *
 * A stream manda um "initial" com os eventos completos e depois updates:
 *  - Type "event" (parcial): placar/estado → SÓ dá patch no card existente.
 *  - Type "market": mudança de odd → IRRELEVANTE p/ a lista, ignora.
 *  - delete / IsLive:false → sai do ao vivo, remove.
 * Errar isso (tratar update como evento novo) cria cards vazios "0 mercados".
 */
export function useLiveGames(house: NoDelayBookmaker | undefined) {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(!!(house?.ready && house.rogueUrl));
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const gamesRef = useRef<Map<string, LiveGame>>(new Map());

  useEffect(() => {
    if (!house?.ready || !house.rogueUrl) return; // sem rogueUrl = não é fssb (ex.: biahosted)

    gamesRef.current = new Map();
    let alive = true;
    let dirty = false;
    const flush = () => { if (alive && dirty) { dirty = false; setGames([...gamesRef.current.values()]); } };

    const onOps = (ops: RogueOp[]) => {
      for (const op of ops) {
        const type = String(op.Type || '');
        const opr = String(op.Operation || '');
        const ref = op.Reference as Record<string, unknown> | undefined;
        const cs = op.Changeset as Record<string, unknown> | undefined;

        // Mudanças de mercado não afetam a lista (odds só na página do evento).
        if (type === 'market') continue;

        const id = String(ref?.EventId ?? cs?._id ?? '');
        if (!id) continue;

        // Saiu do ao vivo → remove.
        if (opr === 'delete' || ref?.IsLive === false) {
          if (gamesRef.current.delete(id)) dirty = true;
          continue;
        }

        if (!cs) continue;

        if (isFullEvent(cs)) {
          const g = eventToLiveGame(cs);
          if (g) {
            const prev = gamesRef.current.get(g.id);
            // preserva o placar/relógio já recebido se o snapshot não trouxer.
            gamesRef.current.set(g.id, prev ? { ...g, info: { ...prev.info, ...g.info } } : g);
            dirty = true;
          }
        } else if (type === 'event') {
          // Update parcial de placar/estado — só no card que já existe.
          const prev = gamesRef.current.get(id);
          if (prev) { gamesRef.current.set(id, patchLiveGame(prev, cs)); dirty = true; }
        }
      }
      if (alive) { setLoading(false); flush(); }
    };

    const host = { slug: house.slug, rogueUrl: house.rogueUrl! };
    const stream = openLiveListStream(host, null, onOps, (isLive) => {
      if (!alive) return;
      setLive(isLive);
      if (!isLive) setError(null);
    });

    const t = window.setTimeout(() => { if (alive) setLoading(false); }, 8000);

    return () => {
      alive = false;
      window.clearTimeout(t);
      stream.close();
    };
  }, [house]);

  return { games, loading, error, live };
}
