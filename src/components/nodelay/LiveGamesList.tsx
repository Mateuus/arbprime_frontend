import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { useLiveGames } from '@/hooks/useLiveGames';
import { LiveGame } from '@/services/nodelay/rogueModel';
import { scoreOf, clockOf } from '@/utils/nodelayLive';
import { Loader2, Radio, AlertTriangle, ChevronRight, Search } from 'lucide-react';

/**
 * Jogos AO VIVO da casa, de TODOS os esportes — como o site 7games: abas por
 * esporte no topo, e dentro de cada uma os jogos agrupados por liga. Tempo real
 * (ROGUE SSE): a stream empurra placar e a entrada/saída de jogos sozinha.
 */

// E-sports vêm com nomes soltos (Valorant, CS2, FIFA…); o site junta num só.
const ESPORTS = /valorant|cs2|cs:?go|counter|nba2k|fifa|e-?futebol|e-?football|dota|lol|league of legends|rocket league/i;
const sportBucketName = (name: string): string => (ESPORTS.test(name) ? 'E-Sports' : name || 'Outros');

export function LiveGamesList({ house }: { house: NoDelayBookmaker }) {
  const router = useRouter();
  const { games, loading, error, live } = useLiveGames(house);
  const [sport, setSport] = useState<string | null>(null); // null = Todos
  const [q, setQ] = useState('');

  // Abas de esporte (agrupa e-sports; ordena por SportOrder da casa).
  const sports = useMemo(() => {
    const map = new Map<string, { name: string; order: number; count: number }>();
    for (const g of games) {
      const name = sportBucketName(g.sportName);
      const cur = map.get(name);
      if (cur) cur.count += 1;
      else map.set(name, { name, order: g.sportOrder, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [games]);

  // Jogos da aba ativa + busca, agrupados por liga.
  const leagues = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = games.filter((g) => {
      if (sport && sportBucketName(g.sportName) !== sport) return false;
      if (term && ![g.home, g.away, g.competitionName].some((v) => v.toLowerCase().includes(term))) return false;
      return true;
    });
    const by = new Map<string, { name: string; sportOrder: number; games: LiveGame[] }>();
    for (const g of list) {
      const key = `${g.sportName}— ${g.competitionName || 'Outros'}`;
      const label = sport ? (g.competitionName || 'Outros') : `${g.sportName} · ${g.competitionName || 'Outros'}`;
      const b = by.get(key) ?? { name: label, sportOrder: g.sportOrder, games: [] };
      b.games.push(g);
      by.set(key, b);
    }
    return [...by.values()]
      .map((b) => ({ ...b, games: b.games.sort((x, y) => x.home.localeCompare(y.home)) }))
      .sort((a, b) => a.sportOrder - b.sportOrder || a.name.localeCompare(b.name));
  }, [games, sport, q]);

  if (loading && games.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
        <Loader2 className="animate-spin" size={16} /> Buscando jogos ao vivo…
      </div>
    );
  }

  if (error && games.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/30">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
        Nenhum jogo ao vivo em {house.name} agora.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Abas de esporte */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          <Chip on={!sport} onClick={() => setSport(null)} label="Todos" count={games.length} />
          {sports.map((s) => (
            <Chip key={s.name} on={sport === s.name} onClick={() => setSport(s.name)} label={s.name} count={s.count} />
          ))}
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar time ou liga…"
          className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-500 transition focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/30 sm:w-72"
        />
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
          Nenhum jogo bate com a busca.
        </div>
      ) : (
        leagues.map((b) => (
          <div key={b.name}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {b.name} <span className="text-gray-600">({b.games.length})</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {b.games.map((g) => (
                <GameRow key={g.id} game={g} onOpen={() => router.push(`/nodelay/${house.slug}/event/${g.id}`)} />
              ))}
            </div>
          </div>
        ))
      )}

      {!live && (
        <div className="pt-1 text-center text-[10px] text-gray-600">Reconectando ao vivo…</div>
      )}
    </div>
  );
}

function Chip({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition ${
        on ? 'bg-lime-500/15 text-lime-200 ring-lime-500/40' : 'bg-white/5 text-gray-400 ring-white/10 hover:bg-white/10'
      }`}
    >
      {label} <span className={`ml-1 text-[10px] ${on ? 'text-lime-400/70' : 'text-gray-600'}`}>{count}</span>
    </button>
  );
}

function GameRow({ game, onOpen }: { game: LiveGame; onOpen: () => void }) {
  const score = scoreOf(game);
  const clock = clockOf(game);
  const hasNames = !!(game.home || game.away);

  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-lime-500/30 hover:bg-white/[0.05]"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] text-gray-500">{game.competitionName || game.sportName}</span>
        {clock && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tabular-nums text-lime-300">
            <Radio size={8} className="animate-pulse" /> {clock}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate text-xs text-white">{game.home || '—'}</div>
          <div className="truncate text-xs text-white">{game.away || '—'}</div>
        </div>
        {score && (
          <div className="shrink-0 space-y-0.5 text-right">
            <div className="text-xs font-bold tabular-nums text-lime-300">{score.home}</div>
            <div className="text-xs font-bold tabular-nums text-lime-300">{score.away}</div>
          </div>
        )}
        <ChevronRight size={14} className="shrink-0 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
      </div>

      {hasNames && game.marketsCount > 0 && (
        <div className="mt-1.5 text-[10px] text-gray-600">{game.marketsCount} mercados</div>
      )}
    </button>
  );
}
