'use client';
import { Store, ExternalLink } from 'lucide-react';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { BookmakerDTO } from '@/gateways/api.gateway';

const HouseRow = ({ b, clone = false }: { b: BookmakerDTO; clone?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${clone ? 'bg-black/20 ring-1 ring-white/5' : 'bg-white/5 ring-1 ring-white/10'}`}>
    <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={clone ? 22 : 30} />
    <div className="min-w-0 flex-1">
      <div className="font-semibold truncate" style={{ color: b.color || '#ffffff' }}>{b.name}</div>
      <div className="text-[11px] text-gray-500 font-mono truncate">{b.slug}</div>
    </div>
    {!b.isActive && <span className="text-[10px] uppercase text-gray-500">inativa</span>}
    {b.url && (
      <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-teal-300 shrink-0" title="Abrir site">
        <ExternalLink size={15} />
      </a>
    )}
  </div>
);

export default function AbBookmakersPage() {
  const { bookmakers, loaded } = useBookmakers();

  // Agrupa os clones pela casa "mãe" (slug em cloneOf).
  const clonesByParent = new Map<string, BookmakerDTO[]>();
  for (const b of bookmakers) {
    if (b.cloneOf) {
      if (!clonesByParent.has(b.cloneOf)) clonesByParent.set(b.cloneOf, []);
      clonesByParent.get(b.cloneOf)!.push(b);
    }
  }
  const bySlug = new Set(bookmakers.map((b) => b.slug));
  // "Mães": casas que não são clones. Clones cuja mãe não existe na lista entram como topo.
  const parents = bookmakers.filter((b) => !b.cloneOf);
  const orphanClones = bookmakers.filter((b) => b.cloneOf && !bySlug.has(b.cloneOf));
  const topLevel = [...parents, ...orphanClones].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="text-white max-w-3xl mx-auto p-1 sm:p-2">
      <header className="flex items-center gap-3 mb-5">
        <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
          <Store className="text-teal-300" size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Casas de apostas</h1>
          <p className="text-xs text-gray-400">As casas monitoradas — clones agrupados sob a casa principal</p>
        </div>
      </header>

      {!loaded ? (
        <div className="text-sm text-gray-400 py-8 text-center">Carregando casas...</div>
      ) : topLevel.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center">
          <Store className="mx-auto text-gray-600 mb-3" size={28} />
          <p className="text-gray-400">Nenhuma casa cadastrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {topLevel.map((parent) => {
            const clones = (clonesByParent.get(parent.slug) || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            return (
              <div key={parent.id}>
                <HouseRow b={parent} />
                {clones.length > 0 && (
                  <div className="mt-1.5 ml-5 pl-3 border-l border-white/10 space-y-1.5">
                    {clones.map((c) => <HouseRow key={c.id} b={c} clone />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
