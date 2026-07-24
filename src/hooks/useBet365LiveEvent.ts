import { useEffect, useRef, useState, useCallback } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { openBet365LiveStream, Bet365LiveStream } from '@/services/nodelay/bet365LiveClient';
import { parseZapFrames, Bet365LiveTopic, m1TopicFor, setServerTime, sixVTopicFor, build6vMarkets, sixVGroups, applyMarketNames } from '@/services/nodelay/bet365LiveModel';

/**
 * Detalhe de UM jogo AO VIVO da bet365, no molde do useInstanceLiveEvent/useSuperbetLiveEvent: o HOOK
 * abre UM stream (WS zap direto) e fecha no cleanup. Mesma saída das outras casas
 * ({ detail, loading, error, changed, live, getHousePrice }). Só liga quando `platform === 'bet365'`.
 *
 * Fonte: OVInPlay (1X2 com odds) + o tópico M1 do jogo (placar/relógio/estatísticas), cujo id deriva do
 * C2 do panorama (navId = "15"+C2+"2"). O nst é mintado pelo backend; o streaming roda aqui.
 */
export function useBet365LiveEvent(primary: NoDelayBookmaker | undefined, gameId: string) {
  const active = !!primary && primary.platform === 'bet365' && !!gameId;
  const [detail, setDetail] = useState<LiveGameDetail | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const priceRef = useRef<Map<string, number>>(new Map());
  const detailRef = useRef<LiveGameDetail | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    detailRef.current = null;
    priceRef.current = new Map();
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false); setLive(false); setDetail(null);
      return;
    }
    setLoading(true); setError(null);

    const ov = new Bet365LiveTopic();   // panorama (OVInPlay): 1X2 com odds + mapa HM de nomes
    const m1 = new Bet365LiveTopic();   // ficha do jogo (M1): placar/relógio/estatísticas
    const sixV = new Bet365LiveTopic(); // 6V<id>C1A_33_0: TODOS os mercados com odds
    const sixVTopic = sixVTopicFor(gameId);
    let m1Topic = '';                    // <navId>M1_33 (assinado quando o C2 chega)
    let subscribed = false;
    let raf = 0;
    let stream: Bet365LiveStream | null = null;

    const recompute = () => {
      raf = 0;
      if (!aliveRef.current) return;

      // assina o M1 assim que o C2 do jogo aparece no panorama
      if (!subscribed) {
        const c2 = ov.eventFields(gameId)?.C2 || '';
        const t = m1TopicFor(c2);
        if (t) { m1Topic = t; subscribed = true; stream?.subscribe([t]); }
      }

      const ev = ov.buildEvents().find((e) => e.id === gameId);
      if (!ev) return;

      // placar/estatísticas do M1, quando já chegaram. O RELÓGIO NÃO vem do M1 (seedava do zero): o
      // ev.info.current_game_time já vem correto do OVInPlay (clockSecOf = base TM:TS + tempo desde TU).
      const info = m1.m1Info();
      if (info) {
        if (info.score) { const [a, b] = info.score.split('-'); ev.info.score1 = a?.trim(); ev.info.score2 = b?.trim(); }
        (ev.info as Record<string, unknown>).stats = info.stats;
      }

      // TODOS os mercados: do tópico 6V (ficha completa com odds). Enquanto não chega, mantém o 1X2 do
      // OVInPlay. O header/placar/relógio continuam do OVInPlay; só os mercados vêm do 6V.
      const allMk = build6vMarkets(sixV.allNodes());
      if (allMk.length) { ev.markets = allMk; ev.groups = sixVGroups(allMk); }

      const next = new Map<string, number>();
      const diff = new Set<string>();
      for (const mk of ev.markets) for (const s of mk.selections) {
        next.set(s.id, s.price);
        const prev = priceRef.current.get(s.id);
        if (prev != null && prev !== s.price) diff.add(s.id);
      }
      priceRef.current = next;
      detailRef.current = ev;
      setChanged(diff);
      setDetail(ev);
      setError(null);
      setLoading(false);
    };
    const schedule = () => { if (!raf && aliveRef.current) raf = window.requestAnimationFrame(recompute); };

    stream = openBet365LiveStream(
      (raw) => {
        if (!aliveRef.current) return;
        for (const m of parseZapFrames(raw)) {
          if (m.topic === '__time') { setServerTime(m.kind === 'full' ? m.nodes[0]?.TI : m.fields?.TI); } // relógio do servidor
          else if (m.kind === 'full' && m.topic === 'OVInPlay_33_0') { applyMarketNames(m.nodes); ov.applyFull(m.nodes); schedule(); }
          else if (m.kind === 'full' && m.topic === sixVTopic) { applyMarketNames(m.nodes); sixV.applyFull(m.nodes); schedule(); } // TODOS os mercados
          else if (m.kind === 'full' && m.topic === m1Topic) { m1.applyFull(m.nodes); schedule(); }
          else if (m.kind === 'update' && m.fields) {
            const a = ov.applyUpdate(m.topic, m.fields);
            const b = m1.applyUpdate(m.topic, m.fields);
            const c = sixV.applyUpdate(m.topic, m.fields); // odd de qualquer mercado da ficha
            if (a || b || c) schedule();
          }
        }
      },
      { extraTopics: sixVTopic ? [sixVTopic] : [], onStatus: (up) => { if (aliveRef.current) setLive(up); } },
    );

    // rede de segurança: se em 10s nada montou, sai do loading
    const t0 = window.setTimeout(() => { if (aliveRef.current && !detailRef.current) { setLoading(false); setError('Jogo indisponível.'); } }, 10_000);

    // ticker: recomputa 1×/s (o clockSecOf usa o "agora do servidor", que avança sozinho)
    const tick = window.setInterval(() => { if (aliveRef.current) schedule(); }, 1000);

    return () => {
      window.clearTimeout(t0);
      window.clearInterval(tick);
      if (raf) window.cancelAnimationFrame(raf);
      stream?.close();          // fecha ANTES de baixar aliveRef (o onStatus(false) do close ainda zera `live`)
      aliveRef.current = false;
      setChanged(new Set());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gameId]);

  const getHousePrice = useCallback((_slug: string, selId: string): HousePrice | undefined => {
    const d = detailRef.current;
    if (!d) return undefined;
    for (const mk of d.markets) {
      const s = mk.selections.find((x) => x.id === selId);
      if (s) return {
        // eventId = FI de APOSTA da seleção (PA.FI), não o id de exibição (d.id) — é o `f` do addbet.
        price: s.price, points: s.points, line: s.line, disabled: s.disabled, eventId: s.fi || d.id,
        // apostável AO VIVO: placeable {fp = PA.ID, mt = "7" (in-play), odd = FRAÇÃO nativa}. O addbet manda
        // `o`/`pv` fracionário — mandar decimal faz a bet365 devolver 0/0. Só com fp real (numérico) + fração.
        placeable: (/^\d+$/.test(s.id) && s.rawOdd && s.price > 1 && !s.disabled)
          ? { selectionId: s.id, mt: '7', odd: s.rawOdd }
          : null,
      };
    }
    return undefined;
  }, []);

  return { detail, loading, error, changed, live, getHousePrice };
}
