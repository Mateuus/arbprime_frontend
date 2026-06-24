import { useEffect, useRef, useState } from 'react';
import { SurebetData, Surebet } from '@/interfaces/arbitragem.interface';
import { surebetKey, surebetFingerprint } from '@/utils/surebetKey';
import { marketLabel } from '@/utils/surebet';
import type { NotifSettings, NotifyInput } from './useNotifications';

const NEW_TTL = 45_000; // ms que o badge "Novo" permanece no card

interface FlatItem { event: SurebetData; sb: Surebet }

interface Opts {
  type: string;                  // prematch | live — reseta a detecção ao trocar
  settings: NotifSettings;
  watched: Set<string>;          // surebetKeys seguidas
  watchedEvents: Set<string>;    // eventIds seguidos
  notify: (a: NotifyInput) => void;
}

/**
 * Detecta surebets NOVAS e MUDANÇAS nas seguidas a cada snapshot do WebSocket,
 * disparando notificações e devolvendo o mapa de keys "novas" (para o badge).
 *
 * "Novo" é calculado sobre a lista CRUA (todos os surebets) para não gerar
 * falso-positivo quando o usuário muda de filtro; o ALERTA de novas, porém, só
 * sai para o que passa no filtro atual (flat) e respeita o lucro mínimo.
 */
export function useSurebetAlerts(data: SurebetData[], flat: FlatItem[], opts: Opts) {
  const { type, settings, watched, watchedEvents, notify } = opts;

  const seenRef = useRef<Set<string>>(new Set());          // keys já vistas
  const fpRef = useRef<Map<string, string>>(new Map());    // key -> fingerprint anterior
  const firstRef = useRef(true);                           // 1ª carga não alerta
  const [newKeys, setNewKeys] = useState<Map<string, number>>(new Map());

  // Refs para ler settings/seguidos sem re-disparar o efeito de detecção.
  // Sincronizados em effects (escrever ref durante o render é proibido pelo lint).
  const settingsRef = useRef(settings);
  const watchedRef = useRef(watched);
  const watchedEvtRef = useRef(watchedEvents);
  const flatKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { watchedRef.current = watched; }, [watched]);
  useEffect(() => { watchedEvtRef.current = watchedEvents; }, [watchedEvents]);
  useEffect(() => { flatKeysRef.current = new Set(flat.map(({ event, sb }) => surebetKey(event, sb))); }, [flat]);

  // Reset ao trocar prematch/live (são listas diferentes).
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

    // Índice atual (cru) por key.
    const cur = new Map<string, FlatItem>();
    for (const e of data) {
      for (const sb of e.surebets || []) cur.set(surebetKey(e, sb), { event: e, sb });
    }

    // Keys nunca vistas → novas.
    const newlyNew: string[] = [];
    for (const k of cur.keys()) {
      if (!seenRef.current.has(k)) {
        if (!isFirst) newlyNew.push(k);
        seenRef.current.add(k);
      }
    }

    if (!isFirst && s.enabled) {
      // Separa novas seguidas (evento/surebet) das demais.
      const watchedNew: FlatItem[] = [];
      const otherNew: FlatItem[] = [];
      for (const k of newlyNew) {
        const info = cur.get(k)!;
        if (watchedRef.current.has(k) || watchedEvtRef.current.has(info.event.id)) watchedNew.push(info);
        else if (flatKeysRef.current.has(k)) otherNew.push(info);
      }

      // Alertas de SEGUIDAS — surebet nova em algo que você segue.
      if (s.alertWatched) {
        for (const { event, sb } of watchedNew) {
          notify({
            kind: 'watched',
            title: `Nova surebet seguida · ${sb.profitMargin.toFixed(2)}%`,
            subtitle: `${event.home} x ${event.away} · ${sb.marketTypes.map(marketLabel).join(' · ')}`,
            eventId: event.id,
            surebetKey: surebetKey(event, sb),
            profit: sb.profitMargin
          });
        }
      }

      // Alertas de NOVAS (não seguidas) — passam no filtro e >= lucro mínimo.
      if (s.alertNew) {
        const qualifying = otherNew.filter(({ sb }) => sb.profitMargin >= (s.minProfit || 0));
        if (qualifying.length === 1) {
          const { event, sb } = qualifying[0];
          notify({
            kind: 'new',
            title: `Nova surebet · ${sb.profitMargin.toFixed(2)}%`,
            subtitle: `${event.home} x ${event.away} · ${sb.marketTypes.map(marketLabel).join(' · ')}`,
            eventId: event.id,
            surebetKey: surebetKey(event, sb),
            profit: sb.profitMargin
          });
        } else if (qualifying.length > 1) {
          const top = qualifying.reduce((a, b) => (b.sb.profitMargin > a.sb.profitMargin ? b : a));
          notify({
            kind: 'new',
            title: `${qualifying.length} novas surebets`,
            subtitle: `Melhor ${top.sb.profitMargin.toFixed(2)}% · ${top.event.home} x ${top.event.away}`,
            eventId: top.event.id,
            surebetKey: surebetKey(top.event, top.sb),
            profit: top.sb.profitMargin
          });
        }
      }

      // MUDANÇA nas seguidas existentes (fingerprint diferente).
      if (s.alertWatched) {
        for (const [k, { event, sb }] of cur) {
          const followed = watchedRef.current.has(k) || watchedEvtRef.current.has(event.id);
          if (!followed) continue;
          const prevFp = fpRef.current.get(k);
          if (prevFp && prevFp !== surebetFingerprint(sb)) {
            notify({
              kind: 'watched',
              title: `Surebet seguida mudou · ${sb.profitMargin.toFixed(2)}%`,
              subtitle: `${event.home} x ${event.away} · ${sb.marketTypes.map(marketLabel).join(' · ')}`,
              eventId: event.id,
              surebetKey: k,
              profit: sb.profitMargin
            });
          }
        }
        // Surebet seguida que SUMIU da lista.
        for (const k of watchedRef.current) {
          if (fpRef.current.has(k) && !cur.has(k)) {
            notify({ kind: 'gone', title: 'Surebet encerrada', subtitle: 'Uma surebet que você segue saiu da lista.', eventId: '', surebetKey: k });
          }
        }
      }
    }

    // Atualiza snapshots para a próxima comparação.
    const nextFp = new Map<string, string>();
    for (const [k, { sb }] of cur) nextFp.set(k, surebetFingerprint(sb));
    fpRef.current = nextFp;

    // Marca as novas para o badge (com timestamp para expirar).
    if (newlyNew.length) {
      const now = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewKeys((prev) => { const m = new Map(prev); newlyNew.forEach((k) => m.set(k, now)); return m; });
    }

    firstRef.current = false;
  }, [data, notify]);

  // Expira os badges "Novo" após o TTL.
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
