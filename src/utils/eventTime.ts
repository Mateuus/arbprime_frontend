// Formatação do HORÁRIO DE INÍCIO (kickoff) dos eventos das features de
// arbitragem: surebets/prematch, duplo green, value bets, middles e o catálogo
// de /events.
//
// CONVENÇÃO (decore): o campo `date`/`eventDate` que chega do backend é o horário
// de Brasília (GMT-3) "tagueado com Z" — ex.: "2026-06-30T22:00:00.000Z"
// representa 22:00 de BRASÍLIA, e NÃO 22:00 UTC. O relógio embutido na string já
// está em GMT-3; o sufixo Z é um quirk do pipeline (arbbetting_master). O campo
// `dateUTC` (UTC de verdade = date + 3h) NÃO vem nos payloads das listas, então
// não dá pra confiar nele aqui.
//
// Por isso formatamos com `timeZone: 'UTC'`: assim o wallclock embutido (já em
// GMT-3) é exibido VERBATIM, de forma determinística, independente do fuso do
// navegador. Ler como instante real e converter p/ America/Sao_Paulo (ou deixar
// o locale converter pro fuso local) subtrai 3h indevidos → mostra 22:00 como
// 19:00.
//
// ⚠️ NÃO usar estas funções em timestamps REAIS (create_at, "visto há…",
// histórico de preço, datas de pagamento). Esses são instantes UTC de verdade e
// devem ser formatados em America/Sao_Paulo.
//
// Se um dia o upstream normalizar os eventos para UTC de verdade, o ÚNICO ponto a
// mudar é o `TZ` abaixo (UTC → America/Sao_Paulo).

const TZ = 'UTC';

/** "dd/MM HH:mm" (ex.: "30/06 22:00"). Retorna null se a data for inválida. */
export const formatEventDateTime = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Sem a vírgula que o locale pt-BR coloca entre data e hora.
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return `${date} ${time}`;
};

/** Partes separadas { day: "dd/MM", time: "HH:mm" } p/ layouts empilhados. */
export const formatEventDateParts = (iso?: string | null): { day: string; time: string } => {
  if (!iso) return { day: '—', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', time: '' };
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  };
};
