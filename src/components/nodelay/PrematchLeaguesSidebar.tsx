import { useEffect, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { Layers, ChevronDown, Trophy } from 'lucide-react';

/**
 * Sidebar de Esporte → País → Liga do PRÉ-JOGO do NoDelay, no mesmo idioma da
 * /events (getEventFacets), mas com acento LIME. A seleção sobe para a lista, que
 * repassa sport/countryKey/leagueId ao getGroupedEvents (filtro no servidor); a
 * lista ainda filtra pelas casas da instância no cliente.
 *
 * Os facets vêm de TODAS as casas (getEventFacets({ upcomingOnly: true })): uma
 * liga pode aparecer na árvore e, ainda assim, não ter jogo das casas da instância
 * — nesse caso a lista mostra o vazio amigável ("Nenhum jogo das suas casas…").
 */

// Estrutura dos facets (igual à /events).
interface FacetLeague { leagueId: string | null; league: string; count: number }
interface FacetCountry { countryKey: string | null; country: string | null; count: number; leagues: FacetLeague[] }
interface FacetSport { sport: string; count: number; countries: FacetCountry[] }

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
  selected: LeagueSelection;
  onSelect: (sel: LeagueSelection) => void;
  onClear: () => void;
}

export function PrematchLeaguesSidebar({ selected, onSelect, onClear }: Props) {
  const [facets, setFacets] = useState<FacetSport[]>([]);
  const [expandedSport, setExpandedSport] = useState('');
  const [expandedCountry, setExpandedCountry] = useState(''); // `${sport}|${countryKey}`

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGateway.getEventFacets({ upcomingOnly: true });
        if (!alive) return;
        const list: FacetSport[] = res.data?.result === 1 ? (res.data.data?.sports || []) : [];
        setFacets(list);
        setExpandedSport((cur) => cur || list[0]?.sport || '');
      } catch {
        /* sidebar é auxiliar — falha silenciosa não quebra a lista */
      }
    })();
    return () => { alive = false; };
  }, []);

  const { sport, countryKey, leagueId } = selected;
  const selSport = (s: string) => { onSelect({ sport: s, countryKey: '', leagueId: '', label: cap(s) }); setExpandedSport(s); };
  const selCountry = (s: string, ck: string, label: string) => { onSelect({ sport: s, countryKey: ck, leagueId: '', label }); setExpandedSport(s); setExpandedCountry(`${s}|${ck}`); };
  const selLeague = (s: string, ck: string, lid: string, label: string) => { onSelect({ sport: s, countryKey: ck, leagueId: lid, label }); setExpandedSport(s); setExpandedCountry(`${s}|${ck}`); };
  const toggleSport = (s: string) => setExpandedSport((cur) => (cur === s ? '' : s));
  const toggleCountry = (k: string) => setExpandedCountry((cur) => (cur === k ? '' : k));

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Esportes e ligas</span>
        {(sport || countryKey || leagueId) && (
          <button onClick={onClear} className="text-[11px] text-rose-300 transition hover:text-rose-200">Limpar</button>
        )}
      </div>

      <div className="max-h-[calc(100vh-9rem)] space-y-0.5 overflow-y-auto p-1.5">
        {/* Todos */}
        <button
          onClick={onClear}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
            !sport ? 'bg-lime-500/15 text-lime-200' : 'text-gray-200 hover:bg-white/10'
          }`}
        >
          <Layers size={15} className="shrink-0 text-lime-300/80" />
          <span className="truncate">Todos os esportes</span>
        </button>

        {facets.length === 0 && <div className="px-2.5 py-3 text-xs text-gray-500">Carregando ligas…</div>}

        {facets.map((s) => {
          const openSport = expandedSport === s.sport;
          const activeSport = sport === s.sport;
          return (
            <div key={s.sport}>
              <div className={`flex items-center gap-1 rounded-lg pr-1 transition ${activeSport ? 'bg-lime-500/15' : 'hover:bg-white/10'}`}>
                <button
                  onClick={() => selSport(s.sport)}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm ${activeSport ? 'text-lime-200' : 'text-gray-200'}`}
                >
                  <Trophy size={14} className="shrink-0 text-lime-300/80" />
                  <span className="truncate">{cap(s.sport)}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-500">{s.count}</span>
                </button>
                {s.countries.length > 0 && (
                  <button onClick={() => toggleSport(s.sport)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-gray-400 transition hover:bg-white/10 hover:text-white" title={openSport ? 'Recolher' : 'Expandir'}>
                    <ChevronDown size={14} className={`transition ${openSport ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Países do esporte */}
              {openSport && s.countries.map((c) => {
                const cKey = ckOf(c);
                const keyFull = `${s.sport}|${cKey}`;
                const openCountry = expandedCountry === keyFull;
                const activeCountry = activeSport && countryKey === cKey;
                const label = c.country || (c.countryKey ? c.countryKey : 'Sem país');
                return (
                  <div key={cKey} className="ml-3 mt-0.5 border-l border-white/10 pl-2">
                    <div className={`flex items-center gap-1 rounded-lg pr-1 transition ${activeCountry && !leagueId ? 'bg-lime-500/15' : 'hover:bg-white/10'}`}>
                      <button
                        onClick={() => selCountry(s.sport, cKey, label)}
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
                              onClick={() => l.leagueId && selLeague(s.sport, cKey, l.leagueId, l.league)}
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
          );
        })}
      </div>
    </div>
  );
}
