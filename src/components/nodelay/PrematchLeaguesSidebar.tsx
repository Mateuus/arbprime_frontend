import { useState } from 'react';
import { FacetSport, FacetCountry } from '@/hooks/usePrematchFacets';
import { Layers, ChevronDown } from 'lucide-react';

/**
 * Sidebar de País → Liga do PRÉ-JOGO do NoDelay, no mesmo idioma da /events, mas
 * com acento LIME. O ESPORTE é escolhido nas ABAS do topo da lista; aqui só
 * navegamos país/liga DENTRO do esporte ativo (`selected.sport`). Sem esporte
 * ativo (aba "Todos", só quando há vários esportes) mostramos a árvore inteira
 * agrupada por esporte.
 *
 * Os facets vêm de TODAS as casas (usePrematchFacets): uma liga pode aparecer na
 * árvore e, ainda assim, não ter jogo das casas da instância — nesse caso a lista
 * mostra o vazio amigável ("Nenhum jogo das suas casas…").
 */

/** Nó selecionado (o que a lista repassa ao hook/servidor). `label` = rótulo humano. */
export interface LeagueSelection {
  sport: string;
  countryKey: string;
  leagueId: string;
  label: string;
}

const NO_COUNTRY = '__none__';
const ckOf = (c: FacetCountry): string => c.countryKey || NO_COUNTRY;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface Props {
  facets: FacetSport[];
  selected: LeagueSelection;
  onSelect: (sel: LeagueSelection) => void;
  /** Limpa país/liga (mantém o esporte da aba). */
  onClear: () => void;
}

export function PrematchLeaguesSidebar({ facets, selected, onSelect, onClear }: Props) {
  const [expandedCountry, setExpandedCountry] = useState(''); // `${sport}|${countryKey}`
  const { sport, countryKey, leagueId } = selected;

  // Esporte ativo (das abas) → só as ligas dele. Sem esporte → árvore inteira.
  const activeFacet = sport ? facets.find((f) => f.sport === sport) || null : null;
  const groups: { sport: string; countries: FacetCountry[] }[] = activeFacet
    ? [{ sport: activeFacet.sport, countries: activeFacet.countries }]
    : facets.map((f) => ({ sport: f.sport, countries: f.countries }));

  const toggleCountry = (k: string) => setExpandedCountry((cur) => (cur === k ? '' : k));

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ligas</span>
        {(countryKey || leagueId) && (
          <button onClick={onClear} className="text-[11px] text-rose-300 transition hover:text-rose-200">Limpar</button>
        )}
      </div>

      <div className="max-h-[calc(100vh-9rem)] space-y-0.5 overflow-y-auto p-1.5">
        {/* Todas as ligas (do esporte ativo) */}
        <button
          onClick={onClear}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
            !countryKey && !leagueId ? 'bg-lime-500/15 text-lime-200' : 'text-gray-200 hover:bg-white/10'
          }`}
        >
          <Layers size={15} className="shrink-0 text-lime-300/80" />
          <span className="truncate">Todas as ligas</span>
        </button>

        {facets.length === 0 && <div className="px-2.5 py-3 text-xs text-gray-500">Carregando ligas…</div>}

        {groups.map((g) => (
          <div key={g.sport}>
            {/* Cabeçalho de esporte só aparece na visão multi-esporte ("Todos") */}
            {!activeFacet && (
              <div className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{cap(g.sport)}</div>
            )}
            {g.countries.map((c) => {
              const cKey = ckOf(c);
              const keyFull = `${g.sport}|${cKey}`;
              const openCountry = expandedCountry === keyFull;
              const activeCountry = sport === g.sport && countryKey === cKey;
              const label = c.country || (c.countryKey ? c.countryKey : 'Sem país');
              return (
                <div key={cKey}>
                  <div className={`flex items-center gap-1 rounded-lg pr-1 transition ${activeCountry && !leagueId ? 'bg-lime-500/15' : 'hover:bg-white/10'}`}>
                    <button
                      onClick={() => onSelect({ sport: g.sport, countryKey: cKey, leagueId: '', label })}
                      className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[13px] ${activeCountry ? 'text-lime-200' : 'text-gray-300'}`}
                    >
                      <span className="truncate">{label}</span>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-500">{c.count}</span>
                    </button>
                    {c.leagues.length > 0 && (
                      <button onClick={() => toggleCountry(keyFull)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-gray-400 transition hover:bg-white/10 hover:text-white" title={openCountry ? 'Recolher' : 'Expandir'}>
                        <ChevronDown size={13} className={`transition ${openCountry ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Ligas do país */}
                  {openCountry && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                      {c.leagues.map((l) => {
                        const lkey = l.leagueId || `raw:${l.league}`;
                        const activeLeague = activeCountry && !!l.leagueId && leagueId === l.leagueId;
                        return (
                          <button
                            key={lkey}
                            onClick={() => l.leagueId && onSelect({ sport: g.sport, countryKey: cKey, leagueId: l.leagueId, label: l.league })}
                            disabled={!l.leagueId}
                            title={!l.leagueId ? 'Liga ainda não mapeada' : undefined}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition disabled:cursor-default disabled:opacity-50 ${activeLeague ? 'bg-lime-500/15 text-lime-200' : 'text-gray-300 hover:bg-white/10'}`}
                          >
                            <span className="truncate">{l.league}</span>
                            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-500">{l.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
