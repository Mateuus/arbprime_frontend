import { marketLabel } from './surebet';

// Explicação didática de um mercado: o que cada seleção significa, exemplos de
// placar e como (ou se) o conjunto cobre todos os resultados. Se molda conforme
// o mercado (família detectada pelo slug). Usado no modal de ajuda [?].

export interface ExplainRow {
  selection: string;
  condition: string;
  examples?: string;
}

export interface MarketExplain {
  title: string;
  summary: string;
  rows: ExplainRow[];
  coverage: string; // frase sobre cobertura (completa / por linha / parcial)
}

const familyOf = (slug: string): string => {
  if (slug.startsWith('match-winner')) return '1x2';
  if (slug === 'double-chance-and-btts') return 'dc-btts';
  if (slug.startsWith('double-chance')) return 'dc';
  if (slug === 'result-and-btts') return 'r-btts';
  if (slug === 'result-and-total-goals') return 'r-tg';
  if (slug === 'half-time-full-time') return 'htft';
  if (slug === 'correct-score') return 'cs';
  if (slug === 'btts-both-halves') return 'btts2h';
  if (slug.startsWith('both-teams-to-score')) return 'btts';
  if (slug.startsWith('draw-no-bet')) return 'dnb';
  if (slug.startsWith('european-handicap')) return 'eh';
  if (slug.includes('handicap')) return 'ah';
  if (slug.includes('odd-even')) return 'oe';
  if (slug.includes('over-under') || slug.includes('goal-line') || slug === 'goals-band') return 'ou';
  if (slug.endsWith('-result') || slug.includes('-result-')) return 'teamresult';
  if (slug === 'to-qualify') return 'qualify';
  if (slug === 'first-goal') return 'firstgoal';
  if (slug.startsWith('exact-goals')) return 'exact';
  if (slug === 'half-with-most-goals') return 'halfmost';
  return 'generic';
};

export function explainMarket(marketId: string, home = 'Casa', away = 'Fora'): MarketExplain {
  const slug = (marketId || '').split(':')[0];
  const fam = familyOf(slug);
  const name = marketLabel(marketId);
  const H = home || 'Casa';
  const A = away || 'Fora';

  switch (fam) {
    case '1x2':
      return {
        title: name,
        summary: 'Aposta em quem vence a partida (ou empate). As 3 opções cobrem todos os resultados.',
        rows: [
          { selection: `1 — ${H}`, condition: `${H} > ${A}`, examples: '2-0, 1-0, 3-1' },
          { selection: 'X — Empate', condition: `${H} = ${A}`, examples: '0-0, 1-1, 2-2' },
          { selection: `2 — ${A}`, condition: `${A} > ${H}`, examples: '0-1, 1-2' }
        ],
        coverage: 'Cobertura completa: todo placar é vitória da casa, empate ou vitória do visitante.'
      };
    case 'dc':
      return {
        title: name,
        summary: 'Dupla chance: cada opção cobre 2 dos 3 resultados. Uma surebet aqui combina opções complementares entre casas.',
        rows: [
          { selection: '1X', condition: `${H} vence OU empate (${H} não perde)`, examples: '1-0, 0-0' },
          { selection: '12', condition: `${H} vence OU ${A} vence (não empata)`, examples: '2-0, 0-1' },
          { selection: 'X2', condition: `empate OU ${A} vence (${A} não perde)`, examples: '0-0, 0-2' }
        ],
        coverage: 'Cada opção cobre 2/3 dos resultados; combinações complementares garantem todos os cenários.'
      };
    case 'btts':
      return {
        title: name,
        summary: 'Ambas as equipes marcam. Duas opções que cobrem todos os jogos.',
        rows: [
          { selection: 'Sim', condition: `${H} ≥ 1 e ${A} ≥ 1`, examples: '1-1, 2-1, 3-2' },
          { selection: 'Não', condition: 'pelo menos uma equipe não marca', examples: '0-0, 1-0, 0-2' }
        ],
        coverage: 'Cobertura completa: ou os dois marcam, ou não.'
      };
    case 'dnb':
      return {
        title: name,
        summary: 'Empate anula: aposta em quem vence; se empatar, a aposta é devolvida (stake de volta).',
        rows: [
          { selection: `${H}`, condition: `${H} vence (empate devolve)`, examples: '1-0, 2-1' },
          { selection: `${A}`, condition: `${A} vence (empate devolve)`, examples: '0-1, 1-2' }
        ],
        coverage: 'Mercado de 2 vias com devolução no empate — na surebet o empate zera (nem lucro nem perda nas pernas devolvidas).'
      };
    case 'ou':
      return {
        title: name,
        summary: 'Mais/Menos sobre uma linha (X). Para a mesma linha, as duas opções cobrem todos os totais.',
        rows: [
          { selection: 'Mais de X', condition: 'total acima da linha', examples: 'linha 2.5 → 3+ gols' },
          { selection: 'Menos de X', condition: 'total abaixo da linha', examples: 'linha 2.5 → 0,1,2 gols' }
        ],
        coverage: 'Cobertura completa por linha. Em linha cheia (ex.: 2.0/3.0), o valor exato devolve a aposta (push).'
      };
    case 'ah':
      return {
        title: name,
        summary: 'Handicap (asiático/de linha): aplica uma vantagem/desvantagem de gols a uma equipe.',
        rows: [
          { selection: 'H1 (linha)', condition: `${H} com o handicap aplicado`, examples: `H1(-0.5): ${H} precisa vencer` },
          { selection: 'H2 (linha)', condition: `${A} com o handicap aplicado`, examples: `H2(+0.5): ${A} empata ou vence` }
        ],
        coverage: 'Duas vias para a MESMA linha. Linhas quebradas (ex.: ±0.25/±0.75) podem gerar meia-devolução — confira a linha.'
      };
    case 'eh':
      return {
        title: name,
        summary: 'Handicap europeu: 3 vias (casa/empate/fora) já com a vantagem de gols aplicada ao placar.',
        rows: [
          { selection: `1 — ${H} (linha)`, condition: `${H} vence já com o handicap` },
          { selection: 'X — Empate (linha)', condition: 'placar fica empatado após o handicap' },
          { selection: `2 — ${A} (linha)`, condition: `${A} vence já com o handicap` }
        ],
        coverage: 'Cobertura completa para a mesma linha (3 vias).'
      };
    case 'r-btts':
      return {
        title: name,
        summary: 'Resultado × Ambas Marcam: combina o resultado (3) com BTTS (2) = 6 opções que cobrem TODOS os placares.',
        rows: [
          { selection: `${H} / Sim`, condition: `${H} > ${A} e ${A} ≥ 1`, examples: '2-1, 3-1' },
          { selection: `${H} / Não`, condition: `${H} > ${A} e ${A} = 0`, examples: '1-0, 2-0' },
          { selection: 'Empate / Sim', condition: `${H} = ${A} ≥ 1`, examples: '1-1, 2-2' },
          { selection: 'Empate / Não', condition: `${H} = ${A} = 0`, examples: 'só 0-0' },
          { selection: `${A} / Sim`, condition: `${A} > ${H} e ${H} ≥ 1`, examples: '1-2, 2-3' },
          { selection: `${A} / Não`, condition: `${A} > ${H} e ${H} = 0`, examples: '0-1, 0-2' }
        ],
        coverage: 'Cobertura completa: cada placar cai em exatamente 1 das 6 opções (sem buraco, sem sobreposição).'
      };
    case 'htft':
      return {
        title: name,
        summary: 'Intervalo/Final: combina o resultado do 1º tempo com o resultado final = 9 combinações que cobrem todos os jogos.',
        rows: [
          { selection: `${H}/${H}`, condition: `lidera no intervalo e vence` },
          { selection: 'Empate/Final…', condition: 'empata no intervalo e o final pode ser 1/X/2' },
          { selection: '… (9 combos)', condition: '3 (intervalo) × 3 (final) = 9 opções' }
        ],
        coverage: 'Cobertura completa: todo jogo tem um resultado no intervalo e um no final → 1 das 9 combinações.'
      };
    case 'oe':
      return {
        title: name,
        summary: 'Total ímpar ou par. Duas opções que cobrem todos os totais.',
        rows: [
          { selection: 'Ímpar', condition: 'total é ímpar', examples: '1, 3, 5' },
          { selection: 'Par', condition: 'total é par (0 conta como par)', examples: '0, 2, 4' }
        ],
        coverage: 'Cobertura completa: todo total é ímpar ou par.'
      };
    case 'teamresult':
      return {
        title: name,
        summary: 'Qual equipe tem MAIS (escanteios/cartões/finalizações/etc.). 3 vias incluindo a igualdade.',
        rows: [
          { selection: `${H}`, condition: `${H} tem mais` },
          { selection: 'Empate', condition: 'as duas com a mesma quantidade' },
          { selection: `${A}`, condition: `${A} tem mais` }
        ],
        coverage: 'Cobertura completa: a casa tem mais, o visitante tem mais, ou empatam.'
      };
    case 'qualify':
      return {
        title: name,
        summary: 'Quem se classifica/avança (considera prorrogação/pênaltis). 2 vias.',
        rows: [
          { selection: `${H}`, condition: `${H} avança` },
          { selection: `${A}`, condition: `${A} avança` }
        ],
        coverage: 'Cobertura completa: exatamente uma equipe se classifica.'
      };
    case 'dc-btts':
      return {
        title: name,
        summary: 'Dupla Chance & Ambas Marcam: combina dupla chance com BTTS. Confira no card as opções presentes.',
        rows: [
          { selection: '1X & Sim/Não', condition: `${H} não perde + ambas marcam (ou não)` },
          { selection: '12 & Sim/Não', condition: 'não empata + BTTS' },
          { selection: 'X2 & Sim/Não', condition: `${A} não perde + BTTS` }
        ],
        coverage: 'Mercado combinado — a cobertura depende das opções que a surebet usa.'
      };
    case 'r-tg':
      return {
        title: name,
        summary: 'Resultado & Total de Gols: combina 1X2 com faixas de total (Mais/Menos). Confira as opções no card.',
        rows: [
          { selection: `${H} & Mais/Menos`, condition: `${H} vence em faixa de gols` },
          { selection: 'Empate & Mais/Menos', condition: 'empate em faixa de gols' },
          { selection: `${A} & Mais/Menos`, condition: `${A} vence em faixa de gols` }
        ],
        coverage: 'Mercado combinado — cobertura conforme as faixas usadas na surebet.'
      };
    default:
      return {
        title: name,
        summary: 'As seleções abaixo (mostradas no card da surebet) são as opções deste mercado para o evento.',
        rows: [],
        coverage: 'Confira no card as seleções e odds de cada perna. Uma surebet só é válida se as pernas, juntas, cobrirem todos os resultados possíveis do mercado.'
      };
  }
}
