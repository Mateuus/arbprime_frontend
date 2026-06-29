'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCcw, Trophy, Tag, Calendar } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';
import { MiddleData, MiddleLeg } from '@/interfaces/middle.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
import { useBookmakers } from '@/hooks/useBookmakers';
import { useMiddleHouses } from '@/utils/middleHouses';
import { legSelectionLabel, fmtDateTime } from '@/utils/middle';
import { marketLabel } from '@/utils/surebet';

type Pt = { t: number; price: number };
interface HistRow { recordedAt: string; price: number | string; selection: string; handicap: string }

// Escolhe, entre as séries (por seleção) do histórico, a que bate com a odd atual
// da casa — robusto a nomes de seleção diferentes entre casas.
function pickSeries(rows: HistRow[], currentPrice: number): Pt[] {
  const groups = new Map<string, Pt[]>();
  for (const r of rows) {
    const sel = r.selection || '';
    const arr = groups.get(sel) || [];
    const t = new Date(r.recordedAt).getTime();
    const price = Number(r.price);
    if (Number.isFinite(t) && Number.isFinite(price)) arr.push({ t, price });
    groups.set(sel, arr);
  }
  let best: Pt[] = [];
  let bestDiff = Infinity;
  for (const pts of groups.values()) {
    pts.sort((a, b) => a.t - b.t);
    const latest = pts[pts.length - 1]?.price;
    const diff = Math.abs((latest ?? Infinity) - currentPrice);
    if (diff < bestDiff) { bestDiff = diff; best = pts; }
  }
  return best;
}

function Sparkline({ points, color }: { points: Pt[]; color: string }) {
  if (points.length < 2) return <div className="py-8 text-center text-[11px] text-gray-500">Sem histórico de movimentação para esta odd.</div>;
  const w = 320, h = 76, pad = 6;
  const xs = points.map((p) => p.t), ps = points.map((p) => p.price);
  const minT = Math.min(...xs), maxT = Math.max(...xs), minP = Math.min(...ps), maxP = Math.max(...ps);
  const x = (t: number) => pad + (maxT === minT ? 0 : (t - minT) / (maxT - minT)) * (w - 2 * pad);
  const y = (p: number) => pad + (maxP === minP ? 0.5 : 1 - (p - minP) / (maxP - minP)) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Modal de UMA perna do middle: histórico daquela odd + a MESMA seleção em outras
 * casas (com a odd atual de cada). Busca o grupo do evento (mesma seleção) e o
 * histórico (odds_history) sob demanda — espelha o OddModal das surebets.
 */
export function MiddleOddModal({ event, leg, onClose }: { event: MiddleData; leg: MiddleLeg; onClose: () => void }) {
  const { getBookmaker } = useBookmakers();
  const { legInfo, loading } = useMiddleHouses([leg], true);
  const info = legInfo[0];
  const houses = info?.houses?.length ? info.houses : [{ bookmaker: leg.bookmaker, eventId: leg.eventId, price: leg.price, size: leg.size ?? null, used: true }];
  const marketId = info?.marketId || leg.market;
  const best = houses.length ? houses[0].price : leg.price;

  const [focus, setFocus] = useState(leg.bookmaker);
  const [histByHouse, setHistByHouse] = useState<Record<string, Pt[]>>({});
  const [histLoading, setHistLoading] = useState(false);

  const focusHouse = houses.find((h) => h.bookmaker.toLowerCase() === focus.toLowerCase()) || houses[0];

  // Busca o histórico da casa focada (cacheado por casa).
  useEffect(() => {
    if (!focusHouse || histByHouse[focusHouse.bookmaker]) return;
    let active = true;
    setHistLoading(true);
    apiGateway
      .getExternalEventHistory(focusHouse.bookmaker, focusHouse.eventId, { marketId, limit: 200 })
      .then((res) => {
        if (!active) return;
        const rows: HistRow[] = res.data?.result === 1 ? (res.data.data || []) : [];
        const picked = pickSeries(rows, focusHouse.price);
        setHistByHouse((p) => ({ ...p, [focusHouse.bookmaker]: picked.length ? picked : [{ t: Date.now(), price: focusHouse.price }] }));
      })
      .catch(() => { if (active) setHistByHouse((p) => ({ ...p, [focusHouse.bookmaker]: [] })); })
      .finally(() => { if (active) setHistLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, marketId]);

  const focusColor = getBookmaker(focus)?.color || '#818cf8';
  const focusPts = histByHouse[focusHouse?.bookmaker] || [];
  const dateLabel = fmtDateTime(event.date);
  const selLabel = legSelectionLabel(leg, event.home, event.away);
  const fmtT = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const changes = useMemo(() => [...focusPts].reverse(), [focusPts]);

  const body = (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar"><X size={18} /></button>

        {/* Cabeçalho: seleção + evento */}
        <div className="mb-3 pr-8">
          <div className="inline-flex items-center gap-1 text-[11px] text-indigo-300/80"><Tag size={11} /> {leg.rawMarket?.trim() || marketLabel(leg.market)}</div>
          <h2 className="text-base font-bold leading-tight text-white">{selLabel}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
            <span className="truncate">{event.home} × {event.away}</span>
            {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={11} className="shrink-0 text-indigo-400/60" /> <span className="truncate">{event.league}</span></span>}
            {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Calendar size={11} /> {dateLabel}</span>}
          </div>
        </div>

        {/* Gráfico de histórico da casa focada */}
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-2">
          {histLoading && !focusPts.length ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-gray-400"><RefreshCcw className="animate-spin" size={14} /> Carregando histórico…</div>
          ) : (
            <Sparkline points={focusPts} color={focusColor} />
          )}
        </div>

        {/* A mesma seleção em outras casas */}
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wider text-gray-500">Esta seleção em outras casas {loading && '…'}</span>
          <span className="shrink-0 text-[11px] text-gray-500">{houses.length} {houses.length === 1 ? 'casa' : 'casas'}</span>
        </div>
        <div className="space-y-1">
          {houses.map((h) => (
            <button
              key={h.bookmaker}
              onClick={() => setFocus(h.bookmaker)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 ring-1 transition ${focus.toLowerCase() === h.bookmaker.toLowerCase() ? 'bg-indigo-500/15 ring-indigo-500/40' : 'bg-black/20 ring-white/5 hover:bg-white/5'}`}
            >
              <BookmakerTag slug={h.bookmaker} size={16} nameClassName="text-[12px]" />
              <CommissionBadge pct={getBookmaker(h.bookmaker)?.commissionPct} className="!px-1 !py-0 !text-[9px]" />
              {h.used && <span className="shrink-0 text-[9px] uppercase text-indigo-300/80">no middle</span>}
              <span className={`ml-auto shrink-0 text-sm font-bold tabular-nums ${h.price === best ? 'text-emerald-300' : 'text-gray-200'}`}>{h.price.toFixed(2)}</span>
            </button>
          ))}
        </div>

        {/* Mudanças da casa focada */}
        {changes.length > 1 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">Mudanças — {getBookmaker(focus)?.name || focus}</div>
            <div className="max-h-32 space-y-0.5 overflow-y-auto">
              {changes.map((p, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? p.price - prev.price : 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded bg-black/20 px-2.5 py-1 text-[11px]">
                    <span className="text-gray-500">{fmtT(p.t)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums text-gray-200">{p.price.toFixed(2)}</span>
                      {prev && <span className={`tabular-nums ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-rose-400' : 'text-gray-600'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '–'}{d !== 0 ? Math.abs(d).toFixed(2) : ''}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}

export default MiddleOddModal;
