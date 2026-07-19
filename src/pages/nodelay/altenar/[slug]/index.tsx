import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { useAltenarLiveGames } from '@/hooks/useAltenarLiveGames';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { LiveGamesView } from '@/components/nodelay/LiveGamesView';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { ArrowLeft, AlertTriangle, Radio } from 'lucide-react';

/**
 * STANDALONE (biahosted/Altenar) — jogos ao vivo de UMA casa, por polling REST.
 * É a tela de testes do fluxo Altenar (lista → abre → página do evento), separada
 * do fluxo de instâncias/fssb (o "wire" multi-plataforma vem depois). Rota:
 * /nodelay/altenar/<slug> (ex.: /nodelay/altenar/estrelabet).
 */
export default function AltenarLivePage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { bookmakers, denied } = useNoDelay(isAuthenticated);

  const house = useMemo(() => bookmakers.find((b) => b.slug === slug), [bookmakers, slug]);
  const isBia = house?.platform === 'biahosted';
  // Precisa do host de odds + integration (vêm do DTO do backend). Se faltarem,
  // é config incompleta OU backend não reiniciado após expor esses campos.
  const configured = isBia && !!house?.oddsUrl;
  const { games, loading, error, live } = useAltenarLiveGames(configured ? house : undefined);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        <button
          onClick={() => router.push('/nodelay')}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-lime-300"
        >
          <ArrowLeft size={14} /> NoDelay
        </button>

        {!house ? (
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <AlertTriangle className="mx-auto text-amber-400" size={26} />
            <p className="mt-3 text-sm text-gray-300">Casa <b>{slug}</b> não encontrada.</p>
          </div>
        ) : !isBia ? (
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <AlertTriangle className="mx-auto text-amber-400" size={26} />
            <p className="mt-3 text-sm text-gray-300">{house.name} não é uma casa biahosted (Altenar).</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2.5">
              <BookmakerLogo name={house.name} slug={house.slug} logoUrl={house.logoUrl} color={house.color} size={26} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-bold text-white">
                  {house.name}
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                    <Radio size={9} className={live ? 'animate-pulse' : ''} /> Ao vivo · Altenar
                  </span>
                </div>
                <div className="text-[11px] text-gray-500">Odds por polling REST (integração {house.integration || house.slug}).</div>
              </div>
            </div>

            <LiveGamesView
              games={games}
              loading={loading}
              error={error}
              live={live}
              emptyLabel={`Nenhum jogo ao vivo em ${house.name} agora.`}
              onOpen={(g) => router.push(`/nodelay/altenar/${house.slug}/event/${g.id}`)}
            />
          </>
        )}
      </div>
    </NoDelayGate>
  );
}
