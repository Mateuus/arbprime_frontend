import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import { usePrematchGroupedGames, PrematchGame } from '@/hooks/usePrematchGroupedGames';
import { usePrematchFacets } from '@/hooks/usePrematchFacets';
import { PrematchLeaguesSidebar, LeagueSelection } from '@/components/nodelay/PrematchLeaguesSidebar';
import { ChevronRight, Loader2, Search, CalendarClock, CheckCircle2, ListFilter, X } from 'lucide-react';

/**
 * LISTA de pré-jogo no estilo bet365 "Próximas Partidas" — com DADOS REAIS do
 * nosso catálogo /events (usePrematchGroupedGames), filtrados às casas da
 * INSTÂNCIA (houseSlugs) e navegáveis por uma SIDEBAR de esporte/país/liga.
 *
 * Estrutura bet365:
 *  - sidebar (esporte → país → liga) à esquerda no desktop; no mobile abre num
 *    drawer pelo botão "Ligas";
 *  - lista agrupada por COMPETIÇÃO, com sub-cabeçalhos de DATA ("Ter 21 Jul");
 *  - cada linha: os dois times empilhados (com escudo), horário e um selo de
 *    "Contas prontas" (nº de casas da instância que têm o jogo).
 *
 * A seleção da sidebar vira sport/countryKey/leagueId e vai ao getGroupedEvents
 * (filtro no SERVIDOR); a lista ainda filtra pelas casas da instância no cliente.
 * Por isso uma liga da árvore pode existir e não ter jogo das casas da instância —
 * aí mostramos um vazio amigável.
 *
 * OBS: o catálogo agrupado não traz odds na LISTAGEM — o 1X2 só existe DENTRO do
 * evento (PrematchBoard). Por isso a linha mostra as casas prontas, não o 1X2.
 *
 * Clicar numa partida abre a PÁGINA de pré-jogo (rota /prematch/[casa]/[eventId]).
 */

interface Props {
  /** Casas da instância — filtra o catálogo (só jogos com alguma dessas casas). */
  houseSlugs: string[];
  /** Abre a página de pré-jogo do jogo (carrega casa + eventId). */
  onOpen: (bookmaker: string, eventId: string) => void;
}

const EMPTY_SEL: LeagueSelection = { sport: '', countryKey: '', leagueId: '', label: '' };

// Horário verbatim (kickoff é wallclock de Brasília tagueado Z → timeZone UTC).
const cap = (s: string) => s.replace(/\./g, '').replace(/(^|\s)([a-zà-ú])/g, (_, sp, c) => sp + c.toUpperCase());
const dayKey = (iso: string): string => iso.slice(0, 10); // AAAA-MM-DD (já em BRT)
const dayLabel = (iso: string): string =>
  cap(new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }));
const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

// Emoji por esporte (igual ao feed ao vivo, p/ as abas de esporte). Fallback 🏆.
function sportEmoji(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('futebol americano') || n.includes('nfl')) return '🏈';
  if (n.includes('futsal')) return '⚽';
  if (n.includes('futebol') || n.includes('soccer')) return '⚽';
  if (n.includes('basquet') || n.includes('basket')) return '🏀';
  if (n.includes('tênis de mesa') || n.includes('tenis de mesa') || n.includes('ping')) return '🏓';
  if (n.includes('tên') || n.includes('ten')) return '🎾';
  if (n.includes('vôlei') || n.includes('volei') || n.includes('volley')) return '🏐';
  if (n.includes('hóquei') || n.includes('hoquei') || n.includes('hockey')) return '🏒';
  if (n.includes('beisebol') || n.includes('baseball')) return '⚾';
  if (n.includes('handebol') || n.includes('handball')) return '🤾';
  if (n.includes('rugby') || n.includes('rúgbi')) return '🏉';
  if (n.includes('críquete') || n.includes('criquete') || n.includes('cricket')) return '🏏';
  if (n.includes('e-sport') || n.includes('esport') || n.includes('cs') || n.includes('dota') || n.includes('lol')) return '🎮';
  if (n.includes('boxe') || n.includes('mma') || n.includes('luta') || n.includes('ufc')) return '🥊';
  if (n.includes('dardos') || n.includes('darts')) return '🎯';
  if (n.includes('sinuca') || n.includes('bilhar') || n.includes('snooker')) return '🎱';
  if (n.includes('golfe') || n.includes('golf')) return '⛳';
  if (n.includes('badminton')) return '🏸';
  if (n.includes('automob') || n.includes('fórmula') || n.includes('formula') || n.includes('corrida')) return '🏎️';
  return '🏆';
}

// Aba de esporte estilo bet365 (ícone em cima, sublinhado lime na ativa) — mesma
// linguagem do feed ao vivo, p/ consistência entre as duas listas.
function SportTab({ active, icon, label, count, onClick }: { active: boolean; icon: string; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex shrink-0 flex-col items-center gap-0.5 whitespace-nowrap px-3 py-2 transition ${
        active ? 'text-lime-300' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="flex items-center gap-1 text-[11px] font-medium">
        {label}
        <span className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${active ? 'bg-lime-500/25 text-lime-200' : 'bg-white/10 text-gray-500'}`}>{count}</span>
      </span>
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lime-400" />}
    </button>
  );
}

export function PrematchGamesList({ houseSlugs, onOpen }: Props) {
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<LeagueSelection>(EMPTY_SEL);
  const [drawerOpen, setDrawerOpen] = useState(false); // sidebar como drawer (mobile)

  // Esportes (abas do topo) + a árvore país/liga da sidebar vêm dos mesmos facets.
  const { facets } = usePrematchFacets();
  // Assim que os facets chegam, foca o 1º esporte (ex.: Futebol) — sem forçar um
  // "Todos" quando só há um esporte. Roda uma vez (o usuário pode trocar depois).
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current || facets.length === 0) return;
    initedRef.current = true;
    setSel((cur) => (cur.sport || cur.countryKey || cur.leagueId ? cur : { sport: facets[0].sport, countryKey: '', leagueId: '', label: '' }));
  }, [facets]);

  const { games, loading, loadingMore, hasMore, loadMore, error } = usePrematchGroupedGames(houseSlugs, {
    sport: sel.sport || undefined,
    countryKey: sel.countryKey || undefined,
    leagueId: sel.leagueId || undefined,
    search: search.trim() || undefined,
  });

  // Chip só p/ país/liga (o esporte já aparece nas abas).
  const hasLeagueFilter = !!(sel.countryKey || sel.leagueId);
  // Abas de esporte: com >1 esporte, oferece "Todos" (sport=''); com 1, só ele.
  const totalCount = facets.reduce((s, f) => s + f.count, 0);
  const showAll = facets.length > 1;

  const selectSport = (s: string) => { setSel({ sport: s, countryKey: '', leagueId: '', label: '' }); setDrawerOpen(false); };
  const selectFromSidebar = (s: LeagueSelection) => { setSel(s); setDrawerOpen(false); };
  // Limpar país/liga mantém o esporte da aba ativa.
  const clearSidebar = () => { setSel((cur) => ({ sport: cur.sport, countryKey: '', leagueId: '', label: '' })); setDrawerOpen(false); };

  // Agrupa por competição → depois por dia, tudo ordenado por horário.
  const comps = useMemo(() => {
    const withDate = games.filter((g) => g.kickoff);
    const byComp = new Map<string, PrematchGame[]>();
    for (const g of withDate) {
      (byComp.get(g.competition) ?? byComp.set(g.competition, []).get(g.competition)!).push(g);
    }
    return [...byComp.entries()].map(([competition, list]) => {
      const sorted = [...list].sort((a, b) => (a.kickoff! < b.kickoff! ? -1 : 1));
      const byDay = new Map<string, PrematchGame[]>();
      for (const g of sorted) {
        const k = dayKey(g.kickoff!);
        (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(g);
      }
      // Ordena as competições pelo 1º horário (mais próximo primeiro).
      return { competition, first: sorted[0]?.kickoff ?? '', days: [...byDay.values()] };
    }).sort((a, b) => (a.first < b.first ? -1 : 1));
  }, [games]);

  const sidebar = <PrematchLeaguesSidebar facets={facets} selected={sel} onSelect={selectFromSidebar} onClear={clearSidebar} />;

  return (
    <div className="flex w-full items-start gap-4">
      {/* Sidebar — desktop (coluna fixa à esquerda) */}
      <aside className="sticky top-4 hidden w-64 shrink-0 self-start lg:block">{sidebar}</aside>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2">
          {/* Botão "Ligas" (mobile) abre o drawer da sidebar */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-gray-200 ring-1 ring-white/10 transition hover:bg-white/10 lg:hidden"
          >
            <ListFilter size={14} /> Ligas
          </button>
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <CalendarClock size={13} /> Próximas partidas
            <span className="text-gray-600">({games.length})</span>
          </h2>
        </div>

        {/* Abas de esporte (categoria de topo) — derivadas dos facets. Hoje só
            Futebol; novos esportes aparecem sozinhos. Rolam na horizontal (mobile). */}
        {facets.length > 0 && (
          <div className="mb-3 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <div className="flex w-max min-w-full gap-1 border-b border-white/10">
              {showAll && (
                <SportTab active={!sel.sport} icon="🏆" label="Todos" count={totalCount} onClick={() => selectSport('')} />
              )}
              {facets.map((f) => (
                <SportTab
                  key={f.sport}
                  active={sel.sport === f.sport}
                  icon={sportEmoji(f.sport)}
                  label={cap(f.sport)}
                  count={f.count}
                  onClick={() => selectSport(f.sport)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Chip do filtro de país/liga ativo (o esporte já está nas abas). */}
        {hasLeagueFilter && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-500/15 px-3 py-1 text-xs font-semibold text-lime-200 ring-1 ring-lime-500/30">
              {sel.label || 'Filtro'}
              <button onClick={clearSidebar} className="text-lime-300 transition hover:text-white" title="Limpar filtro"><X size={13} /></button>
            </span>
          </div>
        )}

        {/* Busca (time/liga) — refaz o catálogo. */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time ou liga…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
          />
        </div>

        {houseSlugs.length === 0 ? (
          <Empty>Esta instância ainda não tem casas.</Empty>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="animate-spin" size={16} /> Buscando jogos de pré-jogo…
          </div>
        ) : comps.length === 0 ? (
          <Empty>
            {hasLeagueFilter
              ? 'Nenhum jogo das suas casas nesta liga agora.'
              : 'Nenhum jogo de pré-jogo das casas da instância.'}
          </Empty>
        ) : (
          <>
            <div className="space-y-5">
              {comps.map(({ competition, days }) => (
                <div key={competition} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-1 border-b border-white/10 bg-black/20 px-3 py-2.5">
                    <span className="truncate text-sm font-bold text-white">{competition}</span>
                    <ChevronRight size={15} className="text-gray-500" />
                  </div>

                  {days.map((day) => (
                    <div key={dayKey(day[0].kickoff!)}>
                      <div className="border-b border-white/5 bg-black/10 px-3 py-1.5">
                        <span className="text-[11px] font-semibold text-gray-400">{dayLabel(day[0].kickoff!)}</span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {day.map((g) => (
                          <MatchRow key={g.key} game={g} onOpen={() => onOpen(g.bookmaker, g.eventId)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-5 py-2.5 text-sm font-medium text-gray-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
                  {loadingMore ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar — mobile (drawer deslizante) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[9998] flex lg:hidden">
          <div className="flex-1 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="flex h-full w-[300px] max-w-[85vw] flex-col border-l border-white/10 bg-brand-dark shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-bold text-white">Esportes e ligas</span>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 transition hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{sidebar}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

function MatchRow({ game, onOpen }: { game: PrematchGame; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.03]"
    >
      {/* Horário */}
      <span className="w-11 shrink-0 text-center text-[11px] font-semibold tabular-nums text-gray-300">
        {game.kickoff ? timeLabel(game.kickoff) : '—'}
      </span>

      {/* Times empilhados com escudo */}
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center gap-1.5">
          <TeamLogo name={game.home} size={18} />
          <span className="min-w-0 truncate text-xs font-medium text-white">{game.home}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <TeamLogo name={game.away} size={18} />
          <span className="min-w-0 truncate text-xs font-medium text-white">{game.away}</span>
        </span>
      </span>

      {/* Selo "Contas prontas" (nº de casas da instância com o jogo) */}
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-500/15 px-2 py-0.5 text-[10px] font-bold text-lime-200 ring-1 ring-lime-500/30"
        title={`${game.houses.length} casa(s) da instância com este jogo`}
      >
        <CheckCircle2 size={11} /> {game.houses.length}
      </span>

      <ChevronRight size={16} className="shrink-0 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
    </button>
  );
}
