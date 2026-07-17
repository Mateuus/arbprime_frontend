import { LiveGameDetail } from '@/services/nodelay/rogueModel';
import { scoreOf, clockOf } from '@/utils/nodelayLive';
import { Radio } from 'lucide-react';

/**
 * Cabeçalho do evento: placar e relógio, do dado nativo da casa (Score +
 * LiveGameState). Independe do iframe do radar — se o radar não carregar, isto
 * continua de pé. (As estatísticas detalhadas ficam no radar por enquanto.)
 */
export function LiveScoreboard({ game }: { game: LiveGameDetail }) {
  const score = scoreOf(game);
  const clock = clockOf(game);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {/* Liga + estado */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-black/20 px-4 py-2">
        <div className="min-w-0 truncate text-[11px] text-gray-400">
          {game.sportName} · {game.regionName} · {game.competitionName}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
            <Radio size={9} className="animate-pulse" /> AO VIVO
          </span>
        </div>
      </div>

      {/* Placar */}
      <div className="px-4 py-4">
        {clock && <div className="mb-2 text-center text-xs font-semibold tabular-nums text-lime-300">{clock}</div>}
        <div className="flex items-center justify-center gap-4">
          <div className="min-w-0 flex-1 text-right text-sm font-semibold text-white sm:text-base">{game.home}</div>
          <div className="shrink-0 rounded-lg bg-black/30 px-3 py-1.5 text-xl font-bold tabular-nums text-white ring-1 ring-white/10 sm:text-2xl">
            {score ? `${score.home} - ${score.away}` : '–'}
          </div>
          <div className="min-w-0 flex-1 text-left text-sm font-semibold text-white sm:text-base">{game.away}</div>
        </div>
      </div>
    </div>
  );
}
