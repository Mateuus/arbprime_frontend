import ArbBetsPage from './index';

/**
 * Duplo Green (DG): reusa a página de surebets com o feed 'duplogreen'. O backend
 * roteia o type pela key Redis DuploGreenPrematch (mesmo shape SurebetData), então
 * toda a UI de filtros/cards/modais é reaproveitada — só muda a fonte, o badge PA
 * nas pontas casa/fora e o piso de lucro (aceita margem negativa).
 */
export default function DuploGreenPage() {
  return <ArbBetsPage feed="duplogreen" />;
}
