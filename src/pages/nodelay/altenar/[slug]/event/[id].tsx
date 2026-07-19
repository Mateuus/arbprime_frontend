import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { AltenarEventBody } from '@/components/nodelay/AltenarEventBody';

/**
 * STANDALONE (biahosted/Altenar) — página do evento por polling REST. Rota:
 * /nodelay/altenar/<slug>/event/<eventId>. O corpo (placar + odds) é o
 * `AltenarEventBody`, compartilhado com o branch biahosted da instância.
 */
export default function AltenarEventPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const eventId = typeof router.query.id === 'string' ? router.query.id : '';
  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { bookmakers, denied } = useNoDelay(isAuthenticated);

  const house = useMemo(() => bookmakers.find((b) => b.slug === slug), [bookmakers, slug]);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        <AltenarEventBody
          house={house}
          eventId={eventId}
          onBack={() => router.push(`/nodelay/altenar/${slug}`)}
          backLabel="Jogos ao vivo"
        />
      </div>
    </NoDelayGate>
  );
}
