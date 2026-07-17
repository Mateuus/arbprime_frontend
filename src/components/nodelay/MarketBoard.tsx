import { useState, useMemo } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { maxStakeOf } from '@/services/nodelay/maxStake';
import { categorize, filterMarkets, marketTitle, selectionLabel, fmtOdd, fmtMaxStake } from '@/utils/nodelayLive';
import { Lock, ChevronDown, Search, Star } from 'lucide-react';

/**
 * Odds do evento em abas por categoria — como o site 7games organiza (as abas
 * saem das MarketGroups nativas da rogue: Todos/Principais/Gols/Escanteios/…).
 * Cada mercado é um card recolhível. Não passamos pelo catálogo canônico do
 * /events de propósito: aqui o objetivo é ESPELHAR a casa para apostar rápido.
 */

interface Props {
  detail: LiveGameDetail;
  changed: Set<string>;
  onPick?: (market: LiveMarket, sel: LiveSelection) => void;
  /** Favoritos (por nome de mercado) + toggle — alimentam a Aposta Rápida. */
  favorites?: Set<string>;
  onToggleFavorite?: (marketName: string) => void;
  /** Filtros Delay Trade (ver useNoDelaySettings). */
  delayTradeOnly?: boolean;
  hidePriceless?: boolean;
  /** Fator do cliente p/ o max stake (null = ainda calibrando → não mostra MÁX). */
  k?: number | null;
}

export function MarketBoard({ detail, changed, onPick, favorites, onToggleFavorite, delayTradeOnly, hidePriceless, k }: Props) {
  const tabs = useMemo(
    () => categorize(detail.groups, filterMarkets(detail.markets, { delayTradeOnly, hidePriceless })),
    [detail, delayTradeOnly, hidePriceless],
  );
  const [tabId, setTabId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const active = useMemo(() => tabs.find((t) => t.id === tabId) ?? tabs[0], [tabs, tabId]);

  const markets = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = active?.markets ?? [];
    return term ? list.filter((m) => m.name.toLowerCase().includes(term)) : list;
  }, [active, q]);

  const toggle = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (tabs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
        Nenhum mercado aberto neste jogo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Abas de categoria — rolam na horizontal no mobile */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          {tabs.map((t) => {
            const on = t.id === active?.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabId(t.id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  on ? 'bg-lime-500/15 text-lime-200 ring-lime-500/40' : 'bg-white/5 text-gray-400 ring-white/10 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {t.name}
                <span className={`ml-1.5 text-[10px] ${on ? 'text-lime-400/70' : 'text-gray-600'}`}>{t.markets.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Busca de mercado */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar mercado…"
          className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
        />
      </div>

      {/* Mercados */}
      <div className="space-y-2">
        {markets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-gray-500">
            Nenhum mercado bate com a busca.
          </div>
        ) : (
          markets.map((m) => (
            <MarketCard
              key={m.id}
              market={m}
              changed={changed}
              collapsed={collapsed.has(m.id)}
              onToggle={() => toggle(m.id)}
              onPick={onPick}
              favorite={favorites?.has(m.name)}
              onToggleFavorite={onToggleFavorite}
              k={k}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Quantas seleções mostrar antes do "Mostrar todos" (mercados longos: placar,
// próximo marcador). Múltiplo de 3 p/ fechar bem no grid.
const PREVIEW = 9;

function MarketCard({
  market, changed, collapsed, onToggle, onPick, favorite, onToggleFavorite, k,
}: {
  market: LiveMarket;
  changed: Set<string>;
  collapsed: boolean;
  onToggle: () => void;
  onPick?: Props['onPick'];
  favorite?: boolean;
  onToggleFavorite?: (marketName: string) => void;
  k?: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const many = market.selections.length > PREVIEW;
  const shown = many && !showAll ? market.selections.slice(0, PREVIEW) : market.selections;

  // Grid: 1X2 e afins = 3 colunas; over/under de 2 vias = 2; escolhe pelo nº.
  const cols = market.selections.length % 3 === 0 ? 3 : market.selections.length % 2 === 0 ? 2 : 3;

  return (
    <div className={`rounded-xl border bg-white/[0.03] transition ${market.suspended ? 'border-rose-500/40' : 'border-white/10'}`}>
      <div className="flex items-center gap-1 px-3 py-2.5">
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(market.name)}
            className={`shrink-0 rounded p-0.5 transition ${favorite ? 'text-lime-300' : 'text-gray-600 hover:text-gray-300'}`}
            title={favorite ? 'Remover da aposta rápida' : 'Favoritar p/ aposta rápida'}
          >
            <Star size={14} className={favorite ? 'fill-lime-300' : ''} />
          </button>
        )}
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-semibold text-gray-200">{marketTitle(market)}</span>
            {market.suspended && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/40">
                <Lock size={8} /> Suspenso
              </span>
            )}
          </span>
          <ChevronDown size={15} className={`shrink-0 text-gray-500 transition ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {shown.map((s) => (
              <OddButton
                key={s.id}
                sel={s}
                flash={changed.has(s.id)}
                suspended={market.suspended}
                maxStake={k ? maxStakeOf(s, market, k) : null}
                onClick={onPick ? () => onPick(market, s) : undefined}
              />
            ))}
          </div>
          {many && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-lg bg-white/5 py-1.5 text-[11px] font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              {showAll ? 'Mostrar menos' : `Mostrar todos (${market.selections.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OddButton({
  sel, flash, suspended, maxStake, onClick,
}: { sel: LiveSelection; flash: boolean; suspended?: boolean; maxStake?: number | null; onClick?: () => void }) {
  const dead = suspended || sel.disabled || sel.price <= 0;
  const label = selectionLabel(sel.name, sel.points);
  const showMax = !dead && maxStake != null && maxStake >= 1;

  return (
    <button
      disabled={dead}
      onClick={onClick}
      className={`flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-left ring-1 transition ${
        suspended
          ? 'cursor-not-allowed bg-rose-500/10 text-rose-300 ring-rose-500/30' // lance perigoso — sinal
          : dead
            ? 'cursor-not-allowed bg-black/20 text-gray-600 ring-white/5'
            : flash
              ? 'bg-lime-500/25 text-white ring-lime-400/60'
              : 'bg-black/25 text-white ring-white/10 hover:bg-white/10 hover:ring-lime-500/30'
      }`}
      title={suspended ? 'Suspenso (lance perigoso)' : showMax ? `Máx apostável: R$ ${maxStake!.toFixed(2)}` : (sel.line || label)}
    >
      <span className={`min-w-0 truncate text-[11px] ${suspended ? 'text-rose-300/80' : 'text-gray-300'}`}>{label || '—'}</span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 leading-none">
        <span className="text-xs font-bold tabular-nums">
          {suspended ? <Lock size={12} className="text-rose-400" /> : dead ? '—' : fmtOdd(sel.price)}
        </span>
        {showMax && (
          <span className="rounded bg-lime-500/10 px-1 py-px text-[9px] font-bold tabular-nums text-lime-300/90 ring-1 ring-lime-500/25">
            máx {fmtMaxStake(maxStake!)}
          </span>
        )}
      </span>
    </button>
  );
}
