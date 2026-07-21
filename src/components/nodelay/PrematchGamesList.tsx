import { useMemo } from 'react';
import { fmtOdd } from '@/utils/nodelayLive';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import { SAMPLE_PREMATCH_LIST, PrematchListMatch } from '@/services/nodelay/prematchSample';
import { BarChart3, Zap, ChevronRight } from 'lucide-react';

/**
 * LISTA de pré-jogo no estilo bet365 "Próximas Partidas". DADOS DE EXEMPLO
 * (SAMPLE_PREMATCH_LIST) — futuro: virá do nosso catálogo /events.
 *
 * Estrutura bet365:
 *  - agrupado por COMPETIÇÃO ("Brasileirão Série A ›");
 *  - dentro, sub-cabeçalhos de DATA ("Ter 21 Jul") que também carregam os rótulos
 *    das colunas 1 · X · 2;
 *  - cada linha: os dois times empilhados (com escudo), horário, chip de boost
 *    opcional, ícone de stats e as 3 odds 1X2 em ÂMBAR.
 *
 * Clicar numa partida navega pra PÁGINA de pré-jogo (rota /prematch/[eventId]).
 */

interface Props {
  matches?: PrematchListMatch[];
  onOpen: (id: string) => void;
}

/** "Ter 21 Jul" (capitalizado). */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const s = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return s.replace(/\./g, '').replace(/(^|\s)([a-zà-ú])/g, (_, sp, c) => sp + c.toUpperCase());
}
/** "19:30". */
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
/** Chave de dia p/ ordenar/agrupar (AAAA-MM-DD). */
const dayKey = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

export function PrematchGamesList({ matches = SAMPLE_PREMATCH_LIST, onOpen }: Props) {
  // Agrupa por competição → depois por dia, tudo ordenado por horário.
  const comps = useMemo(() => {
    const byComp = new Map<string, PrematchListMatch[]>();
    for (const m of matches) (byComp.get(m.competition) ?? byComp.set(m.competition, []).get(m.competition)!).push(m);
    return [...byComp.entries()].map(([competition, list]) => {
      const byDay = new Map<string, PrematchListMatch[]>();
      for (const m of [...list].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))) {
        (byDay.get(dayKey(m.kickoff)) ?? byDay.set(dayKey(m.kickoff), []).get(dayKey(m.kickoff))!).push(m);
      }
      return { competition, days: [...byDay.values()] };
    });
  }, [matches]);

  return (
    <div>
      {/* Chips de ligas (nice-to-have, decorativo por ora). */}
      <div className="mb-4 -mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-1.5">
          {['Melhores Ligas · 131', 'Brasil · 21', 'As Américas · 70', 'Europa · 40'].map((c, i) => (
            <span
              key={c}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                i === 0 ? 'bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/40' : 'bg-white/5 text-gray-400 ring-1 ring-white/10'
              }`}
            >
              {c} Partidas
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {comps.map(({ competition, days }) => (
          <div key={competition} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            {/* Cabeçalho da competição */}
            <div className="flex items-center gap-1 border-b border-white/10 bg-black/20 px-3 py-2.5">
              <span className="truncate text-sm font-bold text-white">{competition}</span>
              <ChevronRight size={15} className="text-gray-500" />
            </div>

            {days.map((day) => (
              <div key={dayKey(day[0].kickoff)}>
                {/* Sub-cabeçalho de data + rótulos 1 · X · 2 */}
                <div className="grid grid-cols-[1fr_repeat(3,3rem)] items-center gap-1.5 border-b border-white/5 bg-black/10 px-3 py-1.5 sm:grid-cols-[1fr_repeat(3,4rem)]">
                  <span className="text-[11px] font-semibold text-gray-400">{dayLabel(day[0].kickoff)}</span>
                  {['1', 'X', '2'].map((l) => (
                    <span key={l} className="text-center text-[11px] font-semibold text-gray-500">{l}</span>
                  ))}
                </div>

                <div className="divide-y divide-white/5">
                  {day.map((m) => (
                    <MatchRow key={m.id} match={m} onOpen={() => onOpen(m.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchRow({ match, onOpen }: { match: PrematchListMatch; onOpen: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_repeat(3,3rem)] items-center gap-1.5 px-3 py-2 transition hover:bg-white/[0.03] sm:grid-cols-[1fr_repeat(3,4rem)]">
      {/* Bloco clicável: horário + times + boost/stats → abre a página de pré-jogo */}
      <button onClick={onOpen} className="flex min-w-0 items-center gap-2.5 text-left">
        <span className="flex w-10 shrink-0 flex-col items-center gap-0.5">
          <span className="text-[11px] font-semibold tabular-nums text-gray-300">{timeLabel(match.kickoff)}</span>
          {match.boost && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-px text-[9px] font-bold text-amber-300 ring-1 ring-amber-500/30">
              <Zap size={8} className="fill-amber-300" /> {match.boost}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-1.5">
            <TeamLogo name={match.home} sofascoreId={match.homeSofaId} size={18} />
            <span className="min-w-0 truncate text-xs font-medium text-white">{match.home}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <TeamLogo name={match.away} sofascoreId={match.awaySofaId} size={18} />
            <span className="min-w-0 truncate text-xs font-medium text-white">{match.away}</span>
          </span>
        </span>
        <BarChart3 size={14} className="hidden shrink-0 text-gray-600 transition hover:text-lime-300 sm:block" />
      </button>

      {/* Odds 1X2 — âmbar (assinatura bet365). Clique abre a página (aposta prematch é futuro). */}
      <OddCell price={match.odds.home} onClick={onOpen} />
      <OddCell price={match.odds.draw} onClick={onOpen} />
      <OddCell price={match.odds.away} onClick={onOpen} />
    </div>
  );
}

function OddCell({ price, onClick }: { price: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center rounded-lg bg-black/25 px-1 py-2 text-sm font-bold tabular-nums text-amber-400 ring-1 ring-white/10 transition hover:ring-amber-500/40"
    >
      {fmtOdd(price)}
    </button>
  );
}
