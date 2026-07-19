import { useRouter } from 'next/router';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { useLiveGames } from '@/hooks/useLiveGames';
import { LiveGamesView } from '@/components/nodelay/LiveGamesView';

/**
 * Jogos AO VIVO da casa (fssb/ROGUE SSE) — a stream empurra placar e entrada/
 * saída de jogos. Só liga a fonte (useLiveGames) à view apresentacional
 * (LiveGamesView), compartilhada com a lista biahosted (Altenar/polling).
 */
export function LiveGamesList({ house }: { house: NoDelayBookmaker }) {
  const router = useRouter();
  const { games, loading, error, live } = useLiveGames(house);
  return (
    <LiveGamesView
      games={games}
      loading={loading}
      error={error}
      live={live}
      emptyLabel={`Nenhum jogo ao vivo em ${house.name} agora.`}
      onOpen={(g) => router.push(`/nodelay/${house.slug}/event/${g.id}`)}
    />
  );
}
