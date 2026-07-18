import { useState, useEffect, useRef, useCallback } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { openEventStream, RogueOp } from '@/services/nodelay/rogueClient';
import {
  eventToDetail, applyRogueDelta, applyEventDelta, removeMarket, upsertMarket, freezeMarket, LiveGameDetail,
} from '@/services/nodelay/rogueModel';

/** Chave estável do mercado (= marketKeyOf do quadro): MarketTypeId ou nome. */
const marketKey = (m: { marketTypeId?: string; name: string }): string => m.marketTypeId || m.name;

/**
 * O MESMO evento ao vivo assinado em TODAS as casas prontas da instância.
 *
 * As casas do padrão fssb rodam o MESMO core (event `_id` e selection `_id`
 * idênticos entre elas — provado: 796/796 no coletor), então o mesmo id de
 * seleção aposta em qualquer casa. A casa PRIMÁRIA (houses[0]) vira o `detail`
 * exibido (uma casa só na tela); as demais seguem streamando por baixo e
 * alimentam o `getHousePrice`, para o disparo pegar a odd ESPECÍFICA de cada casa
 * na hora do placeBet. Um clique → aposta em todas as contas de todas as casas.
 *
 * `changed` = ids de seleção da PRIMÁRIA que acabaram de mexer (célula pisca).
 */
const FLASH_MS = 1200;

export interface HousePrice {
  price: number;
  points: number | null;
  line: string | null;
  disabled: boolean;
}

type Rec = Record<string, unknown>;

/** Indexa selection _id → preço a partir de um detalhe (p/ lookup O(1) no disparo). */
function indexPrices(detail: LiveGameDetail | null): Map<string, HousePrice> {
  const m = new Map<string, HousePrice>();
  if (!detail) return m;
  for (const mk of detail.markets) {
    for (const s of mk.selections) {
      m.set(s.id, { price: s.price, points: s.points, line: s.line, disabled: s.disabled || mk.suspended });
    }
  }
  return m;
}

export function useInstanceLiveEvent(houses: NoDelayBookmaker[], eventId: string, antiProtect?: Set<string>) {
  const ready = houses.filter((h) => h.ready && h.rogueUrl);
  const primarySlug = ready[0]?.slug ?? '';
  // Inclui o HOST na chave: se o rogueUrl da casa mudar, re-assina (senão a SSE
  // ficaria lendo o host velho enquanto a aposta posta no novo).
  const readyKey = ready.map((h) => `${h.slug}@${h.rogueUrl}`).sort().join(',');

  const [detail, setDetail] = useState<LiveGameDetail | null>(null);
  const [loading, setLoading] = useState(!!(primarySlug && eventId));
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);

  // slug → (selection _id → preço). Ref: atualiza a cada tick sem re-render (só
  // é lido no instante do disparo).
  const priceRef = useRef<Map<string, Map<string, HousePrice>>>(new Map());
  const detailRef = useRef<LiveGameDetail | null>(null); // = primária
  const flashTimers = useRef<Map<string, number>>(new Map());
  const aliveRef = useRef(true);
  // Anti Proteção corrente num REF (lido dentro do onOps sem re-assinar a SSE ao
  // ligar/desligar num mercado — re-assinar dropava o stream).
  const stickyRef = useRef<Set<string>>(antiProtect ?? new Set());
  useEffect(() => { stickyRef.current = antiProtect ?? new Set(); }, [antiProtect]);

  /** Preço da seleção NAQUELA casa (undefined = ainda não chegou → usar fallback). */
  const getHousePrice = useCallback((slug: string, selId: string): HousePrice | undefined => {
    return priceRef.current.get(slug)?.get(selId);
  }, []);

  const flash = useCallback((ids: Set<string>) => {
    if (!ids.size) return;
    setChanged((prev) => new Set([...prev, ...ids]));
    for (const id of ids) {
      const t = flashTimers.current.get(id);
      if (t) window.clearTimeout(t);
      flashTimers.current.set(id, window.setTimeout(() => {
        if (!aliveRef.current) return;
        setChanged((prev) => { const n = new Set(prev); n.delete(id); return n; });
        flashTimers.current.delete(id);
      }, FLASH_MS));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    priceRef.current = new Map();
    detailRef.current = null;
    const timers = flashTimers.current;
    if (!primarySlug || !eventId) return;

    // Detalhe corrente POR casa (uma casa não mexe no detalhe da outra).
    const perHouse = new Map<string, LiveGameDetail | null>();

    const streams = ready.map((house) => {
      const slug = house.slug;
      const isPrimary = slug === primarySlug;
      perHouse.set(slug, null);

      const onOps = (ops: RogueOp[]) => {
        let cur = perHouse.get(slug) ?? null;
        const changedIds = new Set<string>();

        for (const op of ops) {
          const type = String(op.Type || '');
          const cs = op.Changeset as Rec | undefined;

          if (op.Operation === 'initial' && cs?.event) {
            cur = eventToDetail(cs.event as Rec);
            if (isPrimary && aliveRef.current) {
              detailRef.current = cur;
              setDetail(cur);
              setError(cur ? null : 'Jogo indisponível.');
              setLoading(false);
            }
            continue;
          }
          if (!cur) continue;

          // A fssb move a LINHA trocando o mercado inteiro (delete do velho + add do
          // novo completo). Tratamos os DOIS juntos: o add repõe o delete (contagem
          // fica estável — validado ao vivo) e a linha 2.5→3.5 atualiza sozinha.
          // ⚠️ delete SEM add (o que eu tinha antes) encolhia o detalhe até esvaziar.
          if (op.Operation === 'delete' && type === 'market') {
            const mid = String((op.Reference as Rec | undefined)?.MarketId ?? cs?._id ?? '');
            if (mid) {
              // Anti Proteção: se o usuário marcou ESTE mercado, não some — congela
              // o último snapshot (travado) até a odd voltar; senão, remove normal.
              const target = cur.markets.find((m) => m.id === mid);
              const sticky = target ? stickyRef.current.has(marketKey(target)) : false;
              cur = sticky ? freezeMarket(cur, mid) : removeMarket(cur, mid);
            }
            continue;
          }
          if (op.Operation === 'add' && type === 'market' && cs) {
            // Troca de linha = delete(velho)+add(novo) do MESMO tipo. O MarketTypeId é
            // único por evento, então tiro QUALQUER mercado do mesmo tipo antes de
            // inserir o novo — assim o placeholder congelado (Anti Proteção) ou a
            // linha velha some, sem depender da ordem delete/add no lote.
            const mt = (cs.MarketType as Rec | undefined)?._id;
            const newKey = String(mt ?? cs.Name ?? '');
            const newId = String(cs._id ?? '');
            if (newKey) {
              cur = { ...cur, markets: cur.markets.filter((m) => m.id === newId || marketKey(m) !== newKey) };
            }
            cur = upsertMarket(cur, cs);
            continue;
          }

          if (type === 'market') {
            const { next, changed: ids } = applyRogueDelta(cur, op);
            cur = next;
            if (isPrimary) ids.forEach((id) => changedIds.add(id));
          } else if (type === 'event') {
            cur = applyEventDelta(cur, op);
          }
        }

        perHouse.set(slug, cur);
        priceRef.current.set(slug, indexPrices(cur));

        if (isPrimary && aliveRef.current) {
          if (cur !== detailRef.current) { detailRef.current = cur; setDetail(cur); }
          if (changedIds.size) flash(changedIds);
        }
      };

      return openEventStream(
        { slug, rogueUrl: house.rogueUrl! },
        eventId,
        onOps,
        (isLive) => { if (isPrimary && aliveRef.current) setLive(isLive); },
      );
    });

    // Se o initial da primária não chegar em 10s, desiste do "carregando".
    const t = window.setTimeout(() => { if (aliveRef.current && !detailRef.current) setLoading(false); }, 10_000);

    return () => {
      window.clearTimeout(t);
      for (const tm of timers.values()) window.clearTimeout(tm);
      timers.clear();
      // Fecha os streams ANTES de baixar aliveRef: o close() da primária dispara
      // onState(false) e o guard (isPrimary && aliveRef) ainda passa → zera o
      // "tempo real" (senão o indicador fica preso online após teardown).
      for (const s of streams) s.close();
      aliveRef.current = false;
      // Limpa flashes presos — os timers de remoção foram cancelados acima, então
      // sem isto as células ficariam destacadas pra sempre no re-assinar.
      setChanged(new Set());
    };
    // ready é derivado de readyKey (mesmos slugs/hosts) — dep estável via readyKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey, eventId, primarySlug, flash]);

  return { detail, loading, error, changed, live, getHousePrice };
}
