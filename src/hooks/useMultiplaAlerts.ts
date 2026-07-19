import { useEffect, useRef, useState } from 'react';
import { MultiArbData } from '@/interfaces/multipla.interface';
import { multiKey, multiFingerprint } from '@/utils/multipla';
import type { NotifSettings, NotifyInput } from './useNotifications';

const NEW_TTL = 45_000; // ms que o badge "Novo" permanece no card
const SEEN_CAP = 5000;  // teto do conjunto "seen" (evita vazamento numa aba longa)

interface Opts {
  type: string;                  // prematch | live — reseta a detecção ao trocar
  settings: NotifSettings;
  watched: Set<string>;          // multiKeys seguidas
  notify: (a: NotifyInput) => void;
}

/**
 * Detecta múltiplas NOVAS e MUDANÇAS nas seguidas a cada snapshot do WebSocket,
 * disparando notificações e devolvendo o mapa de keys "novas" (para o badge).
 * Espelha useSurebetAlerts, mas o "item" é o PAR inteiro (MultiArbData) — a
 * múltipla não tem sub-lista como as surebets de um evento.
 */
export function useMultiplaAlerts(data: MultiArbData[], visibleKeys: Set<string>, opts: Opts) {
  const { type, settings, watched, notify } = opts;

  const seenRef = useRef<Set<string>>(new Set());
  const fpRef = useRef<Map<string, string>>(new Map());
  const firstRef = useRef(true);
  const [newKeys, setNewKeys] = useState<Map<string, number>>(new Map());

  const settingsRef = useRef(settings);
  const watchedRef = useRef(watched);
  const visibleRef = useRef(visibleKeys);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { watchedRef.current = watched; }, [watched]);
  useEffect(() => { visibleRef.current = visibleKeys; }, [visibleKeys]);

  // Reset ao trocar prematch/live.
  useEffect(() => {
    seenRef.current = new Set();
    fpRef.current = new Map();
    firstRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewKeys(new Map());
  }, [type]);

  useEffect(() => {
    if (!data.length) return;
    const s = settingsRef.current;
    const isFirst = firstRef.current;

    const cur = new Map<string, MultiArbData>();
    for (const d of data) cur.set(multiKey(d), d);

    const newlyNew: string[] = [];
    for (const k of cur.keys()) {
      if (!seenRef.current.has(k)) {
        if (!isFirst) newlyNew.push(k);
        seenRef.current.add(k);
      }
    }

    if (!isFirst && s.enabled) {
      const watchedNew: MultiArbData[] = [];
      const otherNew: MultiArbData[] = [];
      for (const k of newlyNew) {
        const info = cur.get(k)!;
        if (watchedRef.current.has(k)) watchedNew.push(info);
        else if (visibleRef.current.has(k)) otherNew.push(info);
      }

      const subtitle = (d: MultiArbData) =>
        d.games.map((g) => `${g.home} x ${g.away}`).join('  +  ');

      // Alertas de SEGUIDAS.
      if (s.alertWatched) {
        for (const d of watchedNew) {
          notify({
            kind: 'watched',
            title: `Múltipla seguida · ${d.profitMargin.toFixed(2)}%`,
            subtitle: subtitle(d),
            eventId: d.id,
            surebetKey: multiKey(d),
            profit: d.profitMargin,
          });
        }
      }

      // Alertas de NOVAS (não seguidas) — visíveis e >= lucro mínimo.
      if (s.alertNew) {
        const qualifying = otherNew.filter((d) => d.profitMargin >= (s.minProfit || 0));
        if (qualifying.length === 1) {
          const d = qualifying[0];
          notify({
            kind: 'new',
            title: `Nova múltipla · ${d.profitMargin.toFixed(2)}%`,
            subtitle: subtitle(d),
            eventId: d.id,
            surebetKey: multiKey(d),
            profit: d.profitMargin,
          });
        } else if (qualifying.length > 1) {
          const top = qualifying.reduce((a, b) => (b.profitMargin > a.profitMargin ? b : a));
          notify({
            kind: 'new',
            title: `${qualifying.length} novas múltiplas`,
            subtitle: `Melhor ${top.profitMargin.toFixed(2)}% · ${top.games.map((g) => `${g.home} x ${g.away}`).join(' + ')}`,
            eventId: top.id,
            surebetKey: multiKey(top),
            profit: top.profitMargin,
          });
        }
      }

      // MUDANÇA nas seguidas + as que sumiram.
      if (s.alertWatched) {
        for (const [k, d] of cur) {
          if (!watchedRef.current.has(k)) continue;
          const prevFp = fpRef.current.get(k);
          if (prevFp && prevFp !== multiFingerprint(d)) {
            notify({
              kind: 'watched',
              title: `Múltipla seguida mudou · ${d.profitMargin.toFixed(2)}%`,
              subtitle: subtitle(d),
              eventId: d.id,
              surebetKey: k,
              profit: d.profitMargin,
            });
          }
        }
        for (const k of watchedRef.current) {
          if (fpRef.current.has(k) && !cur.has(k)) {
            notify({ kind: 'gone', title: 'Múltipla encerrada', subtitle: 'Uma múltipla que você segue saiu da lista.', eventId: '', surebetKey: k });
          }
        }
      }
    }

    const nextFp = new Map<string, string>();
    for (const [k, d] of cur) nextFp.set(k, multiFingerprint(d));
    fpRef.current = nextFp;

    if (seenRef.current.size > SEEN_CAP) seenRef.current = new Set(cur.keys());

    if (newlyNew.length) {
      const now = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewKeys((prev) => { const m = new Map(prev); newlyNew.forEach((k) => m.set(k, now)); return m; });
    }

    firstRef.current = false;
  }, [data, notify]);

  // Expira os badges "Novo".
  const hasNew = newKeys.size > 0;
  useEffect(() => {
    if (!hasNew) return;
    const t = setInterval(() => {
      const now = Date.now();
      setNewKeys((prev) => {
        let changed = false;
        const m = new Map(prev);
        for (const [k, ts] of m) if (now - ts > NEW_TTL) { m.delete(k); changed = true; }
        return changed ? m : prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [hasNew]);

  return { newKeys };
}
