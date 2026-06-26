import { useState, useEffect, useCallback } from 'react';
import { apiGateway, BankrollDTO, AccountDTO, PartnerDTO } from '@/gateways/api.gateway';
import { unwrap } from './format';

const SEL_KEY = 'analytix:selectedBankroll';

/**
 * Carrega as bancas do usuário e mantém a banca selecionada (persistida em
 * localStorage). selectedId === '' significa "todas as bancas".
 *
 * Observação: o estado só é atualizado APÓS o await (nunca de forma síncrona
 * dentro do efeito) — segue o padrão do codebase e a regra set-state-in-effect.
 */
export function useBankrolls() {
  const [bankrolls, setBankrolls] = useState<BankrollDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem(SEL_KEY) || '' : ''),
  );

  const reload = useCallback(async () => {
    try {
      const r = await apiGateway.getBankrolls();
      setBankrolls(unwrap<BankrollDTO[]>(r, []));
    } catch {
      setBankrolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getBankrolls();
        if (active) setBankrolls(unwrap<BankrollDTO[]>(r, []));
      } catch {
        if (active) setBankrolls([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined') localStorage.setItem(SEL_KEY, id);
  }, []);

  const selected = bankrolls.find((b) => b.id === selectedId) || null;

  return { bankrolls, selectedId, selected, select, loading, reload };
}

/** Carrega as casas (contas) do usuário. */
export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await apiGateway.getMyAccounts();
      setAccounts(unwrap<AccountDTO[]>(r, []));
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getMyAccounts();
        if (active) setAccounts(unwrap<AccountDTO[]>(r, []));
      } catch {
        if (active) setAccounts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { accounts, loading, reload };
}

/** Carrega os parceiros (donos de conta) do usuário, com apuração (report). */
export function usePartners() {
  const [partners, setPartners] = useState<PartnerDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const r = await apiGateway.getPartners();
      setPartners(unwrap<PartnerDTO[]>(r, []));
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getPartners();
        if (active) setPartners(unwrap<PartnerDTO[]>(r, []));
      } catch {
        if (active) setPartners([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { partners, loading, reload };
}
