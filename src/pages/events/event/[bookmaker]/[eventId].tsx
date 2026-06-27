import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft, Calendar, MapPin, Search, Loader2, BarChart3, Trophy, X, TrendingUp, TrendingDown, Star, Zap
} from 'lucide-react';
import { apiGateway, EventGroupDetail, EventGroupSelection } from '@/gateways/api.gateway';
import { Select } from '@/components/ui/Select';
import { BookmakerTag, BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { EventHousesPanel } from '@/components/event/EventHousesPanel';
import { useBookmakers } from '@/hooks/useBookmakers';

interface HistoryRow {
  id: string;
  bookmaker: string;
  marketId: string;
  marketName: string | null;
  selection: string;
  handicap: string;
  price: number;
  recordedAt: string;
}

const formatDate = (s: string | null): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};
const formatTime = (s: string): string => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};

// Pagamento Antecipado (PA): promo em que a casa paga a aposta como vencedora se
// o time abrir a vantagem de gols definida por ela, mesmo que o placar mude.
const PA_HELP = 'Pagamento Antecipado (PA): a casa paga sua aposta como VENCEDORA se o seu time abrir a vantagem de gols definida por ela (ex.: 2 gols à frente), mesmo que o adversário empate ou vire o jogo depois. A linha de gols e as regras variam por casa.';
const PaBadge = ({ className = '' }: { className?: string }) => (
  <span
    title={PA_HELP}
    className={`inline-flex items-center rounded-sm bg-sky-500/20 px-1 text-[8px] font-bold leading-tight text-sky-300 ring-1 ring-sky-400/40 cursor-help ${className}`}
  >
    PA
  </span>
);

// Liquidez (size) de odd de exchange (ex.: betbra) → R$ compacto. null/0 = oculto.
const fmtSize = (size?: number | null): string | null => {
  if (size == null || !Number.isFinite(size) || size <= 0) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1
  }).format(size);
};
const SIZE_HELP = 'Liquidez disponível nesta odd na exchange (quanto dá para casar nesse preço). Acima disso, a odd piora.';

// Tradução de seleções "cruas" em inglês (sobretudo combos: home/yes, no/over...).
// 1 = Casa, x = Empate, 2 = Fora; yes/no = Sim/Não (ambas marcam); over/under = Mais/Menos.
const TOKEN_PT: Record<string, string> = {
  home: 'Casa', draw: 'Empate', away: 'Fora',
  '1': 'Casa', x: 'Empate', '2': 'Fora',
  yes: 'Sim', no: 'Não',
  over: 'Mais', under: 'Menos',
  odd: 'Ímpar', even: 'Par'
};

// Linha de handicap "real" — ignora 0/-0/vazio (que não é uma linha, é só ruído ex.: "(0)").
const realLine = (h: string | number | null | undefined): string => {
  const t = (h ?? '').toString().trim();
  return (t === '' || /^[+-]?0(\.0+)?$/.test(t)) ? '' : t;
};

// Rótulo legível de uma seleção. Traduz tokens conhecidos (incl. combos via "/"),
// mas NUNCA mexe em nome de time (ex.: "FK Bodo/Glimt ou Empate") — só traduz
// quando TODOS os tokens são reconhecidos. Anexa a linha (2.5) ao over/under.
const selLabel = (sel: { selection: string; handicap: string }): string => {
  const line = realLine(sel.handicap);
  const parts = sel.selection.split('/').map((p) => p.trim());
  const allKnown = parts.length >= 1 && parts.length <= 2 && parts.every((p) => TOKEN_PT[p.toLowerCase()] !== undefined);

  if (allKnown) {
    const labels = parts.map((p) => {
      const k = p.toLowerCase();
      const base = TOKEN_PT[k];
      return (k === 'over' || k === 'under') && line ? `${base} de ${line}` : base;
    });
    return labels.join(' & ');
  }

  // Não reconhecido (nome de time, etc.): mantém original, só anexa linha real.
  if (line && !sel.selection.includes(line)) return `${sel.selection} (${line})`;
  return sel.selection;
};

// Categorias derivadas do marketId (sem depender de campo no arbbetting).
const CATEGORIES: { key: string; label: string }[] = [
  { key: 'resultado', label: 'Resultado' },
  { key: 'gols', label: 'Gols' },
  { key: 'handicap', label: 'Handicap' },
  { key: 'combos', label: 'Combos' },
  { key: 'escanteios', label: 'Escanteios' },
  { key: 'cartoes', label: 'Cartões' },
  { key: 'chutes', label: 'Chutes' },
  { key: 'impedimentos', label: 'Impedimentos' }
];
const categoryOf = (marketId: string): string => {
  const slug = (marketId || '').split(':')[0];
  // Combos (mercados combinados): "Resultado & Ambas", "Ambas & Total de Gols", "DNB & Gols"...
  // Tem que vir ANTES de gols/cartões senão "btts-and-total-goals" cairia em "gols".
  if (slug.includes('-and-') || slug.includes('result-and-btts')) return 'combos';
  if (slug.includes('card')) return 'cartoes';
  if (slug.includes('corner')) return 'escanteios';
  if (slug.includes('shot')) return 'chutes';
  if (slug.includes('offside')) return 'impedimentos';
  if (slug.includes('goal') || slug === 'both-teams-to-score' || slug.startsWith('btts')) return 'gols';
  if (slug.includes('asian-handicap')) return 'handicap';
  return 'resultado'; // match-winner, double-chance, draw-no-bet, european-handicap, to-qualify
};

// ---------------------------------------------------------------------------
// Organização dos mercados no estilo casa de aposta.
// Classifica cada seleção em uma "coluna" (over/under, h1/h2, sim/não, 1/x/2)
// e monta colunas/linhas. Mercados não reconhecidos caem num layout de lista.
// ---------------------------------------------------------------------------
const norm = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const lineOf = (sel: EventGroupSelection): string => {
  const h = (sel.handicap ?? '').toString().trim();
  if (h) return h;
  const m = sel.selection.match(/-?\d+(\.\d+)?/);
  return m ? m[0] : '';
};

type ColKey = 'over' | 'under' | 'h1' | 'h2' | 'yes' | 'no' | 'dc1x' | 'dc12' | 'dcx2' | 'home' | 'draw' | 'away';

const colOf = (sel: EventGroupSelection, ev: { home: string; away: string }): ColKey | null => {
  const t = norm(sel.selection);
  if (/\b(mais|over|acima|cima)\b/.test(t)) return 'over';
  if (/\b(menos|under|abaixo|baixo)\b/.test(t)) return 'under';
  if (/^h1\b|handicap 1/.test(t)) return 'h1';
  if (/^h2\b|handicap 2/.test(t)) return 'h2';
  if (/^hnb\b/.test(t)) return 'home'; // Empate anula: Home No Bet
  if (/^anb\b/.test(t)) return 'away'; // Empate anula: Away No Bet
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

// Monta o layout do mercado a partir das suas seleções. Retorna null = usar lista.
const buildLayout = (
  selections: EventGroupSelection[],
  ev: { home: string; away: string }
): MarketLayout | null => {
  // Seleções compostas (combos: "home/yes", HT/FT: "home/draw") não cabem nas
  // colunas simples (1X2, O/U...) — caem na lista, que mostra cada via inteira.
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

  // Over/Under por linha
  if (present.has('over') || present.has('under')) {
    const cols: MarketCol[] = [{ key: 'over', label: 'Mais' }, { key: 'under', label: 'Menos' }];
    const rows = linesFor(['over', 'under']).map((ln) => ({ label: ln, cells: [pick('over', ln), pick('under', ln)] }));
    return { columns: cols, rows, lined: true };
  }
  // Handicap H1/H2 por linha
  if (present.has('h1') || present.has('h2')) {
    const cols: MarketCol[] = [{ key: 'h1', label: 'H1' }, { key: 'h2', label: 'H2' }];
    const rows = linesFor(['h1', 'h2']).map((ln) => ({ label: ln, cells: [pick('h1', ln), pick('h2', ln)] }));
    return { columns: cols, rows, lined: true };
  }
  // Sim/Não
  if (present.has('yes') || present.has('no')) {
    return { columns: [{ key: 'yes', label: 'Sim' }, { key: 'no', label: 'Não' }], rows: [{ cells: [pick('yes'), pick('no')] }], lined: false };
  }
  // Dupla chance
  if (present.has('dc1x') || present.has('dc12') || present.has('dcx2')) {
    return {
      columns: [{ key: 'dc1x', label: '1X' }, { key: 'dc12', label: '12' }, { key: 'dcx2', label: 'X2' }],
      rows: [{ cells: [pick('dc1x'), pick('dc12'), pick('dcx2')] }], lined: false
    };
  }
  // 1X2
  if (present.has('home') || present.has('away') || present.has('draw')) {
    return {
      columns: [{ key: 'home', label: ev.home || 'Casa' }, { key: 'draw', label: 'Empate' }, { key: 'away', label: ev.away || 'Fora' }],
      rows: [{ cells: [pick('home'), pick('draw'), pick('away')] }], lined: false
    };
  }
  return null;
};

// Gráfico detalhado do histórico de odd (linha em degraus = movimento real da odd,
// área, grade com valores, e crosshair com tooltip no hover).
interface ChartPoint { t: number; price: number }
const PriceChart = ({ points }: { points: ChartPoint[] }) => {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) return null;

  const W = 640, H = 240, padL = 44, padR = 14, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const prices = points.map((p) => p.price);
  let min = Math.min(...prices), max = Math.max(...prices);
  if (min === max) { min -= 0.1; max += 0.1; } // ponto único / sem variação
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;
  const span = max - min || 1;

  const xAt = (i: number) => points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW;
  const yAt = (p: number) => padT + (1 - (p - min) / span) * innerH;

  const up = prices[prices.length - 1] >= prices[0];
  const stroke = up ? '#34d399' : '#fb7185';
  const fill = up ? 'rgba(52,211,153,0.14)' : 'rgba(251,113,133,0.14)';

  // Curva suave (Catmull-Rom → Bézier) passando pelos pontos.
  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.price) }));
  let line = coords.length ? `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}` : '';
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i], p1 = coords[i], p2 = coords[i + 1], p3 = coords[i + 2] || coords[i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const area = points.length > 1 ? `${line} L ${xAt(points.length - 1)} ${H - padB} L ${xAt(0)} ${H - padB} Z` : '';

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: padT + f * innerH, val: max - f * span }));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!el || points.length < 2) return;
    const r = el.getBoundingClientRect();
    const relX = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((relX - padL) / innerW) * (points.length - 1));
    setHover(Math.min(Math.max(i, 0), points.length - 1));
  };

  const hp = hover != null ? points[hover] : null;
  const fmtT = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="odd-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      {/* grade + eixo Y */}
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize="10" fill="#6b7280">{g.val.toFixed(2)}</text>
        </g>
      ))}
      {area && <path d={area} fill="url(#odd-area)" />}
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* pontos */}
      {points.map((p, i) => <circle key={i} cx={xAt(i)} cy={yAt(p.price)} r={hover === i ? 4 : 2.5} fill={stroke} />)}
      {/* eixo X: primeiro/último */}
      <text x={padL} y={H - 8} textAnchor="start" fontSize="10" fill="#6b7280">{fmtT(points[0].t)}</text>
      {points.length > 1 && <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="#6b7280">{fmtT(points[points.length - 1].t)}</text>}
      {/* crosshair + tooltip */}
      {hp && (
        <g>
          <line x1={xAt(hover!)} y1={padT} x2={xAt(hover!)} y2={H - padB} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={xAt(hover!)} cy={yAt(hp.price)} r={4.5} fill={stroke} stroke="#0b1220" strokeWidth={1.5} />
          {(() => {
            const bx = Math.min(Math.max(xAt(hover!) - 56, padL), W - padR - 112);
            return (
              <g transform={`translate(${bx}, ${padT})`}>
                <rect width="112" height="34" rx="6" fill="#0b1220" stroke="rgba(255,255,255,0.12)" />
                <text x="8" y="14" fontSize="11" fontWeight="700" fill="#e5e7eb">{hp.price.toFixed(2)}</text>
                <text x="8" y="27" fontSize="9" fill="#9ca3af">{fmtT(hp.t)}</text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
};

export default function EventDetailPage() {
  const router = useRouter();
  const { bookmaker, eventId } = router.query as { bookmaker?: string; eventId?: string };

  const [detail, setDetail] = useState<EventGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Casa selecionada: '' = melhor odd (varia por seleção).
  const [houseFilter, setHouseFilter] = useState('');
  // Categoria de mercados selecionada ('all' = todos).
  const [category, setCategory] = useState('all');

  // Modal de histórico de uma odd específica.
  const [hist, setHist] = useState<{ bookmaker: string; eventId: string; marketId: string; marketName: string | null; selection: string; size?: number | null } | null>(null);
  const [histRows, setHistRows] = useState<HistoryRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!bookmaker || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGateway.getEventGroup(bookmaker, eventId);
      if (res.data?.result === 1) setDetail(res.data.data);
      else setError(res.data?.message || 'Evento não encontrado.');
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string } } })?.response;
      setError(resp?.data?.message || (e instanceof Error ? e.message : 'Erro ao carregar evento.'));
    } finally {
      setLoading(false);
    }
  }, [bookmaker, eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail();
  }, [fetchDetail]);

  const openHistory = async (h: { bookmaker: string; eventId: string; marketId: string; marketName: string | null; selection: string; size?: number | null }) => {
    setHist(h);
    setHistRows([]);
    setHistLoading(true);
    try {
      const res = await apiGateway.getExternalEventHistory(h.bookmaker, h.eventId, { marketId: h.marketId, selection: h.selection, limit: 100 });
      if (res.data?.result === 1) setHistRows(res.data.data || []);
    } catch {
      // silencioso
    } finally {
      setHistLoading(false);
    }
  };

  // Categorias presentes neste evento (na ordem do catálogo) — "Todos" + as que existem.
  const availableCategories = useMemo(() => {
    if (!detail) return [{ key: 'all', label: 'Todos' }];
    const present = new Set(detail.markets.map((m) => categoryOf(m.marketId)));
    return [{ key: 'all', label: 'Todos' }, ...CATEGORIES.filter((c) => present.has(c.key))];
  }, [detail]);

  // Mercados filtrados por categoria + busca.
  const markets = useMemo(() => {
    if (!detail) return [];
    const q = query.trim().toLowerCase();
    let list = detail.markets;
    if (category !== 'all') list = list.filter((m) => categoryOf(m.marketId) === category);
    if (!q) return list;
    return list
      .map((m) => ({
        ...m,
        selections: m.selections.filter(
          (s) => (m.marketName || m.marketId).toLowerCase().includes(q) || s.selection.toLowerCase().includes(q)
        )
      }))
      .filter((m) => (m.marketName || m.marketId).toLowerCase().includes(q) || m.selections.length > 0);
  }, [detail, query, category]);

  // Casas disponíveis no grupo (para o seletor de casa).
  const houseOptions = useMemo(() => (detail ? detail.houses.map((h) => h.bookmaker) : []), [detail]);

  // Opções do seletor de casa com ícone + nome na cor da casa.
  const { bookmakers, getBookmaker } = useBookmakers();
  const houseSelectOptions = useMemo(() => [
    { value: '', label: 'Melhor odd', icon: <Star size={16} className="text-amber-300 fill-amber-300" /> },
    ...houseOptions.map((slug) => {
      const b = getBookmaker(slug);
      return {
        value: slug,
        label: b?.name || slug,
        color: b?.color || undefined,
        icon: <BookmakerLogo name={b?.name || slug} slug={slug} logoUrl={b?.logoUrl} color={b?.color} size={16} />
      };
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [houseOptions, bookmakers]);

  // Escolhe o preço de uma seleção conforme a casa selecionada ('' = melhor odd).
  const priceFor = (sel: EventGroupSelection | null) => {
    if (!sel || sel.prices.length === 0) return null;
    if (!houseFilter) return sel.prices[0]; // já vem ordenado (melhor primeiro)
    return sel.prices.find((p) => p.bookmaker === houseFilter) || null;
  };

  // Histórico ordenado cronologicamente (asc) para a sparkline.
  const histAsc = useMemo(() => [...histRows].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()), [histRows]);
  const histDelta = histAsc.length >= 2 ? histAsc[histAsc.length - 1].price - histAsc[0].price : 0;

  // Célula de odd (preço + casa). Clique abre o histórico.
  const OddCell = ({ sel, marketId, marketName }: { sel: EventGroupSelection | null; marketId: string; marketName: string | null }) => {
    const p = priceFor(sel);
    if (!sel || !p) {
      return <div className="rounded-lg bg-black/20 px-2 py-2 text-center text-xs text-gray-600">—</div>;
    }
    const boosted = !!p.boosted;
    const pa = !!p.pa;
    const size = fmtSize(p.size);
    return (
      <button
        onClick={() => openHistory({ bookmaker: p.bookmaker, eventId: p.eventId, marketId, marketName, selection: sel.selection, size: p.size })}
        title={`${p.bookmaker}${boosted ? ' — odd turbinada (Super Placar/Super Odds): limite de stake' : ''}${pa ? ` — ${PA_HELP}` : ''}${size ? ` — ${SIZE_HELP}` : ''} — ver histórico de movimentação`}
        className={`group relative flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition ring-1 ${
          boosted
            ? 'bg-amber-500/10 ring-amber-400/50 hover:bg-amber-500/20'
            : 'bg-black/30 ring-white/10 hover:bg-teal-500/10 hover:ring-teal-500/40'
        }`}
      >
        {pa && <PaBadge className="absolute top-1 left-1" />}
        {boosted && <Zap size={11} className="absolute top-1 right-1 text-amber-400 fill-amber-400/40" />}
        <span className={`text-sm font-bold tabular-nums ${boosted ? 'text-amber-300' : 'text-teal-300'}`}>{Number(p.price).toFixed(2)}</span>
        {!houseFilter && <span className={`text-[9px] uppercase tracking-wide ${boosted ? 'text-amber-200/70' : 'text-gray-500 group-hover:text-teal-200/70'}`}>{p.bookmaker}</span>}
        {size && <span className="text-[9px] font-semibold tabular-nums text-emerald-400/80 leading-none mt-0.5">{size}</span>}
      </button>
    );
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <button
        onClick={() => router.push('/events')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-300 transition"
      >
        <ArrowLeft size={16} /> Voltar aos eventos
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={20} /> Carregando evento...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">{error}</div>
      ) : detail ? (
        <>
          {/* Cabeçalho do evento (canônico) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 sm:p-6 mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] text-gray-400">
              <span className="inline-flex items-center gap-1"><Calendar size={12} className="text-teal-400/70" /> {formatDate(detail.event.eventDate)}</span>
              {detail.event.country && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {detail.event.country}</span>}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words">
              {detail.event.home} <span className="text-gray-500 font-normal text-base">vs</span> {detail.event.away}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{detail.event.league || '—'}</p>

            {/* Casas do grupo — preview clicável que abre o modal de casas */}
            <EventHousesPanel
              houses={detail.houses}
              marketCount={detail.markets.length}
              eventLabel={`${detail.event.home} vs ${detail.event.away}`}
            />
          </div>

          {/* Controles: busca + seletor de casa */}
          {detail.markets.length > 0 && (
            <div className="mb-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar mercado ou seleção..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition"
                />
              </div>
              <Select
                value={houseFilter}
                onChange={setHouseFilter}
                className="sm:w-52"
                title="Casa de aposta exibida nas odds"
                options={houseSelectOptions}
              />
            </div>
          )}

          {/* Categorias de mercados (estilo casa de aposta) */}
          {detail.markets.length > 0 && availableCategories.length > 2 && (
            <div className="mb-4 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
              {availableCategories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    category === c.key
                      ? 'bg-teal-500 text-slate-900'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Mercados organizados (estilo casa de aposta) */}
          {detail.markets.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center">
              <BarChart3 className="mx-auto text-gray-600 mb-3" size={32} />
              <p className="text-gray-400">Sem odds registradas para este evento.</p>
            </div>
          ) : markets.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-gray-400">Nenhum mercado para “{query}”.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {markets.map((m) => {
                const layout = buildLayout(m.selections, detail.event);
                return (
                  <div key={m.marketId} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-200 truncate">{m.marketName || m.marketId}</span>
                      <span className="text-[11px] text-gray-500 shrink-0">{m.selections.length}</span>
                    </div>

                    {layout ? (
                      <div className="p-3">
                        {/* Cabeçalho de colunas */}
                        <div
                          className="grid gap-2 mb-1.5 text-[11px] uppercase tracking-wide text-gray-500"
                          style={{ gridTemplateColumns: `${layout.lined ? '44px ' : ''}repeat(${layout.columns.length}, minmax(0,1fr))` }}
                        >
                          {layout.lined && <span />}
                          {layout.columns.map((c) => <span key={c.key} className="text-center truncate">{c.label}</span>)}
                        </div>
                        {/* Linhas */}
                        <div className="space-y-1.5">
                          {layout.rows.map((row, ri) => (
                            <div
                              key={ri}
                              className="grid gap-2 items-center"
                              style={{ gridTemplateColumns: `${layout.lined ? '44px ' : ''}repeat(${layout.columns.length}, minmax(0,1fr))` }}
                            >
                              {layout.lined && <span className="text-xs text-gray-400 tabular-nums text-center">{row.label}</span>}
                              {row.cells.map((cell, ci) => (
                                <OddCell key={ci} sel={cell} marketId={m.marketId} marketName={m.marketName} />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      // Fallback: lista simples para mercados não reconhecidos.
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                        {m.selections.map((s, si) => {
                          const p = priceFor(s);
                          const boosted = !!p?.boosted;
                          const pa = !!p?.pa;
                          const size = fmtSize(p?.size);
                          return (
                            <button
                              key={si}
                              disabled={!p}
                              onClick={() => p && openHistory({ bookmaker: p.bookmaker, eventId: p.eventId, marketId: m.marketId, marketName: m.marketName, selection: s.selection, size: p.size })}
                              title={p ? `${p.bookmaker}${boosted ? ' — odd turbinada (limite de stake)' : ''}${pa ? ` — ${PA_HELP}` : ''}${size ? ` — ${SIZE_HELP}` : ''} — ver histórico` : undefined}
                              className={`flex items-center justify-between gap-2 rounded-lg ring-1 px-3 py-2 disabled:opacity-40 transition ${
                                boosted
                                  ? 'bg-amber-500/10 ring-amber-400/50 hover:bg-amber-500/20'
                                  : 'bg-black/30 ring-white/10 hover:bg-teal-500/10 hover:ring-teal-500/40'
                              }`}
                            >
                              <span className="text-xs text-gray-300 truncate flex items-center gap-1" title={selLabel(s)}>
                                {pa && <PaBadge className="shrink-0" />}
                                {boosted && <Zap size={11} className="text-amber-400 fill-amber-400/40 shrink-0" />}
                                {selLabel(s)}
                              </span>
                              <span className="flex flex-col items-end shrink-0 leading-none">
                                <span className={`text-sm font-bold tabular-nums ${boosted ? 'text-amber-300' : 'text-teal-300'}`}>{p ? Number(p.price).toFixed(2) : '—'}</span>
                                {size && <span className="text-[9px] font-semibold tabular-nums text-emerald-400/80 mt-0.5">{size}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-16 text-center">
          <Trophy className="mx-auto text-gray-600 mb-3" size={32} />
          <p className="text-gray-400">Evento não encontrado.</p>
        </div>
      )}

      {/* Modal central: histórico de movimentação da odd (odds_history) */}
      {hist && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHist(null)}>
          <div
            className="relative w-full max-w-2xl bg-brand-dark border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setHist(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>

            <div className="mb-5 pr-8 flex items-center gap-3">
              <span className="inline-flex items-center rounded-md px-2 py-1 bg-white/5 ring-1 ring-white/10">
                <BookmakerTag slug={hist.bookmaker} size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">{hist.marketName || hist.marketId}</h2>
                <p className="text-sm text-gray-400 truncate">{selLabel({ selection: hist.selection, handicap: '' })}</p>
                {fmtSize(hist.size) && (
                  <p className="text-xs font-semibold text-emerald-400 mt-0.5" title={SIZE_HELP}>
                    Liquidez: {fmtSize(hist.size)}
                  </p>
                )}
              </div>
            </div>

            {histLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="animate-spin mr-2" size={18} /> Carregando histórico...</div>
            ) : histAsc.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <BarChart3 className="mx-auto text-gray-600 mb-3" size={28} />
                Sem histórico de movimentação para esta odd.
              </div>
            ) : (() => {
              const prices = histAsc.map((r) => r.price);
              const open = prices[0], current = prices[prices.length - 1];
              const high = Math.max(...prices), low = Math.min(...prices);
              const pct = open ? (histDelta / open) * 100 : 0;
              const stats = [
                { label: 'Atual', value: current.toFixed(2), cls: histDelta >= 0 ? 'text-emerald-300' : 'text-rose-300' },
                { label: 'Abertura', value: open.toFixed(2), cls: 'text-gray-200' },
                { label: 'Máxima', value: high.toFixed(2), cls: 'text-emerald-300/90' },
                { label: 'Mínima', value: low.toFixed(2), cls: 'text-rose-300/90' }
              ];
              return (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {stats.map((s) => (
                      <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</div>
                        <div className={`text-lg font-bold tabular-nums ${s.cls}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Variação + gráfico */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{histAsc.length} {histAsc.length === 1 ? 'registro' : 'registros'}</span>
                      <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${histDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {histDelta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {histDelta >= 0 ? '+' : ''}{histDelta.toFixed(2)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                      </span>
                    </div>
                    <PriceChart points={histAsc.map((r) => ({ t: new Date(r.recordedAt).getTime(), price: r.price }))} />
                  </div>

                  {/* Lista de alterações */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {[...histAsc].reverse().map((r, i, arr) => {
                      const prev = arr[i + 1];
                      const diff = prev ? r.price - prev.price : 0;
                      return (
                        <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-1.5 text-xs">
                          <span className="text-gray-500">{formatTime(r.recordedAt)}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold tabular-nums text-gray-200">{Number(r.price).toFixed(2)}</span>
                            {prev && (
                              <span className={`tabular-nums ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-gray-600'}`}>
                                {diff > 0 ? '▲' : diff < 0 ? '▼' : '–'} {diff !== 0 ? Math.abs(diff).toFixed(2) : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
