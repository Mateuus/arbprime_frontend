import { useEffect, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';

/**
 * Handle do próprio usuário na Comunidade (cache em nível de módulo). Usado para
 * esconder o botão "Seguir" no próprio perfil/card sem depender só do backend.
 */
let cached: string | null | undefined; // undefined = desconhecido, null = sem perfil/anônimo
let inflight: Promise<string | null> | null = null;
const listeners = new Set<(h: string | null) => void>();

function loadOnce(): Promise<string | null> {
  if (inflight) return inflight;
  inflight = apiGateway.getMyCommunityProfile()
    .then((r) => {
      const p = r.data?.result === 1 ? r.data.data?.profile : null;
      cached = (p?.handle ?? null) as string | null;
      listeners.forEach((l) => l(cached as string | null));
      return cached as string | null;
    })
    .catch(() => { cached = null; return null as string | null; });
  return inflight;
}

export function useMyHandle(): string | null {
  const { isAuthenticated } = useUserContext();
  const [h, setH] = useState<string | null>(cached ?? null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    listeners.add(setH);
    loadOnce().then((v) => { if (active) setH(v); });
    return () => { active = false; listeners.delete(setH); };
  }, [isAuthenticated]);

  return h;
}
