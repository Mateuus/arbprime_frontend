import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * Estado do CUPOM DE APOSTAS ("betslip" estilo bet365) do NoDelay.
 *
 * ATENÇÃO — NÃO confundir com a "Aposta Rápida": aquela dispara A MESMA entrada
 * em várias contas de uma vez (ver BetSlipCard/BetSlipDrawer, que são os RESULTADOS
 * por conta). Este cupom é o de UM apostador montando UMA aposta (simples ou
 * múltipla) numa casa — prematch OU ao vivo — antes de confirmar.
 *
 * O estado é POR INSTÂNCIA (localStorage `nodelay:betslip:<instanceId>`), então
 * cada instância/casa tem o seu cupom e ele sobrevive ao F5.
 *
 * A colocação real (disparo na casa) ainda é FUTURO — o botão "Fazer aposta" é
 * mock. Ver `// TODO(place)` no BetSlip.tsx.
 */

/** Uma seleção no cupom. `id` = id APOSTÁVEL da seleção (dedupe por ele). */
export interface SlipSelection {
  id: string;
  house: string;
  eventId: string;
  eventLabel: string; // "Palmeiras x Flamengo"
  marketName: string; // "Resultado Final"
  selectionName: string; // "Palmeiras" / "Mais de 2.5"
  odd: number;
  line?: string | null; // linha bruta ("Mais de 2.5"), quando útil
  kickoffLabel?: string; // "21 Jul 21:30" (prematch) — vazio no ao vivo
  live?: boolean; // true = Ao Vivo (mostra selo em vez do horário)
  /** Tag verde itálica opcional (ex.: "Pagamento Antecipado"). */
  paTag?: string;
  homeSofaId?: number; // escudo do mandante (SoFaScore)
  awaySofaId?: number;
}

export type SlipMode = 'simples' | 'multipla' | 'sistema';

/** Máximo de seleções no cupom (a bet365 mostra "N/30"). */
export const SLIP_MAX = 30;

/** Placeholder do "MÁX" nos chips de stake até ligar saldo/maxStake reais. */
// TODO(maxstake): trocar por saldo da conta / maxStakeOf() do mercado quando ligar.
export const SLIP_MAX_STAKE = 500;

interface PersistShape {
  selections: SlipSelection[];
  stakes: Record<string, number>;
  multiStake: number;
  mode: SlipMode;
}

const keyFor = (instanceId: string) => `nodelay:betslip:${instanceId}`;

function load(instanceId: string): PersistShape {
  const empty: PersistShape = { selections: [], stakes: {}, multiStake: 0, mode: 'simples' };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(keyFor(instanceId));
    if (!raw) return empty;
    const p = JSON.parse(raw) as Partial<PersistShape>;
    return {
      selections: Array.isArray(p.selections) ? p.selections : [],
      stakes: p.stakes && typeof p.stakes === 'object' ? p.stakes : {},
      multiStake: typeof p.multiStake === 'number' ? p.multiStake : 0,
      mode: p.mode === 'multipla' || p.mode === 'sistema' ? p.mode : 'simples',
    };
  } catch {
    return empty;
  }
}

export interface BetSlipApi {
  selections: SlipSelection[];
  mode: SlipMode;
  count: number;
  full: boolean; // atingiu o SLIP_MAX
  /** Adiciona (ou alterna) uma seleção. Regras de dedupe abaixo. */
  add: (sel: SlipSelection) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  setStake: (id: string, v: number) => void;
  bumpStake: (id: string, delta: number) => void; // chips +10/+50/+200
  stakeOf: (id: string) => number;
  setMultiStake: (v: number) => void;
  multiStake: number;
  setMode: (m: SlipMode) => void;
  /** Odd combinada da múltipla = produto de todas as odds. */
  multiOdds: number;
  /** Retorno potencial de UMA seleção (modo simples): stake × odd. */
  returnOf: (id: string) => number;
  /** Totais conforme o modo atual. */
  totals: { totalStake: number; totalReturn: number };
}

export function useBetSlip(instanceId: string): BetSlipApi {
  const [selections, setSelections] = useState<SlipSelection[]>([]);
  const [stakes, setStakes] = useState<Record<string, number>>({});
  const [multiStake, setMultiStakeState] = useState(0);
  const [mode, setModeState] = useState<SlipMode>('simples');
  const hydrated = useRef(false);

  // Hidrata do localStorage no mount / quando troca a instância.
  useEffect(() => {
    const p = load(instanceId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelections(p.selections);
    setStakes(p.stakes);
    setMultiStakeState(p.multiStake);
    setModeState(p.mode);
    hydrated.current = true;
  }, [instanceId]);

  // Persiste em qualquer mudança (só depois de hidratar, p/ não sobrescrever com vazio).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      const shape: PersistShape = { selections, stakes, multiStake, mode };
      window.localStorage.setItem(keyFor(instanceId), JSON.stringify(shape));
    } catch { /* */ }
  }, [instanceId, selections, stakes, multiStake, mode]);

  const add = useCallback((sel: SlipSelection) => {
    setSelections((prev) => {
      // Mesma seleção (mesmo id) → ALTERNA: clicar de novo tira do cupom (toggle
      // click-to-add/remove direto do quadro de odds).
      if (prev.some((s) => s.id === sel.id)) return prev.filter((s) => s.id !== sel.id);
      if (prev.length >= SLIP_MAX) return prev; // cupom cheio
      // Outra seleção do MESMO evento+mercado → SUBSTITUI (não dá p/ apostar em 2
      // resultados do mesmo mercado numa aposta só; escolher outro troca — igual bet365).
      const clash = prev.find((s) => s.eventId === sel.eventId && s.marketName === sel.marketName);
      const base = clash ? prev.filter((s) => s.id !== clash.id) : prev;
      return [...base, sel];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
    setStakes((prev) => {
      if (!(id in prev)) return prev;
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);

  const clear = useCallback(() => {
    setSelections([]);
    setStakes({});
    setMultiStakeState(0);
  }, []);

  const has = useCallback((id: string) => selections.some((s) => s.id === id), [selections]);

  const setStake = useCallback((id: string, v: number) => {
    setStakes((prev) => ({ ...prev, [id]: Math.max(0, v) }));
  }, []);

  const bumpStake = useCallback((id: string, delta: number) => {
    setStakes((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }, []);

  const stakeOf = useCallback((id: string) => stakes[id] ?? 0, [stakes]);

  const setMultiStake = useCallback((v: number) => setMultiStakeState(Math.max(0, v)), []);

  const setMode = useCallback((m: SlipMode) => setModeState(m), []);

  // Odd combinada da múltipla = produto das odds (1 se vazio).
  const multiOdds = useMemo(
    () => selections.reduce((acc, s) => acc * (s.odd > 0 ? s.odd : 1), 1),
    [selections],
  );

  const returnOf = useCallback(
    (id: string) => {
      const sel = selections.find((s) => s.id === id);
      if (!sel) return 0;
      return (stakes[id] ?? 0) * sel.odd;
    },
    [selections, stakes],
  );

  const totals = useMemo(() => {
    if (mode === 'multipla') {
      // Múltipla: UMA aposta, uma stake, retorno = stake × produto das odds.
      return { totalStake: multiStake, totalReturn: multiStake * multiOdds };
    }
    // Simples (e sistema como stub): uma stake por seleção, soma tudo.
    let stake = 0;
    let ret = 0;
    for (const s of selections) {
      const st = stakes[s.id] ?? 0;
      stake += st;
      ret += st * s.odd;
    }
    return { totalStake: stake, totalReturn: ret };
  }, [mode, multiStake, multiOdds, selections, stakes]);

  return {
    selections,
    mode,
    count: selections.length,
    full: selections.length >= SLIP_MAX,
    add,
    remove,
    clear,
    has,
    setStake,
    bumpStake,
    stakeOf,
    setMultiStake,
    multiStake,
    setMode,
    multiOdds,
    returnOf,
    totals,
  };
}
