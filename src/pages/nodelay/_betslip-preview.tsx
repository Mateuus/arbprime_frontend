import { useEffect, useRef } from 'react';
import { BetSlip } from '@/components/nodelay/BetSlip';
import { useBetSlip, SlipSelection } from '@/hooks/useBetSlip';

/**
 * PREVIEW STANDALONE do Cupom de Apostas (BetSlip) — SÓ para eyeball do design.
 * NÃO é uma página de produção. Semeia o hook com 2 seleções de exemplo (uma
 * prematch, uma ao vivo) e mostra o cupom montado. Rota: /nodelay/_betslip-preview
 *
 * No app real, a página do jogo é dona do hook e passa `slip.add` p/ os quadros de
 * odds (EventBoard/PrematchBoard) — ver o relatório de wiring.
 */

const SAMPLES: SlipSelection[] = [
  {
    id: 'demo-1',
    house: 'bet365',
    eventId: 'pm-1',
    eventLabel: 'Palmeiras x Flamengo',
    marketName: 'Resultado Final',
    selectionName: 'Palmeiras',
    odd: 2.10,
    kickoffLabel: '21 Jul 21:30',
    paTag: 'Pagamento Antecipado',
    homeSofaId: 1963,
    awaySofaId: 5981,
  },
  {
    id: 'demo-2',
    house: 'bet365',
    eventId: 'lv-99',
    eventLabel: 'UCV x Santos',
    marketName: 'Total de Gols',
    selectionName: 'Mais de 2.5',
    odd: 1.90,
    line: 'Mais de 2.5',
    live: true,
    homeSofaId: 63426,
    awaySofaId: 1084891,
  },
];

export default function BetSlipPreview() {
  const slip = useBetSlip('preview');
  const seeded = useRef(false);

  // Semeia uma vez (depois de hidratar). add() faz dedupe por id, então recarregar
  // não duplica; e stakes de exemplo p/ já ver os retornos.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const t = setTimeout(() => {
      SAMPLES.forEach((s) => { if (!slip.has(s.id)) slip.add(s); });
      slip.setStake('demo-1', 50);
      slip.setStake('demo-2', 20);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-brand-dark p-6 lg:pr-[400px]">
      <div className="mx-auto max-w-2xl">
        <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
          Preview · não é produção
        </span>
        <h1 className="mt-3 text-2xl font-bold text-white">Cupom de Apostas — Preview</h1>
        <p className="mt-2 text-sm text-gray-400">
          Componente <code className="rounded bg-white/10 px-1 text-lime-300">BetSlip</code> semeado com 2 seleções
          (uma prematch com Pagamento Antecipado, uma ao vivo). Alterne Simples / Múltipla, ajuste as stakes com os
          chips e veja os retornos. No mobile, use o gatilho flutuante &ldquo;Cupom&rdquo;.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => slip.add({
              id: `x-${Date.now()}`, house: 'bet365', eventId: `ev-${Date.now()}`,
              eventLabel: 'Grêmio x Internacional', marketName: 'Ambos Marcam', selectionName: 'Sim', odd: 1.72, live: false,
            })}
            className="rounded-lg bg-lime-500/15 px-3 py-2 text-sm font-semibold text-lime-200 ring-1 ring-lime-500/40 transition hover:bg-lime-500/25"
          >
            + Adicionar seleção aleatória
          </button>
          <button
            onClick={slip.clear}
            className="rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            Limpar cupom
          </button>
        </div>
      </div>

      <BetSlip slip={slip} houseLabel="bet365" />
    </div>
  );
}
