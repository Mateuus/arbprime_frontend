/**
 * Parser das odds AO VIVO da bet365 (protocolo zap), no browser.
 *
 * Porta enxuta do parser do arbbetting_master (bet365.feed + bet365.markets): o site manda um formato
 * delimitado próprio, não JSON. Aqui o objetivo é MOSTRAR a ficha do jogo — os mercados como a casa
 * manda (nome do MA, seleções do PA, odd, placeable) — não o schema canônico do ArbPrime (isso é do
 * coletor central, pro surebet). Por isso é mais simples que o do master.
 *
 * ── FRAME ──────────────────────────────────────────────────────────────────────────────────────────
 * Um frame do WS traz várias mensagens coladas, separadas por \x08. Cada uma:
 *   \x14<topico>\x01F|<registros>   snapshot (F=full)
 *   \x15<topico>\x01U|<campos>      delta    (U=update, aplicado ao registro cujo IT == topico)
 * Registros separados por `|`, cada um `TIPO;chave=valor;…`. Tipos: EV (evento), MA (mercado), PA (seleção).
 */
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';

export interface FeedNode { type: string; [k: string]: string }
export interface ZapMessage { kind: 'full' | 'update'; topic: string; nodes: FeedNode[]; fields?: Record<string, string> }

/** navId do tópico da ficha (M1): "15" + C2 + "2". O C2 vem do EV do OVInPlay — descoberto por captura. */
export function navIdFromC2(c2: string): string { return c2 ? `15${c2}2` : ''; }
export function m1TopicFor(c2: string): string { const n = navIdFromC2(c2); return n ? `${n}M1_33` : ''; }

const FULL = '\x14', UPDATE = '\x15', SEP = '\x01', MSG_SEP = '\x08';

function parseNode(chunk: string): FeedNode | null {
  // Campos separados por ';'. NÃO cortar no '~' — ele é caractere VÁLIDO dentro de valores (ex.:
  // FF=2~W3Wz…, a chave de delta). Cortar no '~' descartava tudo depois dele — inclusive o NA quando
  // o FF vinha antes — e o evento sumia da lista (nome vazio → derrubado). O master parseia por ';' só.
  const parts = chunk.split(';');
  const type = parts[0];
  if (!type) return null;
  const node: FeedNode = { type };
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq >= 0) node[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return node;
}

function parseKV(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of body.split(';')) {
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq >= 0) out[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return out;
}

export function parseZapFrames(raw: string): ZapMessage[] {
  const out: ZapMessage[] = [];
  for (const msg of raw.split(MSG_SEP)) {
    if (!msg) continue;
    const kind = msg[0];
    if (kind !== FULL && kind !== UPDATE) continue;
    const cut = msg.indexOf(SEP);
    if (cut < 0) continue;
    const topic = msg.slice(1, cut);
    const payload = msg.slice(cut + 1).replace(/\x00/g, '');
    if (kind === FULL) {
      const nodes = payload.replace(/^F\|?/, '').split('|').map(parseNode).filter((n): n is FeedNode => !!n);
      out.push({ kind: 'full', topic, nodes });
    } else {
      out.push({ kind: 'update', topic, nodes: [], fields: parseKV(payload.replace(/^U\|?/, '')) });
    }
  }
  return out;
}

/** Fração "25/1" → decimal 26.0. "0/0"/indisponível → 0. */
export function fracToDecimal(od: string): number {
  if (!od) return 0;
  const m = /^(-?\d+)\/(\d+)$/.exec(od.trim());
  if (!m) { const n = parseFloat(od); return Number.isFinite(n) && n > 1 ? n : 0; }
  const num = +m[1], den = +m[2];
  if (!den || num === 0) return 0;
  return Math.round((num / den + 1) * 1000) / 1000;
}

const SPORT_META: Record<string, { id: string; name: string; order: number }> = {
  '1': { id: 'soccer', name: 'Futebol', order: 1 },
  '18': { id: 'basketball', name: 'Basquete', order: 2 },
  '13': { id: 'tennis', name: 'Tênis', order: 3 },
  '91': { id: 'volleyball', name: 'Vôlei', order: 4 },
  '16': { id: 'baseball', name: 'Baseball', order: 5 },
};

const SIDE: Record<string, number> = { '1': 1, x: 2, '2': 3 };

/**
 * Estado de UM tópico (a ficha de um jogo, ou o panorama). Guarda os nós por IT e aplica os deltas.
 * `build(fi?)` monta o LiveGameDetail do evento — se `fi` for dado, só desse evento.
 */
// ── RELÓGIO ───────────────────────────────────────────────────────────────────
// O feed manda o tempo como base TM:TS + flag TT (1=rodando) + TU (timestamp do servidor de quando a
// base foi setada). O relógio corrente = base + (agora_do_servidor − TU). O "agora do servidor" vem do
// tópico __time (campo TI). Como só usamos DIFERENÇAS de timestamps do servidor, é tz-independente.
let srvBaseMs = 0;   // último TI do __time (ms epoch)
let srvAtLocal = 0;  // Date.now() de quando recebemos esse TI
function parseFeedTs(s: string | undefined): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})?/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || 0)) : 0;
}
/** Alimenta o relógio do servidor a partir do TI do tópico __time. */
export function setServerTime(ti: string | undefined): void {
  const ms = parseFeedTs(ti);
  if (ms) { srvBaseMs = ms; srvAtLocal = Date.now(); }
}
function serverNowMs(): number {
  return srvBaseMs ? srvBaseMs + (Date.now() - srvAtLocal) : Date.now();
}
/** Segundos de jogo CORRENTES a partir de TM/TS/TT/TU — rodando soma o tempo decorrido desde TU. */
export function clockSecOf(f: Record<string, string | undefined>): number {
  const base = (parseInt(f.TM || '0', 10) || 0) * 60 + (parseInt(f.TS || '0', 10) || 0);
  if (f.TT === '1') { const tu = parseFeedTs(f.TU); if (tu) return base + Math.max(0, Math.floor((serverNowMs() - tu) / 1000)); }
  return base;
}
export function fmtClock(sec: number): string {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Bet365LiveTopic {
  private nodes: FeedNode[] = [];         // ordem do documento (a hierarquia EV→MA→PA é posicional)
  private byIt = new Map<string, FeedNode>();
  private byFp = new Map<string, FeedNode>();   // seleção por fp (PA.ID) — casa updates de OUTRO tópico

  applyFull(nodes: FeedNode[]): void {
    this.nodes = nodes;
    this.byIt.clear();
    this.byFp.clear();
    for (const n of nodes) { if (n.IT) this.byIt.set(n.IT, n); if (n.ID) this.byFp.set(n.ID, n); }
  }

  applyUpdate(topic: string, fields: Record<string, string>): boolean {
    // casa pelo IT; senão pelo fp (número após o "-"): assim os deltas FRESCOS do OVInPlay
    // (OV<fi>-<fp>) atualizam a MESMA seleção na ficha 6V (6VP<fi>-<fp>), que atualiza mais devagar.
    let n = this.byIt.get(topic);
    if (!n) { const fp = (topic.match(/-(\d+)_33/) || [])[1]; if (fp) n = this.byFp.get(fp); }
    if (!n) return false;
    Object.assign(n, fields);
    return true;
  }

  /** Nós crus do último snapshot (p/ o build6vMarkets montar a ficha completa). */
  allNodes(): FeedNode[] { return this.nodes; }

  /** Campos do EV de um jogo (por fi) — p/ ler o C2 e derivar o tópico M1. */
  eventFields(fi: string): FeedNode | null {
    for (const n of this.nodes) {
      if (n.type !== 'EV') continue;
      const idSrc = n.FI || n.ID || n.IT || '';
      if ((idSrc.match(/^\d+/) || [''])[0] === fi) return n;
    }
    return null;
  }

  /**
   * Placar/relógio/estatísticas do EV de um snapshot M1. O relógio NÃO vem pronto: a bet365 manda o
   * tempo BASE (TM:TS) + `running` (TT=1) e o CLIENTE conta os segundos (comprovado: TM/TS ficam
   * parados por 30s com TT=1). Por isso devolvo `clockSec` (base em segundos) + `running` — quem exibe
   * avança localmente com um ticker.
   */
  m1Info(): { score?: string; clockSec?: number; running?: boolean; stats: { name: string; home: string; away: string }[] } | null {
    const ev = this.nodes.find((n) => n.type === 'EV');
    if (!ev) return null;
    const tm = parseInt(ev.TM || '', 10);
    const ts = parseInt(ev.TS || '0', 10) || 0;
    // SC = categoria de stat (NA=IGoal/ICorner/…), seguido de SL por time (ID=0 casa, ID=1 fora, D1=valor).
    const stats: { name: string; home: string; away: string }[] = [];
    let cat: { name: string; home: string; away: string } | null = null;
    for (const n of this.nodes) {
      if (n.type === 'SC') { cat = { name: n.NA || '', home: '', away: '' }; if (n.NA) stats.push(cat); }
      else if (n.type === 'SL' && cat) { if (n.ID === '0') cat.home = n.D1 || ''; else if (n.ID === '1') cat.away = n.D1 || ''; }
    }
    return {
      score: ev.SS || undefined,
      clockSec: Number.isFinite(tm) ? tm * 60 + ts : undefined,
      running: ev.TT === '1',
      stats: stats.filter((s) => s.name && (s.home || s.away)),
    };
  }

  /** Monta os LiveGameDetail dos eventos deste tópico (pode ter 1 ou muitos). */
  buildEvents(): LiveGameDetail[] {
    const out: LiveGameDetail[] = [];
    let ev: FeedNode | null = null, seg: FeedNode[] = [];
    const flush = () => { if (ev) { const d = toDetail(ev, seg); if (d) out.push(d); } };
    for (const n of this.nodes) {
      if (n.type === 'EV') { flush(); ev = n; seg = [n]; }
      else if (ev) seg.push(n);
    }
    flush();
    return out;
  }
}

/** EV + seus MA/PA → LiveGameDetail (o shape que a página de evento renderiza). */
export function toDetail(ev: FeedNode, seg: FeedNode[]): LiveGameDetail | null {
  const na = ev.NA || '';
  const parts = na.split(/\s+v\s+/i);
  if (parts.length < 2) return null;
  const idSrc = ev.FI || ev.ID || ev.IT || '';
  const fi = (idSrc.match(/^\d+/) || [idSrc])[0];
  const sportId = (ev.IT || ev.ID || '').match(/C(\d+)A/)?.[1] || '';
  const meta = SPORT_META[sportId] || { id: 'other', name: 'Outro', order: 99 };
  const [s1, s2] = (ev.SS || '').split('-').map((x) => x.trim());

  // agrupa MA→PA (posicional): um MA abre mercado, os PA seguintes são as seleções, até o próximo MA/EV.
  const markets: LiveMarket[] = [];
  let cur: LiveMarket | null = null;
  let order = 0;
  for (const n of seg) {
    if (n.type === 'MA') {
      cur = {
        id: n.ID || n.MA || String(order),
        name: n.NA || 'Mercado',
        marketTypeId: n.ID || n.MA || '',
        groups: [],
        order: order++,
        suspended: n.SU === '1',
        suspendedAt: null,
        selections: [],
        tplGroups: [],
      };
      markets.push(cur);
    } else if (n.type === 'PA' && cur) {
      const price = fracToDecimal(n.OD || '');
      cur.selections.push({
        id: n.ID || `${cur.id}-${cur.selections.length}`, // id APOSTÁVEL = PA.ID (o fp da bet365)
        name: n.NA || '',
        price,
        trueOdds: price,
        line: n.HA || n.HD || null,
        side: SIDE[String(n.N2 || '').toLowerCase()] ?? 0,
        points: null,
        disabled: n.SU === '1' || !price || price <= 1,
        order: parseInt(n.OR || '0', 10) || cur.selections.length,
        outcomeType: n.NA || '',
        tplIndex: null,
        rawOdd: n.OD || undefined, // fração nativa (ex "8/11") p/ o placeable do disparo ao vivo
        fi: n.FI || undefined,     // FI de APOSTA (≠ id de exibição) → o `f` do addbet
      });
    }
  }

  // No panorama (OVInPlay) o PA NÃO traz nome — só ordem. Nomeia por posição: 3 seleções = 1X2
  // (casa/empate/fora), 2 = duas vias (casa/fora). A ficha do tópico por-jogo traz nomes reais.
  for (const mk of markets) {
    if (mk.selections.every((s) => !s.name)) {
      const labels = mk.selections.length === 3 ? ['home', 'draw', 'away'] : mk.selections.length === 2 ? ['home', 'away'] : [];
      mk.selections.sort((a, b) => a.order - b.order).forEach((s, i) => {
        s.name = labels[i] || String(i);
        s.outcomeType = s.name;
        if (!s.side) s.side = labels[i] === 'home' ? 1 : labels[i] === 'draw' ? 2 : labels[i] === 'away' ? 3 : 0;
      });
    }
  }

  return {
    id: fi, sportId: meta.id, sportName: meta.name, sportOrder: meta.order,
    regionName: '', competitionId: ev.CT || '', competitionName: ev.CT || '',
    home: parts[0].trim(), away: parts.slice(1).join(' v ').trim(),
    startTs: 0, isBlocked: false, marketsCount: markets.length,
    info: { score1: s1 || undefined, score2: s2 || undefined, current_game_time: (ev.TM != null || ev.TT != null) ? fmtClock(clockSecOf(ev)) : undefined },
    fsbEventId: fi,
    groups: [], liveStats: null,
    markets: markets.filter((m) => m.selections.length > 0),
  };
}

// ── 6V: FICHA COMPLETA (todos os mercados com odds) ─────────────────────────────
// O tópico `6V<detail.id>C1A_33_0` traz a ficha inteira num snapshot: MA (mercado, IT=6V<id>-<marketId>
// [-<coluna>]_33_0) + PA (seleção: NA=rótulo, OD=fração, ID=fp, FI=FI de aposta, HA/HD=linha, SU=suspenso,
// N2=1/X/2). O NOME do mercado vem do mapa HM (nó CL do OVInPlay). Mercados "matriz" (over/under,
// handicap) são VÁRIAS colunas (MA "Mais de"/"Menos de") com o MESMO marketId + a linha no HA de cada PA.

const marketNameMap = new Map<string, string>();
/** Alimenta o mapa marketId→nome a partir do HM dos nós CL (vem no OVInPlay). */
export function applyMarketNames(nodes: FeedNode[]): void {
  for (const n of nodes) {
    const hm = (n as Record<string, string>).HM;
    if (n.type === 'CL' && hm) for (const p of hm.split('^')) { const i = p.indexOf('#'); if (i > 0) marketNameMap.set(p.slice(0, i), p.slice(i + 1)); }
  }
}

/** Categoria (aba) de um mercado, derivada do nome (a bet365 agrupa assim: Gols, Escanteios, etc.). */
function categoryOf(name: string): { id: string; name: string; order: number } {
  const n = name.toLowerCase();
  if (/escanteio|c[óo]rner/.test(n)) return { id: 'corners', name: 'Escanteios', order: 3 };
  if (/cart[ãa]o|cart[õo]es/.test(n)) return { id: 'cards', name: 'Cartões', order: 4 };
  if (/jogador|marcador|artilheiro|assist[êe]ncia/.test(n)) return { id: 'player', name: 'Jogador', order: 7 };
  if (/intervalo|1[ºo°]?\s*tempo|primeiro tempo|ht\b/.test(n)) return { id: 'h1', name: '1º Tempo', order: 5 };
  if (/2[ºo°]?\s*tempo|segundo tempo/.test(n)) return { id: 'h2', name: '2º Tempo', order: 6 };
  if (/gol/.test(n)) return { id: 'goals', name: 'Gols', order: 2 };
  return { id: 'main', name: 'Principais', order: 1 };
}

/** Abas (categorias) da ficha, a partir dos mercados — para o `detail.groups` que o EventBoard usa. */
export function sixVGroups(markets: LiveMarket[]): LiveGameDetail['groups'] {
  const cats = new Map<string, { id: string; name: string; order: number }>();
  for (const m of markets) { const c = categoryOf(m.name); cats.set(c.id, c); }
  cats.set('all', { id: 'all', name: 'Todos', order: 99 });
  return [...cats.values()].sort((a, b) => a.order - b.order);
}

/** Rótulo a partir do N2 quando a seleção não traz NA (Sim/Não, 1/X/2). */
function n2Label(n2?: string): string {
  const m: Record<string, string> = { '1': '1', x: 'Empate', '2': '2', y: 'Sim', n: 'Não' };
  return m[String(n2 || '').toLowerCase()] || '';
}

/** Constrói TODOS os mercados da ficha a partir dos nós do tópico 6V. O NOME de cada mercado vem do nó
 *  MG (grupo) que o precede (MG.NA), não do HM. Mercados matriz (over/under) = várias MA (colunas) com o
 *  mesmo marketId sob um MG só. */
export function build6vMarkets(nodes: FeedNode[]): LiveMarket[] {
  const order: string[] = [];
  const byId = new Map<string, { colNA: string; pas: FeedNode[] }[]>();
  const nameById = new Map<string, string>();  // marketId → nome do MG que o abriu
  let curId = '', curMg = '';
  for (const n of nodes) {
    if (n.type === 'MG') { if (n.NA && n.NA.trim()) curMg = n.NA.trim(); curId = ''; }
    else if (n.type === 'EV') { curId = ''; }
    else if (n.type === 'MA') {
      const m = (n.IT || '').match(/6V\d+-(\d+)/); // marketId = 1º número após o "6V<id>-"
      curId = m ? m[1] : '';
      if (curId) {
        if (!byId.has(curId)) { byId.set(curId, []); order.push(curId); nameById.set(curId, curMg); }
        byId.get(curId)!.push({ colNA: n.NA || '', pas: [] });
      }
    } else if (n.type === 'PA' && curId && byId.has(curId)) {
      const cols = byId.get(curId)!; cols[cols.length - 1].pas.push(n);
    }
  }

  const markets: LiveMarket[] = [];
  let ord = 0;
  for (const id of order) {
    const cols = byId.get(id)!;
    const name = nameById.get(id) || marketNameMap.get(id) || cols.map((c) => c.colNA).find((s) => s && s.trim()) || `#${id}`;
    // coluna de RÓTULOS (PAs com NA e sem OD) → OR → rótulo da linha (time / linha "8.5"). Mercados
    // matriz (Ambos Marcam, over/under) têm essa coluna; o rótulo da seleção combina ela + a coluna.
    const rowLabels = new Map<string, string>();
    for (const col of cols) if (col.pas.length && col.pas.every((p) => !p.OD)) col.pas.forEach((p, i) => { if (p.NA) rowLabels.set(p.OR || String(i), p.NA); });
    const selections: LiveSelection[] = [];
    for (const col of cols) {
      if (col.pas.length && col.pas.every((p) => !p.OD)) continue; // pula a coluna de rótulos
      for (const p of col.pas) {
        const price = fracToDecimal(p.OD || '');
        if (!price) continue;
        const row = rowLabels.get(p.OR || '') || '';
        const line = p.HA || p.HD || (/^[+-]?[\d.]+$/.test(row) ? row : null);
        // rótulo: NA da própria seleção → coluna+linha ("Mais de 8.5", "Sim Gimnasia") → N2 (Sim/Não/1/X/2)
        const label = p.NA || [col.colNA, row].filter((s) => s && s.trim()).join(' ').trim() || n2Label(p.N2 as string | undefined);
        selections.push({
          id: p.ID || `${id}-${selections.length}`,
          name: label, price, trueOdds: price, line,
          side: SIDE[String(p.N2 || '').toLowerCase()] ?? 0, points: null,
          disabled: p.SU === '1' || !price || price <= 1,
          order: parseInt(p.OR || '0', 10) || selections.length, outcomeType: label, tplIndex: null,
          rawOdd: p.OD || undefined, fi: p.FI || undefined,
        });
      }
    }
    // fallback: mercado 2-vias que ficou sem rótulo (Sim/Não sem NA no feed)
    if (selections.length === 2 && selections.every((s) => !s.name)) { selections[0].name = selections[0].outcomeType = 'Sim'; selections[1].name = selections[1].outcomeType = 'Não'; }
    if (selections.length) {
      const cat = categoryOf(name);
      markets.push({ id, name, marketTypeId: id, groups: [{ id: cat.id, name: cat.name, order: ord, sortingKey: cat.order }, { id: 'all', name: 'Todos', order: ord, sortingKey: 99 }], order: ord++, suspended: false, suspendedAt: null, selections, tplGroups: [] });
    }
  }
  return markets;
}

/** Tópico de odds da ficha (todos os mercados) de um jogo: `6V<detail.id>C1A_33_0`. */
export function sixVTopicFor(gameId: string): string { return gameId ? `6V${gameId}C1A_33_0` : ''; }
