'use client';
import { useMemo, useState } from 'react';
import { Store, ExternalLink, ChevronRight, X, ArrowLeftRight, Link2, BarChart3 } from 'lucide-react';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { GroupedHouse, BookmakerDTO } from '@/gateways/api.gateway';

// Casa do evento já mesclada com o registro (nome/cor/logo/site) da casa.
interface HouseNode {
  slug: string;
  name: string;
  color?: string | null;
  logoUrl?: string | null;
  site?: string | null;   // url do site da casa (registro)
  link: string | null;    // link DIRETO pro jogo nesta casa (specifico do evento)
  inverted: boolean;
  sortOrder: number;
  b?: BookmakerDTO;
}

interface Grouped {
  parent: HouseNode;
  clones: HouseNode[];
}

interface Props {
  houses: GroupedHouse[];
  marketCount: number;
  eventLabel: string; // "Tunísia vs Países Baixos"
}

export function EventHousesPanel({ houses, marketCount, eventLabel }: Props) {
  const { getBookmaker } = useBookmakers();
  const [open, setOpen] = useState(false);

  // Mescla cada casa do evento com seu registro e agrupa clones sob a casa-mãe.
  const { groups, total, parentsCount, clonesCount, withLink, invertedCount, flat } = useMemo(() => {
    const nodes: HouseNode[] = houses.map((h) => {
      const b = getBookmaker(h.bookmaker);
      return {
        slug: h.bookmaker,
        name: b?.name || h.bookmaker,
        color: b?.color,
        logoUrl: b?.logoUrl,
        site: b?.url,
        link: h.link,
        inverted: h.inverted,
        sortOrder: b?.sortOrder ?? 999,
        b
      };
    });

    const present = new Set(nodes.map((n) => n.slug.toLowerCase()));
    // parent só vale se a casa-mãe TAMBÉM estiver neste evento; senão o clone sobe pro topo.
    const parentKey = (n: HouseNode): string | null => {
      const p = n.b?.cloneOf;
      return p && present.has(p.toLowerCase()) ? p.toLowerCase() : null;
    };

    const clonesByParent = new Map<string, HouseNode[]>();
    const tops: HouseNode[] = [];
    for (const n of nodes) {
      const pk = parentKey(n);
      if (pk) {
        const arr = clonesByParent.get(pk) || [];
        arr.push(n);
        clonesByParent.set(pk, arr);
      } else {
        tops.push(n);
      }
    }
    const bySort = (a: HouseNode, b: HouseNode) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    tops.sort(bySort);

    const grouped: Grouped[] = tops.map((parent) => ({
      parent,
      clones: (clonesByParent.get(parent.slug.toLowerCase()) || []).sort(bySort)
    }));

    return {
      groups: grouped,
      flat: nodes.sort(bySort),
      total: nodes.length,
      parentsCount: tops.length,
      clonesCount: nodes.length - tops.length,
      withLink: nodes.filter((n) => n.link).length,
      invertedCount: nodes.filter((n) => n.inverted).length
    };
  }, [houses, getBookmaker]);

  // Logos do preview (casas-mãe primeiro, no máximo 9).
  const preview = useMemo(() => groups.map((g) => g.parent).slice(0, 9), [groups]);
  const extra = total - preview.length;

  if (total === 0) return null;

  return (
    <>
      {/* Preview clicável no cabeçalho do evento */}
      <button
        onClick={() => setOpen(true)}
        className="group mt-4 flex w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-teal-500/40"
      >
        <div className="flex -space-x-2.5">
          {preview.map((n) => (
            <span key={n.slug} className="rounded-lg ring-2 ring-brand-dark" title={n.name}>
              <BookmakerLogo name={n.name} slug={n.slug} logoUrl={n.logoUrl} color={n.color} size={26} />
            </span>
          ))}
          {extra > 0 && (
            <span className="grid h-[26px] w-[26px] place-items-center rounded-lg bg-white/10 text-[10px] font-bold text-gray-300 ring-2 ring-brand-dark">
              +{extra}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">
            {total} {total === 1 ? 'casa monitora' : 'casas monitoram'} este jogo
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1"><BarChart3 size={11} className="text-teal-400/70" /> {marketCount} mercados</span>
            {withLink > 0 && <span className="inline-flex items-center gap-1"><Link2 size={11} className="text-teal-400/70" /> {withLink} com link direto</span>}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-200 ring-1 ring-teal-500/30 transition group-hover:bg-teal-500/25">
          Ver casas <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </span>
      </button>

      {open && (
        <HousesModal
          eventLabel={eventLabel}
          groups={groups}
          flat={flat}
          stats={{ total, parentsCount, clonesCount, withLink, invertedCount }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

interface ModalStats {
  total: number;
  parentsCount: number;
  clonesCount: number;
  withLink: number;
  invertedCount: number;
}

function HousesModal({
  eventLabel,
  groups,
  flat,
  stats,
  onClose
}: {
  eventLabel: string;
  groups: Grouped[];
  flat: HouseNode[];
  stats: ModalStats;
  onClose: () => void;
}) {
  // Clones recolhidos por padrão (slug da mãe -> aberto).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 'grouped' = clones sob a mãe; 'flat' = lista corrida (todas as casas).
  const [view, setView] = useState<'grouped' | 'flat'>('grouped');

  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  const hasClones = stats.clonesCount > 0;

  const statChips = [
    { label: 'Casas', value: stats.total, cls: 'text-teal-200' },
    { label: 'Principais', value: stats.parentsCount, cls: 'text-gray-200' },
    ...(hasClones ? [{ label: 'Clones', value: stats.clonesCount, cls: 'text-violet-300' }] : []),
    { label: 'Link direto', value: stats.withLink, cls: 'text-emerald-300' }
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-dark shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b border-white/10 bg-gradient-to-br from-teal-500/10 to-transparent p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Store className="text-teal-300" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white">Casas de apostas</h2>
            <p className="truncate text-xs text-gray-400" title={eventLabel}>
              que oferecem mercados em <span className="text-gray-300">{eventLabel}</span>
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 transition hover:text-rose-400" title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Descrição + estatísticas */}
        <div className="border-b border-white/10 p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {statChips.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                <div className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-gray-400">
            Estas são as casas monitoradas que listam este jogo.
            {hasClones && <> Os <span className="text-violet-300">clones</span> (espelhos da mesma operação) aparecem agrupados sob a casa principal.</>}
            {stats.invertedCount > 0 && <> A etiqueta <span className="font-semibold text-amber-300">inv</span> indica casas que listam mandante e visitante invertidos.</>}
          </p>
        </div>

        {/* Alternância grupo/lista (só faz sentido se houver clones) */}
        {hasClones && (
          <div className="flex items-center gap-1 px-4 pt-3">
            {(['grouped', 'flat'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  view === v ? 'bg-teal-500 text-slate-900' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {v === 'grouped' ? 'Agrupadas' : 'Todas'}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {view === 'flat' || !hasClones
            ? flat.map((n) => <HouseRow key={n.slug} n={n} />)
            : groups.map((g) => {
                const isOpen = expanded.has(g.parent.slug);
                return (
                  <div key={g.parent.slug}>
                    <HouseRow
                      n={g.parent}
                      cloneCount={g.clones.length}
                      expanded={isOpen}
                      onToggle={g.clones.length ? () => toggle(g.parent.slug) : undefined}
                    />
                    {g.clones.length > 0 && isOpen && (
                      <div className="mt-1.5 ml-5 space-y-1.5 border-l border-white/10 pl-3">
                        {g.clones.map((c) => <HouseRow key={c.slug} n={c} clone />)}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function HouseRow({
  n,
  clone = false,
  cloneCount = 0,
  expanded = false,
  onToggle
}: {
  n: HouseNode;
  clone?: boolean;
  cloneCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const identity = (
    <>
      <BookmakerLogo name={n.name} slug={n.slug} logoUrl={n.logoUrl} color={n.color} size={clone ? 22 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold" style={{ color: n.color || '#ffffff' }}>{n.name}</span>
          {cloneCount > 0 && (
            <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
              {cloneCount} {cloneCount === 1 ? 'clone' : 'clones'}
            </span>
          )}
          {n.inverted && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300 ring-1 ring-amber-500/30" title="Mandante/visitante invertidos nesta casa">
              <ArrowLeftRight size={9} /> inv
            </span>
          )}
        </div>
        <div className="truncate font-mono text-[11px] text-gray-500">{n.slug}</div>
      </div>
    </>
  );

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${clone ? 'bg-black/20 ring-1 ring-white/5' : 'bg-white/5 ring-1 ring-white/10'}`}>
      {onToggle ? (
        <>
          <button onClick={onToggle} className="grid h-6 w-6 shrink-0 place-items-center rounded text-gray-400 transition hover:bg-white/10 hover:text-teal-300" title={expanded ? 'Recolher' : 'Expandir clones'}>
            <ChevronRight size={16} className={`transition ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">{identity}</button>
        </>
      ) : (
        identity
      )}

      {/* Ações: link direto pro jogo + site da casa */}
      <div className="flex shrink-0 items-center gap-1.5">
        {n.link ? (
          <a
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-teal-500/15 px-2.5 py-1.5 text-xs font-semibold text-teal-200 ring-1 ring-teal-500/30 transition hover:bg-teal-500/25"
            title="Abrir este jogo na casa"
          >
            <ExternalLink size={13} /> Abrir jogo
          </a>
        ) : n.site ? (
          <a
            href={n.site}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-teal-200"
            title="Abrir o site da casa"
          >
            <ExternalLink size={13} /> Site
          </a>
        ) : (
          <span className="text-[11px] text-gray-600">sem link</span>
        )}
      </div>
    </div>
  );
}

export default EventHousesPanel;
