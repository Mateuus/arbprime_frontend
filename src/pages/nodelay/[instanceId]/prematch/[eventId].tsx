import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { PrematchBoard } from '@/components/nodelay/PrematchBoard';
import { findPrematchEvent } from '@/services/nodelay/prematchSample';

/**
 * Página de PRÉ-JOGO (rota separada da página ao vivo — sem toggle). Renderiza o
 * board de pré-jogo (PrematchBoard) do evento escolhido na lista de pré-jogo.
 *
 * DADOS DE EXEMPLO: o evento é resolvido por id em findPrematchEvent (amostra);
 * futuro = catálogo /events. NÃO tem painel de contas/disparo ainda (apostar
 * prematch é futuro) — página standalone, mas com o mesmo chrome (voltar,
 * full-width, NoDelayGate) das demais.
 */
export default function NoDelayPrematchEventPage() {
  const router = useRouter();
  const instanceId = typeof router.query.instanceId === 'string' ? router.query.instanceId : '';
  const eventId = typeof router.query.eventId === 'string' ? router.query.eventId : '';

  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { denied } = useNoDelay(isAuthenticated);

  const event = findPrematchEvent(eventId);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        {/* Sem "← Próximas partidas" aqui: o ← do hero do PrematchBoard já volta. */}
        <PrematchBoard
          event={event}
          onBack={() => router.push(`/nodelay/${instanceId}`)}
          onOpenEvent={(id) => router.push(`/nodelay/${instanceId}/prematch/${id}`)}
        />
      </div>
    </NoDelayGate>
  );
}
