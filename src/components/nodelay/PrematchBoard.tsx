import { useState, useMemo } from 'react';
import { fmtOdd } from '@/utils/nodelayLive';
import { formatEventDateTime } from '@/utils/eventTime';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBookmakers } from '@/hooks/useBookmakers';
import { usePrematchEventGroup } from '@/hooks/usePrematchEventGroup';
import { usePrematchGroupedGames, PrematchGame } from '@/hooks/usePrematchGroupedGames';
import { EventGroupSelection, EventGroupPrice } from '@/gateways/api.gateway';
import { ArrowLeft, Menu, ChevronDown, Loader2, X, Star, Layers, Zap } from 'lucide-react';

/**
 * Board de PRÉ-JOGO com DADOS REAIS do nosso catálogo /events
 * (usePrematchEventGroup), filtrado às casas da INSTÂNCIA (houseSlugs = Contas
 * prontas). DISPLAY-ONLY: ainda não dá pra apostar no pré-jogo (o catálogo não
 * tem os ids apostáveis) — o board só exibe. As células são estruturadas p/
 * receber o disparo depois (ver // TODO(place)).
 *
 * Dois modos de exibição (toggle no topo):
 *  - "Melhor odd" (padrão): cada seleção mostra a MELHOR odd entre as casas da
 *    instância (âmbar) + o selo da casa (logo) e as tags PA/turbinada.
 *  - "Por casa": cada seleção expande e mostra o preço de CADA casa da instância
 *    lado a lado; a melhor fica destacada em esmeralda.
 *
 * Acento lime (NoDelay), odds em âmbar, esmeralda p/ melhor/tags.
 */

// ============================ helpers de mercado ============================
// (mesma linguagem da página de comparação /events/event/[bookmaker]/[eventId])

const PA_HELP = 'Pagamento Antecipado (PA): a casa paga sua aposta como VENCEDORA se o time abrir a vantagem de gols definida por ela, mesmo que o placar mude depois.';
const BOOST_HELP = 'Odd turbinada (Super Placar/Super Odds): tem limite de stake / 1 por cliente.';

const TOKEN_PT: Record<string, string> = {
  home: 'Casa', draw: 'Empate', away: 'Fora',
  '1': 'Casa', x: 'Empate', '2': 'Fora',
  yes: 'Sim', no: 'Não',
  over: 'Mais', under: 'Menos',
  odd: 'Ímpar', even: 'Par',
};

const norm = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const realLine = (h: string | number | null | undefined): string => {
  const t = (h ?? '').toString().trim();
  return (t === '' || /^[+-]?0(\.0+)?$/.test(t)) ? '' : t;
};

// Rótulo legível de uma seleção (traduz tokens conhecidos; preserva nomes de time).
const selLabel = (sel: { selection: string; handicap: string }): string => {
  const line = realLine(sel.handicap);
  const parts = sel.selection.split('/').map((p) => p.trim());
  const allKnown = parts.length >= 1 && parts.length <= 2 && parts.every((p) => TOKEN_PT[p.toLowerCase()] !== undefined);
  if (allKnown) {
    return parts.map((p) => {
      const k = p.toLowerCase();
      const base = TOKEN_PT[k];
      return (k === 'over' || k === 'under') && line ? `${base} de ${line}` : base;
    }).join(' & ');
  }
  if (line && !sel.selection.includes(line)) return `${sel.selection} (${line})`;
  return sel.selection;
};

// Categorias derivadas do marketId (para as abas).
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'resultado', label: 'Resultado' },
  { key: 'gols', label: 'Gols' },
  { key: 'handicap', label: 'Handicap' },
  { key: 'combos', label: 'Combos' },
  { key: 'escanteios', label: 'Escanteios' },
  { key: 'cartoes', label: 'Cartões' },
  { key: 'chutes', label: 'Chutes' },
  { key: 'impedimentos', label: 'Impedimentos' },
];
const categoryOf = (marketId: string): string => {
  const slug = (marketId || '').split(':')[0];
  if (slug.includes('-and-') || slug.includes('result-and-btts')) return 'combos';
  if (slug.includes('card')) return 'cartoes';
  if (slug.includes('corner')) return 'escanteios';
  if (slug.includes('shot')) return 'chutes';
  if (slug.includes('offside')) return 'impedimentos';
  if (slug.includes('goal') || slug === 'both-teams-to-score' || slug.startsWith('btts')) return 'gols';
  if (slug.includes('asian-handicap')) return 'handicap';
  return 'resultado';
};

type ColKey = 'over' | 'under' | 'h1' | 'h2' | 'yes' | 'no' | 'dc1x' | 'dc12' | 'dcx2' | 'home' | 'draw' | 'away';

const lineOf = (sel: EventGroupSelection): string => {
  const h = (sel.handicap ?? '').toString().trim();
  if (h) return h;
  const m = sel.selection.match(/-?\d+(\.\d+)?/);
  return m ? m[0] : '';
};

const colOf = (sel: EventGroupSelection, ev: { home: string; away: string }): ColKey | null => {
  const t = norm(sel.selection);
  if (/\b(mais|over|acima|cima)\b/.test(t)) return 'over';
  if (/\b(menos|under|abaixo|baixo)\b/.test(t)) return 'under';
  if (/^h1\b|handicap 1/.test(t)) return 'h1';
  if (/^h2\b|handicap 2/.test(t)) return 'h2';
  if (/^hnb\b/.test(t)) return 'home';
  if (/^anb\b/.test(t)) return 'away';
  if (/^sim\b|^yes\b/.test(t)) return 'yes';
  if (/^nao\b|^no\b/.test(t)) return 'no';
  if (/1 ou empate|casa ou empate|home or draw|(^|\s)1x(\s|$)/.test(t)) return 'dc1x';
  if (/1 ou 2|casa ou fora|home or away|(^|\s)12(\s|$)/.test(t)) return 'dc12';
  if (/empate ou 2|empate ou fora|draw or away|(^|\s)x2(\s|$)/.test(t)) return 'dcx2';
  if (/\b(empate|draw)\b/.test(t)) return 'draw';
  const nh = norm(ev.home), na = norm(ev.away);
  if (/\b(casa|mandante|home)\b/.test(t) || (nh && t.includes(nh))) return 'home';
  if (/\b(fora|visitante|away)\b/.test(t) || (na && t.includes(na))) return 'away';
  return null;
};

interface MarketCol { key: ColKey; label: string }
interface MarketRow { label?: string; cells: (EventGroupSelection | null)[] }
interface MarketLayout { columns: MarketCol[]; rows: MarketRow[]; lined: boolean }

const buildLayout = (selections: EventGroupSelection[], ev: { home: string; away: string }): MarketLayout | null => {
  if (selections.some((s) => s.selection.includes('/'))) return null;
  const tagged = selections.map((s) => ({ s, col: colOf(s, ev) }));
  const present = new Set(tagged.map((x) => x.col).filter(Boolean) as ColKey[]);
  const pick = (col: ColKey, line?: string) =>
    tagged.find((x) => x.col === col && (line === undefined || lineOf(x.s) === line))?.s || null;
  const linesFor = (cols: ColKey[]): string[] => {
    const set = new Set<string>();
    tagged.forEach((x) => { if (x.col && cols.includes(x.col)) set.add(lineOf(x.s)); });
    return Array.from(set).sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
  };
  if (present.has('over') || present.has('under')) {
    return {
      columns: [{ key: 'over', label: 'Mais' }, { key: 'under', label: 'Menos' }],
      rows: linesFor(['over', 'under']).map((ln) => ({ label: ln, cells: [pick('over', ln), pick('under', ln)] })),
      lined: true,
    };
  }
  if (present.has('h1') || present.has('h2')) {
    return {
      columns: [{ key: 'h1', label: 'H1' }, { key: 'h2', label: 'H2' }],
      rows: linesFor(['h1', 'h2']).map((ln) => ({ label: ln, cells: [pick('h1', ln), pick('h2', ln)] })),
      lined: true,
    };
  }
  if (present.has('yes') || present.has('no')) {
    return { columns: [{ key: 'yes', label: 'Sim' }, { key: 'no', label: 'Não' }], rows: [{ cells: [pick('yes'), pick('no')] }], lined: false };
  }
  if (present.has('dc1x') || present.has('dc12') || present.has('dcx2')) {
    return {
      columns: [{ key: 'dc1x', label: '1X' }, { key: 'dc12', label: '12' }, { key: 'dcx2', label: 'X2' }],
      rows: [{ cells: [pick('dc1x'), pick('dc12'), pick('dcx2')] }], lined: false,
    };
  }
  if (present.has('home') || present.has('away') || present.has('draw')) {
    return {
      columns: [{ key: 'home', label: ev.home || 'Casa' }, { key: 'draw', label: 'Empate' }, { key: 'away', label: ev.away || 'Fora' }],
      rows: [{ cells: [pick('home'), pick('draw'), pick('away')] }], lined: false,
    };
  }
  return null;
};

// ============================ componente ============================

type DisplayMode = 'best' | 'byhouse';

/** Seleção tocada no board de pré-jogo → o cupom (preview) é montado a partir disso. */
export interface PrematchPick {
  home: string;
  away: string;
  marketId: string;
  marketName: string;
  selectionLabel: string;
  /** Odd de cada casa da instância (a melhor primeiro) + o eventId e os dados
   * apostáveis (placeable) DAQUELA casa — o betslip usa p/ apostar em pré-jogo. */
  prices: { bookmaker: string; price: number; eventId: string; placeable: EventGroupPrice['placeable'] }[];
}

interface Props {
  bookmaker: string;
  eventId: string;
  /** Casas da instância — filtra as odds exibidas (Contas prontas). */
  houseSlugs: string[];
  /** Abrir OUTRO jogo (menu ≡ do mesmo campeonato). A página injeta a navegação. */
  onOpenEvent?: (bookmaker: string, eventId: string) => void;
  /** Tocar numa odd abre o cupom (preview no pré-jogo). */
  onPick?: (pick: PrematchPick) => void;
  /** Voltar (o ← do hero). */
  onBack?: () => void;
}

export function PrematchBoard({ bookmaker, eventId, houseSlugs, onOpenEvent, onPick, onBack }: Props) {
  const { detail, loading, error } = usePrematchEventGroup(bookmaker, eventId, houseSlugs);
  const [mode, setMode] = useState<DisplayMode>('best');
  const [category, setCategory] = useState('all');

  // Ordem das casas p/ o modo "Por casa" (mesma ordem do grupo).
  const orderedSlugs = useMemo(() => (detail ? detail.houses.map((h) => h.bookmaker) : []), [detail]);

  // Abas (categorias) presentes neste evento.
  const categories = useMemo(() => {
    if (!detail) return [{ key: 'all', label: 'Todos' }];
    const present = new Set(detail.markets.map((m) => categoryOf(m.marketId)));
    return [{ key: 'all', label: 'Todos' }, ...CATEGORIES.filter((c) => present.has(c.key))];
  }, [detail]);

  const markets = useMemo(() => {
    if (!detail) return [];
    if (category === 'all') return detail.markets;
    return detail.markets.filter((m) => categoryOf(m.marketId) === category);
  }, [detail, category]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <Loader2 className="animate-spin" size={18} /> Carregando evento…
        </div>
      ) : error ? (
        <div className="p-6">
          {onBack && (
            <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-lime-300">
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        </div>
      ) : !detail ? (
        <div className="p-8 text-center text-sm text-gray-500">Evento não encontrado.</div>
      ) : (
        <>
          <PrematchHero detail={detail} houseSlugs={houseSlugs} onOpenEvent={onOpenEvent} onBack={onBack} />

          {/* Alternador de exibição: Melhor odd | Por casa */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
            <div className="inline-flex rounded-lg bg-black/30 p-0.5 ring-1 ring-white/10">
              <ToggleBtn on={mode === 'best'} onClick={() => setMode('best')} icon={<Star size={13} />}>Melhor odd</ToggleBtn>
              <ToggleBtn on={mode === 'byhouse'} onClick={() => setMode('byhouse')} icon={<Layers size={13} />}>Por casa</ToggleBtn>
            </div>
            <span className="hidden text-[11px] text-gray-500 sm:block">
              {detail.houses.length} casa{detail.houses.length === 1 ? '' : 's'} da instância
            </span>
          </div>

          {/* Abas de categoria (quando há mais de uma) */}
          {categories.length > 2 && (
            <div className="border-b border-white/10 bg-black/10 -mx-0 overflow-x-auto px-2 py-2">
              <div className="flex w-max gap-1">
                {categories.map((c) => {
                  const on = c.key === category;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        on ? 'bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/40' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {markets.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Nenhum mercado das casas da instância neste evento.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {markets.map((m) => (
                <MarketView
                  key={m.marketId}
                  marketId={m.marketId}
                  marketName={m.marketName || m.marketId}
                  selections={m.selections}
                  ev={detail.event}
                  mode={mode}
                  orderedSlugs={orderedSlugs}
                  onPick={onPick}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToggleBtn({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        on ? 'bg-lime-500 text-slate-900' : 'text-gray-300 hover:text-white'
      }`}
    >
      {icon} {children}
    </button>
  );
}

// -------------------------------- Hero --------------------------------

function PrematchHero({
  detail, houseSlugs, onOpenEvent, onBack,
}: {
  detail: NonNullable<ReturnType<typeof usePrematchEventGroup>['detail']>;
  houseSlugs: string[];
  onOpenEvent?: (bookmaker: string, eventId: string) => void;
  onBack?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ev = detail.event;
  const competition = ev.league || 'Pré-jogo';
  const kickoff = formatEventDateTime(ev.eventDate) || '—';

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -10%, rgba(101,163,13,0.18), transparent 55%), radial-gradient(80% 120% at 50% 120%, rgba(16,185,129,0.10), transparent 60%), linear-gradient(180deg, #0b1220 0%, #0a0f1a 100%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
      <div className="relative px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-gray-300 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-white"
            title="Voltar"
          >
            <ArrowLeft size={15} />
          </button>
          <span className="truncate px-2 text-xs font-medium text-gray-300">{competition}</span>
          <span className="h-7 w-7" />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamCol name={ev.home} sofaId={ev.homeSofaId} align="right" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-white">{kickoff}</span>
            <span className="text-[10px] uppercase tracking-wide text-lime-300/80">Pré-jogo</span>
            <button
              onClick={() => setMenuOpen(true)}
              className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-gray-300 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-white"
              title="Outros jogos do campeonato"
            >
              <Menu size={13} />
            </button>
          </div>
          <TeamCol name={ev.away} sofaId={ev.awaySofaId} align="left" />
        </div>
      </div>

      {menuOpen && (
        <CompetitionFixturesModal
          competition={competition}
          houseSlugs={houseSlugs}
          currentHome={ev.home}
          currentAway={ev.away}
          onClose={() => setMenuOpen(false)}
          onOpenEvent={(bm, id) => { setMenuOpen(false); onOpenEvent?.(bm, id); }}
        />
      )}
    </div>
  );
}

function TeamCol({ name, sofaId, align }: { name: string; sofaId?: string | number | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 ${align === 'right' ? 'sm:items-end' : 'sm:items-start'}`}>
      <TeamLogo name={name} sofascoreId={sofaId} size={38} />
      <span className="truncate text-center text-sm font-bold text-white sm:text-base">{name}</span>
    </div>
  );
}

// pt-BR: "19:30" (verbatim UTC — kickoff é wallclock BRT tagueado Z).
const fmtTimeUTC = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '—';

/**
 * Menu ≡: OUTROS jogos do MESMO campeonato (mesmas casas da instância). Reusa
 * usePrematchGroupedGames buscando pela liga e filtra por competição.
 */
function CompetitionFixturesModal({
  competition, houseSlugs, currentHome, currentAway, onClose, onOpenEvent,
}: {
  competition: string;
  houseSlugs: string[];
  currentHome: string;
  currentAway: string;
  onClose: () => void;
  onOpenEvent: (bookmaker: string, eventId: string) => void;
}) {
  const { games, loading } = usePrematchGroupedGames(houseSlugs, { search: competition });
  const list = useMemo(
    () => games
      .filter((g) => g.competition === competition && !(g.home === currentHome && g.away === currentAway))
      .sort((a, b) => ((a.kickoff || '') < (b.kickoff || '') ? -1 : 1)),
    [games, competition, currentHome, currentAway],
  );

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-500/20 shadow-2xl"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgba(16,185,129,0.14), transparent 60%), #0a0f1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-gray-300 ring-1 ring-white/10 transition hover:text-white">
            <ArrowLeft size={15} />
          </button>
          <span className="truncate px-2 text-sm font-bold text-white">{competition}</span>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Nenhum outro jogo deste campeonato.</p>
        ) : (
          <ul className="max-h-[70vh] overflow-y-auto">
            {list.map((m) => (
              <li key={m.key}>
                <button
                  onClick={() => onOpenEvent(m.bookmaker, m.eventId)}
                  className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                    <span className="truncate text-sm font-semibold text-white">{m.home}</span>
                    <TeamLogo name={m.home} size={26} />
                  </div>
                  <span className="shrink-0 rounded bg-black/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-300">{fmtTimeUTC(m.kickoff)}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamLogo name={m.away} size={26} />
                    <span className="truncate text-sm font-semibold text-white">{m.away}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// -------------------------------- Mercado --------------------------------

function MarketView({
  marketId, marketName, selections, ev, mode, orderedSlugs, onPick,
}: {
  marketId: string;
  marketName: string;
  selections: EventGroupSelection[];
  ev: { home: string; away: string };
  mode: DisplayMode;
  orderedSlugs: string[];
  onPick?: (pick: PrematchPick) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const layout = buildLayout(selections, ev);

  const pickOf = onPick
    ? (sel: EventGroupSelection) => () => onPick({
        home: ev.home,
        away: ev.away,
        marketId,
        marketName,
        selectionLabel: selLabel(sel),
        prices: sel.prices.map((p) => ({ bookmaker: p.bookmaker, price: p.price, eventId: p.eventId, placeable: p.placeable ?? null })),
      })
    : undefined;

  return (
    <div>
      <button onClick={() => setCollapsed((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="truncate text-sm font-semibold text-white">{marketName}</span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{selections.length}</span>
          <ChevronDown size={16} className={`shrink-0 text-gray-500 transition ${collapsed ? '-rotate-90' : ''}`} />
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          {layout ? (
            <div>
              {/* Cabeçalho de colunas */}
              <div
                className="mb-1.5 grid gap-1.5 px-1 text-[11px] uppercase tracking-wide text-gray-500"
                style={{ gridTemplateColumns: `${layout.lined ? '44px ' : ''}repeat(${layout.columns.length}, minmax(0,1fr))` }}
              >
                {layout.lined && <span />}
                {layout.columns.map((c) => <span key={c.key} className="truncate text-center">{c.label}</span>)}
              </div>
              <div className="space-y-1.5">
                {layout.rows.map((row, ri) => (
                  <div
                    key={ri}
                    className="grid items-start gap-1.5"
                    style={{ gridTemplateColumns: `${layout.lined ? '44px ' : ''}repeat(${layout.columns.length}, minmax(0,1fr))` }}
                  >
                    {layout.lined && <span className="pt-2 text-center text-xs tabular-nums text-gray-400">{row.label}</span>}
                    {row.cells.map((cell, ci) => (
                      <SelCell key={ci} sel={cell} mode={mode} orderedSlugs={orderedSlugs} onPickSel={cell && pickOf ? pickOf(cell) : undefined} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Fallback: lista (mercados não reconhecidos / combos).
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {selections.map((s, si) => (
                <div key={si} className="rounded-lg bg-black/25 px-2.5 py-2 ring-1 ring-white/10">
                  <Tooltip label={selLabel(s)} className="block"><div className="mb-1 truncate text-[11px] text-gray-300">{selLabel(s)}</div></Tooltip>
                  <SelCell sel={s} mode={mode} orderedSlugs={orderedSlugs} bare onPickSel={pickOf ? pickOf(s) : undefined} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Célula de uma seleção. TODO(place): estruturada p/ receber o disparo (onPick)
 * quando o pré-jogo for apostável — hoje é só exibição (o catálogo não tem os ids
 * apostáveis).
 *  - mode "best": mostra a MELHOR odd (prices[0]) em âmbar + selo da casa + tags.
 *  - mode "byhouse": mostra o preço de CADA casa da instância; a melhor em esmeralda.
 * `bare` = sem fundo/anel próprios (usado no fallback de lista, que já tem card).
 */
function SelCell({
  sel, mode, orderedSlugs, bare, onPickSel,
}: {
  sel: EventGroupSelection | null;
  mode: DisplayMode;
  orderedSlugs: string[];
  bare?: boolean;
  onPickSel?: () => void;
}) {
  const { getBookmaker } = useBookmakers();
  // Clicável quando dá pra montar o cupom (preview no pré-jogo).
  const click = onPickSel ? { onClick: onPickSel, role: 'button' as const, tabIndex: 0 } : {};
  const clickCls = onPickSel ? 'cursor-pointer transition hover:ring-lime-500/40' : '';

  if (!sel || sel.prices.length === 0) {
    return <div className={`grid place-items-center px-2 py-2 text-center text-xs text-gray-600 ${bare ? '' : 'rounded-lg bg-black/20 ring-1 ring-white/5'}`}>—</div>;
  }

  const best = sel.prices[0];

  if (mode === 'best') {
    const b = getBookmaker(best.bookmaker);
    return (
      <div {...click} className={`relative flex items-center justify-between gap-1.5 px-2 py-1.5 ${bare ? '' : 'rounded-lg bg-black/25 ring-1 ring-white/10'} ${clickCls}`}>
        <Tooltip label={b?.name || best.bookmaker}>
          <span className="flex items-center gap-1">
            <BookmakerLogo name={b?.name || best.bookmaker} slug={best.bookmaker} logoUrl={b?.logoUrl} color={b?.color} size={16} />
            <PriceTags p={best} />
          </span>
        </Tooltip>
        <span className="text-sm font-bold tabular-nums text-amber-400">{fmtOdd(best.price)}</span>
      </div>
    );
  }

  // Por casa: uma linha por casa da instância (na ordem do grupo), melhor em esmeralda.
  const rows = orderedSlugs
    .map((slug) => ({ slug, p: sel.prices.find((x) => x.bookmaker === slug) || null }))
    .filter((r) => r.p);
  return (
    <div {...click} className={`space-y-1 ${bare ? '' : 'rounded-lg bg-black/25 p-1 ring-1 ring-white/10'} ${clickCls}`}>
      {rows.map(({ slug, p }) => {
        const isBest = p!.bookmaker === best.bookmaker && p!.price === best.price;
        const b = getBookmaker(slug);
        return (
          <div
            key={slug}
            className={`flex items-center justify-between gap-1.5 rounded px-1.5 py-1 ${
              isBest ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : 'bg-black/20'
            }`}
          >
            <Tooltip label={b?.name || slug}>
              <span className="flex items-center gap-1">
                <BookmakerLogo name={b?.name || slug} slug={slug} logoUrl={b?.logoUrl} color={b?.color} size={14} />
                <PriceTags p={p!} />
              </span>
            </Tooltip>
            <span className={`text-xs font-bold tabular-nums ${isBest ? 'text-emerald-300' : 'text-amber-400/90'}`}>{fmtOdd(p!.price)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Tags PA (Pagamento Antecipado) / turbinada de um preço. */
function PriceTags({ p }: { p: EventGroupPrice }) {
  return (
    <>
      {p.pa && (
        <span title={PA_HELP} className="rounded-sm bg-sky-500/20 px-1 text-[8px] font-bold leading-tight text-sky-300 ring-1 ring-sky-400/40">PA</span>
      )}
      {p.boosted && (
        <span title={BOOST_HELP} className="inline-flex"><Zap size={11} className="text-amber-400 fill-amber-400/40" /></span>
      )}
    </>
  );
}
