import { useCallback, useEffect, useState } from 'react';
import { serverManager, type ServerPreference, type ServerSnapshot } from '@/services/serverManager';

/**
 * Expõe o estado do serverManager para componentes React (login e modal de
 * conta): preferência, servidor ativo, latências e ações. Re-renderiza sempre
 * que o snapshot muda (ping, failover, troca de preferência).
 */
export function useServer() {
  const [snap, setSnap] = useState<ServerSnapshot>(() => serverManager.snapshot());

  useEffect(() => {
    // Assina antes de inicializar para não perder nenhuma notificação.
    const unsub = serverManager.subscribe(setSnap);
    serverManager.init();
    // Captura o estado atual caso tenha mudado entre o render e a subscrição.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap(serverManager.snapshot());
    return unsub;
  }, []);

  const setPreference = useCallback((pref: ServerPreference) => {
    serverManager.setPreference(pref);
  }, []);

  const refresh = useCallback(() => {
    void serverManager.pingAll();
  }, []);

  return { ...snap, setPreference, refresh };
}
