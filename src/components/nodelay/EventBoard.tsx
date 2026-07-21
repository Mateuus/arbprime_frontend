import { useState, useMemo } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { maxStakeOf } from '@/services/nodelay/maxStake';
import { useNowTick } from '@/hooks/useNowTick';
import {
  categorize, filterMarkets, marketTitle, selectionLabel, fmtOdd, fmtMaxStake, isUnder,
} from '@/utils/nodelayLive';
import { Lock, ChevronDown, Star } from 'lucide-react';

/**
 * Quadro de odds no estilo bet365 (a cara que o apostador brasileiro conhece):
 * abas de categoria no topo, e cada mercado como uma SEÇÃO full-width escura —
 * sem card arredondado, sem busca. As odds saem em AMBAR/OURO (a assinatura da
 * bet365), enquanto o acento lime fica reservado ao NoDelay (aba ativa, favorito,
 * disparo). Componente COMPARTILHADO: todas as casas normalizam pro mesmo
 * `LiveGameDetail`, então swarm/fssb, biahosted/Altenar e superbet usam este board.
 *
 * As abas saem das MarketGroups nativas da casa via `categorize()`. Cada mercado
 * é desenhado pela sua FORMA:
 *   - 3 vias (1X2 / Resultado Final / "4º Gol"): uma linha de 3 células iguais.
 *   - Over/Under com linha (Partida - Gols): sub-cabeçalho "Mais de | Menos de" e
 *     uma linha por valor de linha (4.5, 5.5…), pareando os dois lados.
 *   - Resto (placar correto, próximo marcador…): grid responsivo nome+odd.
 *
 * O contrato onPick(market, sel) é IDÊNTICO ao MarketBoard — a Aposta Rápida segue
 * funcionando sem tocar no disparo.
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

export function EventBoard({ detail, changed, onPick, favorites, onToggleFavorite, delayTradeOnly, hidePriceless, k }: Props) {
  const tick = useNowTick(2000); // reavalia o "suspenso >10s some" sem depender de delta
  const tabs = useMemo(
    () => categorize(detail.groups, filterMarkets(detail.markets, { delayTradeOnly, hidePriceless })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail, delayTradeOnly, hidePriceless, tick],
  );
  const [tabId, setTabId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const active = useMemo(() => tabs.find((t) => t.id === tabId) ?? tabs[0], [tabs, tabId]);
  const markets = active?.markets ?? [];

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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {/* Abas de categoria — rolam na horizontal no mobile (nunca estouram a página) */}
      <div className="overflow-x-auto border-b border-white/10 bg-black/20">
        <div className="flex w-max gap-1 px-2 py-2">
          {tabs.map((t) => {
            const on = t.id === active?.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabId(t.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  on
                    ? 'bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/40'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seções de mercado — cada uma full-width, separadas por divisores sutis */}
      <div className="divide-y divide-white/10">
        {markets.map((m) => (
          <MarketSection
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
        ))}
      </div>
    </div>
  );
}

// Quantas seleções mostrar antes do "Mostrar todos" no fallback em grid (mercados
// longos: placar correto, próximo marcador). Múltiplo de 3 p/ fechar bem o grid.
const PREVIEW = 9;

/** Formas de mercado que sabemos desenhar no estilo bet365. */
type Shape = 'ou' | 'threeway' | 'grid';

/** Uma seleção é do lado "Mais"/Over? (complementar do isUnder, dentro de um OU). */
const isOver = (s: LiveSelection): boolean => !isUnder(s);

/**
 * Valor da LINHA de uma seleção over/under (0.5, 2.5, +1…) p/ parear os dois lados.
 * Over e Under da mesma linha compartilham o Points; caso venha null, extrai do
 * texto do BetslipLine (tirando o prefixo "Mais de"/"Menos de").
 */
function lineKeyOf(s: LiveSelection): string {
  if (s.points != null) return String(Math.abs(s.points));
  if (s.line) return s.line.replace(/^(mais de|menos de|acima|abaixo|over|under)\s*/i, '').trim();
  return s.name;
}

/** Detecta a forma do mercado a partir das seleções. */
function marketShape(m: LiveMarket): Shape {
  const sels = m.selections;
  const hasUnder = sels.some(isUnder);
  const hasOver = sels.some((s) => s.outcomeType ? /over/i.test(s.outcomeType) : /(mais|acima|over)/i.test(s.name));
  // Over/Under de verdade: tem os dois lados (senão é um 2-vias qualquer → grid).
  if (hasUnder && hasOver) return 'ou';
  // 1X2 / Resultado Final / "Nº Gol": exatamente 3 vias sem over/under.
  if (sels.length === 3) return 'threeway';
  return 'grid';
}

function MarketSection({
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
  const shape = useMemo(() => marketShape(market), [market]);
  const pick = onPick ? (s: LiveSelection) => onPick(market, s) : undefined;
  const maxOf = (s: LiveSelection) => (k ? maxStakeOf(s, market, k) : null);
  // Chip "CA" (Criar Aposta) — decorativo por ora. bet365 marca os mercados que
  // aceitam bet builder; aqui destacamos os de resultado (3 vias) como aproximação.
  const showCA = shape === 'threeway';

  return (
    <div className={market.suspended ? 'bg-rose-500/[0.04]' : ''}>
      {/* Cabeçalho do mercado */}
      <div className="flex items-center gap-2 px-3 py-2.5">
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
            <span className="truncate text-sm font-semibold text-white">{marketTitle(market)}</span>
            {showCA && (
              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
                CA
              </span>
            )}
            {market.suspended && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/40">
                <Lock size={8} /> Suspenso
              </span>
            )}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-gray-500 transition ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3">
          {shape === 'ou'
            ? <OverUnderBody market={market} changed={changed} onPick={pick} maxOf={maxOf} />
            : shape === 'threeway'
              ? <ThreeWayBody market={market} changed={changed} onPick={pick} maxOf={maxOf} />
              : <GridBody market={market} changed={changed} onPick={pick} maxOf={maxOf} />}
        </div>
      )}
    </div>
  );
}

// Ordem 1X2 fixa: Casa (side 1) à esquerda, Fora (side 3) à direita, EMPATE/meio
// (side 2 ou "Sem gol") SEMPRE no centro — como a bet365. Times sem `side` (ex.:
// Altenar) mantêm a ordem original (sort estável, todos caem no meio).
function threeWayOrder(s: LiveSelection): number {
  if (s.side === 1) return 0;
  if (s.side === 3) return 2;
  return 1;
}

/** Linha única de 3 células iguais (1X2 / Resultado Final). Empate sempre no meio. */
function ThreeWayBody({ market, changed, onPick, maxOf }: BodyProps) {
  const ordered = [...market.selections].sort((a, b) => threeWayOrder(a) - threeWayOrder(b));
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {ordered.map((s) => (
        <NamedOdd
          key={s.id}
          sel={s}
          suspended={market.suspended}
          flash={changed.has(s.id)}
          maxStake={maxOf(s)}
          onClick={onPick ? () => onPick(s) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Over/Under: sub-cabeçalho "Mais de | Menos de" e uma linha por valor de linha,
 * com o valor à esquerda e as duas odds pareadas. Se um lado faltar naquela linha,
 * a célula vira placeholder morto (—).
 */
function OverUnderBody({ market, changed, onPick, maxOf }: BodyProps) {
  const rows = useMemo(() => {
    const map = new Map<string, { over?: LiveSelection; under?: LiveSelection }>();
    for (const s of market.selections) {
      const key = lineKeyOf(s);
      const row = map.get(key) ?? {};
      if (isUnder(s)) row.under = s; else if (isOver(s)) row.over = s;
      map.set(key, row);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, num: parseFloat(key), ...v }))
      .sort((a, b) => (Number.isFinite(a.num) && Number.isFinite(b.num) ? a.num - b.num : a.key.localeCompare(b.key)));
  }, [market.selections]);

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[3rem_1fr_1fr] gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">
        <span />
        <span className="text-center">Mais de</span>
        <span className="text-center">Menos de</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-1.5">
          <span className="text-center text-xs font-semibold tabular-nums text-gray-300">{r.key}</span>
          <BareOdd sel={r.over} suspended={market.suspended} flash={r.over ? changed.has(r.over.id) : false} maxStake={r.over ? maxOf(r.over) : null} onClick={r.over && onPick ? () => onPick(r.over!) : undefined} />
          <BareOdd sel={r.under} suspended={market.suspended} flash={r.under ? changed.has(r.under.id) : false} maxStake={r.under ? maxOf(r.under) : null} onClick={r.under && onPick ? () => onPick(r.under!) : undefined} />
        </div>
      ))}
    </div>
  );
}

/**
 * Fallback: grid responsivo de células nome+odd (placar correto, próximo marcador,
 * gols por time). TODO(futuro): stepper +/- "Resultado Correto" da bet365; por ora
 * um grid simples cobre bem e não confunde o disparo.
 */
function GridBody({ market, changed, onPick, maxOf }: BodyProps) {
  const [showAll, setShowAll] = useState(false);
  const many = market.selections.length > PREVIEW;
  const shown = many && !showAll ? market.selections.slice(0, PREVIEW) : market.selections;
  // 2 vias fecham em 2 colunas; o resto em 2 (mobile) / 3 (desktop).
  const two = market.selections.length === 2;

  if (shown.length === 0) {
    return <div className="rounded-lg bg-black/20 px-3 py-3 text-center text-xs text-gray-600">Sem seleções ativas.</div>;
  }

  return (
    <>
      <div className={`grid gap-1.5 ${two ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {shown.map((s) => (
          <NamedOdd
            key={s.id}
            sel={s}
            suspended={market.suspended}
            flash={changed.has(s.id)}
            maxStake={maxOf(s)}
            onClick={onPick ? () => onPick(s) : undefined}
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
    </>
  );
}

interface BodyProps {
  market: LiveMarket;
  changed: Set<string>;
  onPick?: (sel: LiveSelection) => void;
  maxOf: (sel: LiveSelection) => number | null;
}

/** Chip "máx apostável" sob a odd (reaproveita fmtMaxStake). */
function MaxChip({ maxStake }: { maxStake: number }) {
  return (
    <span className="rounded bg-lime-500/10 px-1 py-px text-[9px] font-bold tabular-nums text-lime-300/90 ring-1 ring-lime-500/25">
      máx {fmtMaxStake(maxStake)}
    </span>
  );
}

/**
 * Célula nome+odd (1X2, grid). Nome à esquerda (mudo), odd à direita em OURO.
 * Suspenso → travado/vermelho com cadeado; morto → cinza; odd que mudou → pisca.
 */
function NamedOdd({ sel, suspended, flash, maxStake, onClick }: CellProps) {
  const dead = suspended || sel.disabled || sel.price <= 0;
  const label = selectionLabel(sel.name, sel.points);
  const showMax = !dead && maxStake != null && maxStake >= 1;
  return (
    <button
      disabled={dead}
      onClick={onClick}
      title={suspended ? 'Suspenso (lance perigoso)' : showMax ? `Máx apostável: R$ ${maxStake!.toFixed(2)}` : (sel.line || label)}
      className={`flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-left ring-1 transition ${cellClass(suspended, dead, flash)}`}
    >
      <span className={`min-w-0 truncate text-[11px] ${suspended ? 'text-rose-300/80' : 'text-gray-300'}`}>{label || '—'}</span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 leading-none">
        <OddValue sel={sel} suspended={suspended} dead={dead} />
        {showMax && <MaxChip maxStake={maxStake!} />}
      </span>
    </button>
  );
}

/** Célula só-odd (linhas over/under). A odd centralizada em OURO. `sel` pode faltar. */
function BareOdd({ sel, suspended, flash, maxStake, onClick }: { sel?: LiveSelection } & Omit<CellProps, 'sel'>) {
  if (!sel) {
    return <span className="rounded-lg bg-black/10 px-2.5 py-2 text-center text-xs text-gray-700 ring-1 ring-white/5">—</span>;
  }
  const dead = suspended || sel.disabled || sel.price <= 0;
  const showMax = !dead && maxStake != null && maxStake >= 1;
  return (
    <button
      disabled={dead}
      onClick={onClick}
      title={suspended ? 'Suspenso (lance perigoso)' : showMax ? `Máx apostável: R$ ${maxStake!.toFixed(2)}` : (sel.line || sel.name)}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-2 ring-1 transition ${cellClass(suspended, dead, flash)}`}
    >
      <OddValue sel={sel} suspended={suspended} dead={dead} />
      {showMax && <MaxChip maxStake={maxStake!} />}
    </button>
  );
}

/** Odd em ouro (ou cadeado se suspenso, — se morta). */
function OddValue({ sel, suspended, dead }: { sel: LiveSelection; suspended?: boolean; dead: boolean }) {
  if (suspended) return <Lock size={12} className="text-rose-400" />;
  return (
    <span className={`text-sm font-bold tabular-nums ${dead ? 'text-gray-600' : 'text-amber-400'}`}>
      {dead ? '—' : fmtOdd(sel.price)}
    </span>
  );
}

interface CellProps {
  sel: LiveSelection;
  suspended?: boolean;
  flash: boolean;
  maxStake?: number | null;
  onClick?: () => void;
}

/** Classe da célula por estado (compartilhada entre NamedOdd e BareOdd). */
function cellClass(suspended: boolean | undefined, dead: boolean, flash: boolean): string {
  if (suspended) return 'cursor-not-allowed bg-rose-500/10 ring-rose-500/30'; // lance perigoso — sinal
  if (dead) return 'cursor-not-allowed bg-black/20 ring-white/5';
  if (flash) return 'bg-lime-500/25 ring-lime-400/60'; // odd mudou → pisca
  return 'bg-black/25 ring-white/10 hover:bg-white/5 hover:ring-amber-500/40';
}
