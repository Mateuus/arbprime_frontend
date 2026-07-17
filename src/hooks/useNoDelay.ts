import { useState, useEffect, useCallback } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayBookmaker, NoDelayAccount } from '@/interfaces/nodelay.interface';

/**
 * Dados do NoDelay (casas liberadas + contas do usuário).
 *
 * Sem WebSocket nosso de propósito: o estado que importa (sessão viva) é do
 * BROWSER, não do servidor — quem loga é o front. O backend só guarda o último
 * snapshot, então buscar sob demanda basta; `reload` é chamado depois de cada
 * ação (conectar, remover, saldo) para refletir o que acabou de mudar.
 */

interface UseNoDelayResult {
  bookmakers: NoDelayBookmaker[];
  accounts: NoDelayAccount[];
  loading: boolean;
  /** 403 do requireLevel: o usuário não tem nível 3. */
  denied: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setAccounts: React.Dispatch<React.SetStateAction<NoDelayAccount[]>>;
}

const errText = (e: unknown, fb: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

const isForbidden = (e: unknown): boolean =>
  (e as { response?: { status?: number } })?.response?.status === 403;

export function useNoDelay(enabled: boolean, bookmakerSlug?: string): UseNoDelayResult {
  const [bookmakers, setBookmakers] = useState<NoDelayBookmaker[]>([]);
  const [accounts, setAccounts] = useState<NoDelayAccount[]>([]);
  // Já nasce carregando quando há o que buscar — evita o flash de "vazio".
  const [loading, setLoading] = useState(enabled);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const [hb, ha] = await Promise.all([
        apiGateway.getNoDelayBookmakers(),
        apiGateway.getNoDelayAccounts(bookmakerSlug),
      ]);
      if (hb.data?.result === 1) setBookmakers(hb.data.data || []);
      if (ha.data?.result === 1) setAccounts(ha.data.data || []);
      setDenied(false);
    } catch (e) {
      if (isForbidden(e)) setDenied(true);
      else setError(errText(e, 'Não foi possível carregar o NoDelay.'));
    } finally {
      setLoading(false);
    }
  }, [enabled, bookmakerSlug]);

  useEffect(() => {
    // Busca inicial (mesmo padrão do resto do app): o setState mora dentro do
    // reload assíncrono, não no corpo do efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { bookmakers, accounts, loading, denied, error, reload, setAccounts };
}
