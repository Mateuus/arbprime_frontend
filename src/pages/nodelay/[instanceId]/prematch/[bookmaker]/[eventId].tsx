import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { PrematchBoard } from '@/components/nodelay/PrematchBoard';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance } from '@/interfaces/nodelay.interface';
import { Loader2 } from 'lucide-react';

/**
 * Página de PRÉ-JOGO (rota separada da ao vivo — sem toggle). Renderiza o board de
 * pré-jogo (PrematchBoard) com DADOS REAIS do catálogo /events, filtrados às casas
 * da INSTÂNCIA (instance.houseSlugs = Contas prontas).
 *
 * A rota carrega a CASA (bookmaker) + o eventId do jogo escolhido na lista. O grupo
 * canônico é resolvido a partir dessa casa (usePrematchEventGroup). DISPLAY-ONLY:
 * apostar no pré-jogo é futuro (o catálogo não tem os ids apostáveis).
 */
export default function NoDelayPrematchEventPage() {
  const router = useRouter();
  const instanceId = typeof router.query.instanceId === 'string' ? router.query.instanceId : '';
  const bookmaker = typeof router.query.bookmaker === 'string' ? router.query.bookmaker : '';
  const eventId = typeof router.query.eventId === 'string' ? router.query.eventId : '';

  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { denied } = useNoDelay(isAuthenticated);

  const [instance, setInstance] = useState<NoDelayInstance | null>(null);
  const [loadingInst, setLoadingInst] = useState(true);

  const loadInstance = useCallback(async () => {
    if (!instanceId) return;
    try {
      const r = await apiGateway.getNoDelayInstance(instanceId);
      if (r.data?.result === 1) setInstance(r.data.data);
    } finally {
      setLoadingInst(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!isAuthenticated || !instanceId) return;
    void loadInstance();
  }, [isAuthenticated, instanceId, loadInstance]);

  const houseSlugs = instance?.houseSlugs ?? [];

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        {loadingInst ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="animate-spin" size={18} /> Carregando…
          </div>
        ) : (
          // O ← do hero do PrematchBoard volta para a instância.
          <PrematchBoard
            bookmaker={bookmaker}
            eventId={eventId}
            houseSlugs={houseSlugs}
            onBack={() => router.push(`/nodelay/${instanceId}?tab=prematch`)}
            onOpenEvent={(bm, id) => router.push(`/nodelay/${instanceId}/prematch/${bm}/${id}`)}
          />
        )}
      </div>
    </NoDelayGate>
  );
}
