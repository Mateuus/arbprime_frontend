import { useState, useMemo } from 'react';
import { fmtOdd } from '@/utils/nodelayLive';
import { PrematchEvent, PrematchSection, SAMPLE_PREMATCH, SAMPLE_PREMATCH_LIST, PrematchListMatch } from '@/services/nodelay/prematchSample';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import { ArrowLeft, Play, Menu, Bell, ChevronDown, ChevronsRight, X } from 'lucide-react';

/**
 * Board de PRÉ-JOGO no estilo bet365. DADOS DE EXEMPLO (SAMPLE_PREMATCH) — o feed
 * real virá do nosso catálogo /events. Mantém a mesma linguagem visual do live:
 * odds em ÂMBAR/OURO, acento lime do NoDelay, chip "CA" esmeralda.
 *
 * As odds do pré-jogo AINDA não ligam no disparo (apostar prematch é futuro), mas
 * a célula de odd tem a mesma cara/estrutura do live p/ ser ligada depois (onPick).
 */

interface Props {
  event?: PrematchEvent; // default = amostra; no futuro, o evento do /events
  /** Abrir OUTRO jogo (via menu ≡ do mesmo campeonato). A página injeta a navegação. */
  onOpenEvent?: (eventId: string) => void;
  /** Voltar (o ← do hero) — evita um 2º "voltar" redundante na página. */
  onBack?: () => void;
}

export function PrematchBoard({ event = SAMPLE_PREMATCH, onOpenEvent, onBack }: Props) {
  const [tabId, setTabId] = useState<string>(event.groups[0]?.id ?? 'popular');
  const sections = useMemo(
    () => event.sections.filter((s) => s.groups.includes(tabId)),
    [event.sections, tabId],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <PrematchHero event={event} onOpenEvent={onOpenEvent} onBack={onBack} />

      {/* Abas — rolam na horizontal, sino à direita fixo */}
      <div className="flex items-stretch border-b border-white/10 bg-black/20">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex w-max gap-1 px-2 py-2">
            {event.groups.map((g) => {
              const on = g.id === tabId;
              return (
                <button
                  key={g.id}
                  onClick={() => setTabId(g.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    on ? 'bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/40' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
        <button className="grid shrink-0 place-items-center border-l border-white/10 px-3 text-gray-400 transition hover:text-lime-300" title="Notificações">
          <Bell size={15} />
        </button>
      </div>

      <div className="divide-y divide-white/10">
        {sections.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Nenhum mercado nesta aba (amostra).</div>
        ) : (
          sections.map((s) => <SectionView key={s.id} section={s} />)
        )}
      </div>
    </div>
  );
}

/** Faixa hero: banda "estádio" (gradiente CSS, sem imagem por causa da CSP). */
function PrematchHero({ event, onOpenEvent, onBack }: { event: PrematchEvent; onOpenEvent?: (id: string) => void; onBack?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative overflow-hidden">
      {/* Banda estádio — gradiente radial escuro simulando o gramado/holofotes */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% -10%, rgba(101,163,13,0.18), transparent 55%), radial-gradient(80% 120% at 50% 120%, rgba(16,185,129,0.10), transparent 60%), linear-gradient(180deg, #0b1220 0%, #0a0f1a 100%)',
        }}
      />
      {/* linhas do campo */}
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
          <span className="truncate px-2 text-xs font-medium text-gray-300">{event.competition}</span>
          <span className="h-7 w-7" />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamCol name={event.home} sofaId={event.homeSofaId} align="right" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums text-white">{event.kickoff}</span>
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Play size={10} className="fill-lime-300 text-lime-300" /> v
            </span>
            <button
              onClick={() => setMenuOpen(true)}
              className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-gray-300 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-white"
              title="Outros jogos do campeonato"
            >
              <Menu size={13} />
            </button>
          </div>
          <TeamCol name={event.away} sofaId={event.awaySofaId} align="left" />
        </div>
      </div>

      {menuOpen && (
        <CompetitionFixturesModal
          competition={event.competition}
          onClose={() => setMenuOpen(false)}
          onOpenEvent={(id) => { setMenuOpen(false); onOpenEvent?.(id); }}
        />
      )}
    </div>
  );
}

// pt-BR: "Ter 21 Jul" e "19:30" a partir do ISO (kickoff tem offset -03:00 explícito).
const OPTS_DATE: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' };
const OPTS_TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (iso: string) => cap(new Date(iso).toLocaleDateString('pt-BR', OPTS_DATE).replace('.', '').replace(',', ''));
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', OPTS_TIME);

/**
 * Menu ≡ do jogo: lista os OUTROS jogos do MESMO campeonato (SAMPLE_PREMATCH_LIST
 * filtrado por competition), agrupados por data — como a bet365. Clicar abre o
 * evento (a página injeta a navegação por onOpenEvent). Overlay com tom "estádio".
 */
function CompetitionFixturesModal({ competition, onClose, onOpenEvent }: { competition: string; onClose: () => void; onOpenEvent: (id: string) => void }) {
  const groups = useMemo(() => {
    const list = SAMPLE_PREMATCH_LIST.filter((m) => m.competition === competition)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    const by = new Map<string, PrematchListMatch[]>();
    for (const m of list) {
      const key = fmtDate(m.kickoff);
      (by.get(key) ?? by.set(key, []).get(key)!).push(m);
    }
    return [...by.entries()];
  }, [competition]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-500/20 shadow-2xl"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgba(16,185,129,0.14), transparent 60%), #0a0f1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-gray-300 ring-1 ring-white/10 transition hover:text-white">
            <ArrowLeft size={15} />
          </button>
          <span className="truncate px-2 text-sm font-bold text-white">{competition}</span>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
            <X size={15} />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">Nenhum outro jogo deste campeonato.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {groups.map(([date, matches]) => (
              <div key={date}>
                <div className="sticky top-0 bg-black/40 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 backdrop-blur">{date}</div>
                <ul>
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => onOpenEvent(m.id)}
                        className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 text-left transition hover:bg-white/5"
                      >
                        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                          <span className="truncate text-sm font-semibold text-white">{m.home}</span>
                          <TeamLogo name={m.home} sofascoreId={m.homeSofaId} size={26} />
                        </div>
                        <span className="shrink-0 rounded bg-black/40 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-300">{fmtTime(m.kickoff)}</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo name={m.away} sofascoreId={m.awaySofaId} size={26} />
                          <span className="truncate text-sm font-semibold text-white">{m.away}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCol({ name, sofaId, align }: { name: string; sofaId?: number; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 ${align === 'right' ? 'sm:items-end' : 'sm:items-start'}`}>
      <TeamLogo name={name} sofascoreId={sofaId} size={38} />
      <span className="truncate text-center text-sm font-bold text-white sm:text-base">{name}</span>
    </div>
  );
}

function SectionView({ section }: { section: PrematchSection }) {
  const [collapsed, setCollapsed] = useState(false);

  // Cabeçalho comum (título + sub-tags verdes + CA + chevron). A "Aposta Aumentada"
  // e os cards "Criar Aposta" têm cabeçalho próprio, tratados nos seus ramos.
  const header = (title: string, opts?: { ca?: boolean; tag?: string; subtags?: string[] }) => (
    <button onClick={() => setCollapsed((v) => !v)} className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{title}</span>
          {opts?.tag && (
            <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
              {opts.tag}
            </span>
          )}
          {opts?.ca && (
            <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/40">
              CA
            </span>
          )}
        </span>
        {opts?.subtags && opts.subtags.length > 0 && (
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {opts.subtags.map((t) => (
              <span key={t} className="text-[10px] font-semibold italic text-emerald-400">{t}</span>
            ))}
          </span>
        )}
      </span>
      <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-500 transition ${collapsed ? '-rotate-90' : ''}`} />
    </button>
  );

  if (section.kind === 'result') {
    return (
      <div>
        {header(section.title, { ca: section.ca, subtags: section.subtags })}
        {!collapsed && (
          <div className="px-3 pb-3">
            <div className={`grid gap-1.5 ${section.selections.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {section.selections.map((o) => <OddCell key={o.id} label={o.name} price={o.price} />)}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (section.kind === 'boosted') {
    return (
      <div>
        <button onClick={() => setCollapsed((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
          <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-emerald-400">
            <ChevronsRight size={16} /> {section.title} <ChevronsRight size={16} />
          </span>
          <ChevronDown size={16} className={`shrink-0 text-gray-500 transition ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        {!collapsed && (
          <div className="space-y-1.5 px-3 pb-3">
            {section.picks.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 ring-1 ring-emerald-500/20">
                <span className="min-w-0 flex-1 truncate text-xs text-gray-200">{p.label}</span>
                <BoostOdd oldPrice={p.oldPrice} newPrice={p.newPrice} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section.kind === 'buildcards') {
    return (
      <div>
        {header(section.title, { ca: true })}
        {!collapsed && (
          <div className="-mx-1 overflow-x-auto px-1 pb-3">
            <div className="flex w-max gap-2 px-2">
              {section.cards.map((c) => (
                <div key={c.id} className="flex w-56 shrink-0 flex-col rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
                  <span className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-400">Criar Aposta</span>
                  <ul className="mb-3 flex-1 space-y-1.5">
                    {c.legs.map((leg, i) => (
                      <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-gray-300">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lime-400" />
                        <span className="min-w-0">{leg}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-end">
                    <BoostOdd oldPrice={c.oldPrice} newPrice={c.newPrice} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // playerprops — tabela Jogador / Últimos 5 | colunas de mercado
  return (
    <div>
      {header(section.title, { ca: section.ca, tag: section.tag })}
      {!collapsed && (
        <div className="overflow-x-auto px-3 pb-3">
          <div className="w-full min-w-[30rem]">
            <div className="grid grid-cols-[1fr_repeat(3,4.5rem)] gap-1.5 px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              <span>Jogador · Últimos 5</span>
              {section.columns.map((c) => <span key={c} className="text-center">{c}</span>)}
            </div>
            <div className="space-y-1.5">
              {section.rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_repeat(3,4.5rem)] items-center gap-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-white">{r.player}</span>
                    <span className="block truncate text-[10px] text-gray-500">{r.last5}</span>
                  </span>
                  {r.odds.map((p, i) => (p == null
                    ? <span key={i} className="rounded-lg bg-black/10 px-2 py-2 text-center text-xs text-gray-700 ring-1 ring-white/5">—</span>
                    : <OddCell key={i} price={p} compact />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Célula de odd do pré-jogo — MESMA cara do live (odd em âmbar). Sem onClick por
 * ora (apostar prematch é futuro); estruturada p/ receber onPick depois, igual ao
 * EventBoard. `label` opcional (nome à esquerda); `compact` = só a odd centralizada.
 */
function OddCell({ label, price, compact }: { label?: string; price: number; compact?: boolean }) {
  if (compact || !label) {
    return (
      <span className="grid place-items-center rounded-lg bg-black/25 px-2 py-2 text-sm font-bold tabular-nums text-amber-400 ring-1 ring-white/10 transition hover:ring-amber-500/40">
        {fmtOdd(price)}
      </span>
    );
  }
  return (
    <span className="flex items-center justify-between gap-1.5 rounded-lg bg-black/25 px-2.5 py-2 ring-1 ring-white/10 transition hover:ring-amber-500/40">
      <span className="min-w-0 truncate text-[11px] text-gray-300">{label}</span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-amber-400">{fmtOdd(price)}</span>
    </span>
  );
}

/** Odd turbinada: preço antigo riscado/cinza » preço novo em âmbar forte. */
function BoostOdd({ oldPrice, newPrice }: { oldPrice: number; newPrice: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="text-xs font-semibold tabular-nums text-gray-500 line-through">{fmtOdd(oldPrice)}</span>
      <ChevronsRight size={13} className="text-emerald-400" />
      <span className="text-sm font-bold tabular-nums text-amber-400">{fmtOdd(newPrice)}</span>
    </span>
  );
}
