/**
 * DADOS DE EXEMPLO do board de PRÉ-JOGO (prematch) no estilo bet365.
 *
 * FUTURO: estas odds virão do NOSSO catálogo /events (dados reais, canônicos).
 * Por enquanto o prematch NÃO tem feed próprio no NoDelay, então definimos aqui
 * um modelo tipado (`PrematchEvent`) + UMA amostra realista só para VER o design
 * da página de pré-jogo. Nada aqui é apostável ainda (o disparo é só no Ao Vivo).
 */

/** Uma odd simples (nome + preço). Estruturada como a célula do live p/ ligar depois. */
export interface PrematchOdd {
  id: string;
  name: string;
  price: number;
}

/** Uma escolha "turbinada": odd antiga → odd nova (aposta aumentada). */
export interface PrematchBoostedPick {
  id: string;
  label: string;
  oldPrice: number;
  newPrice: number;
}

/** Um card "Criar Aposta": lista de pernas + odd combinada (turbinada). */
export interface PrematchBuildCard {
  id: string;
  legs: string[];
  oldPrice: number;
  newPrice: number;
}

/** Uma linha da tabela de jogador (Gol / Assist / Gol ou Assist). */
export interface PrematchPlayerRow {
  id: string;
  player: string;
  last5: string; // ex.: "3 gols nos últimos 5"
  /** Uma odd por coluna (null = sem cotação naquela coluna). */
  odds: (number | null)[];
}

/**
 * Seção do board de pré-jogo. União discriminada por `kind` — cada forma desenha
 * diferente, espelhando a bet365:
 *  - `result`: linha de N vias (Resultado Final 3 vias, Para se Qualificar 2 vias).
 *  - `boosted`: lista "Aposta Aumentada" (odd antiga » nova).
 *  - `buildcards`: fileira de cards "Criar Aposta" (pernas + odd combinada).
 *  - `playerprops`: tabela de jogador com colunas de mercado.
 */
export type PrematchSection =
  | {
      kind: 'result';
      id: string;
      title: string;
      groups: string[];
      ca?: boolean;
      /** Sub-tags verdes itálicas (ex.: "Pagamento Antecipado", "Acum. Aumentado"). */
      subtags?: string[];
      selections: PrematchOdd[];
    }
  | { kind: 'boosted'; id: string; title: string; groups: string[]; picks: PrematchBoostedPick[] }
  | { kind: 'buildcards'; id: string; title: string; groups: string[]; cards: PrematchBuildCard[] }
  | {
      kind: 'playerprops';
      id: string;
      title: string;
      groups: string[];
      ca?: boolean;
      tag?: string; // ex.: "Substituição+"
      columns: string[]; // ex.: ["Gol", "Assist", "Gol ou Assist"]
      rows: PrematchPlayerRow[];
    };

/** Aba do board (as MarketGroups do pré-jogo). */
export interface PrematchGroup {
  id: string;
  name: string;
}

/** Um evento de pré-jogo completo. */
export interface PrematchEvent {
  competition: string;
  home: string;
  away: string;
  /** Id SoFaScore p/ o escudo (img.sofascore.com). Futuro: virá do /events. */
  homeSofaId?: number;
  awaySofaId?: number;
  kickoff: string; // ex.: "21 Jul 21:30"
  homeKit: string; // cor da camisa (fallback visual)
  awayKit: string;
  groups: PrematchGroup[];
  sections: PrematchSection[];
}

/** Uma partida da LISTA de pré-jogo (linha do feed "Próximas Partidas"). */
export interface PrematchListMatch {
  id: string;
  competition: string;
  kickoff: string; // ISO datetime (deriva data + hora)
  home: string;
  away: string;
  homeSofaId?: number;
  awaySofaId?: number;
  /** 1X2 (mandante / empate / visitante). */
  odds: { home: number; draw: number; away: number };
  /** Chip de boost opcional (ex.: "8»"). */
  boost?: string;
}

/**
 * LISTA de pré-jogo (DADOS DE EXEMPLO). Futuro: virá do nosso catálogo /events.
 * Alguns jogos em 2 competições e 2 datas p/ exercitar o agrupamento por liga +
 * sub-cabeçalho de data do estilo bet365.
 */
export const SAMPLE_PREMATCH_LIST: PrematchListMatch[] = [
  {
    id: 'pm-1', competition: 'Brasileirão Série A', kickoff: '2026-07-21T19:30:00-03:00',
    home: 'Palmeiras', away: 'Flamengo', homeSofaId: 1963, awaySofaId: 5981,
    odds: { home: 2.10, draw: 3.25, away: 3.40 }, boost: '8»',
  },
  {
    id: 'pm-2', competition: 'Brasileirão Série A', kickoff: '2026-07-21T21:30:00-03:00',
    home: 'Corinthians', away: 'São Paulo', homeSofaId: 1957, awaySofaId: 1981,
    odds: { home: 2.55, draw: 3.10, away: 2.80 },
  },
  {
    id: 'pm-3', competition: 'Brasileirão Série A', kickoff: '2026-07-22T20:00:00-03:00',
    home: 'Grêmio', away: 'Internacional', homeSofaId: 5926, awaySofaId: 1966,
    odds: { home: 2.35, draw: 3.20, away: 3.05 }, boost: '5»',
  },
  {
    id: 'pm-4', competition: 'Copa Sul-Americana', kickoff: '2026-07-21T21:30:00-03:00',
    home: 'UCV', away: 'Santos', homeSofaId: 63426, awaySofaId: 1084891,
    odds: { home: 4.33, draw: 3.40, away: 1.90 },
  },
  {
    id: 'pm-5', competition: 'Copa Sul-Americana', kickoff: '2026-07-22T19:00:00-03:00',
    home: 'Fortaleza', away: 'Racing', homeSofaId: 62237, awaySofaId: 3244,
    odds: { home: 2.20, draw: 3.15, away: 3.30 },
  },
];

/**
 * Resolve o evento de pré-jogo COMPLETO (com mercados) a partir do id da lista.
 * Por ora só temos os mercados de amostra (SAMPLE_PREMATCH); sobrepomos o cabeçalho
 * (times/liga/horário/escudos) do item clicado. Futuro: buscar o evento real no
 * /events. Sem match → devolve a amostra padrão.
 */
export function findPrematchEvent(id: string): PrematchEvent {
  const m = SAMPLE_PREMATCH_LIST.find((x) => x.id === id);
  if (!m) return SAMPLE_PREMATCH;
  const kickoff = new Date(m.kickoff).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  return {
    ...SAMPLE_PREMATCH,
    competition: m.competition,
    home: m.home,
    away: m.away,
    homeSofaId: m.homeSofaId,
    awaySofaId: m.awaySofaId,
    kickoff,
  };
}

/** Amostra: UCV x Santos — Copa Sul-Americana. DADOS DE EXEMPLO. */
export const SAMPLE_PREMATCH: PrematchEvent = {
  competition: 'Copa Sul-Americana',
  home: 'UCV',
  away: 'Santos',
  homeSofaId: 63426, // César Vallejo (id plausível de exemplo)
  awaySofaId: 1084891, // Santos (id real SoFaScore)
  kickoff: '21 Jul 21:30',
  homeKit: '#c026d3',
  awayKit: '#e5e7eb',
  groups: [
    { id: 'popular', name: 'Popular' },
    { id: 'criar', name: 'Criar Aposta' },
    { id: 'marcadores', name: 'Marcadores' },
    { id: 'chutes', name: 'Chutes' },
    { id: 'cartoes', name: 'Cartões/Faltas' },
    { id: 'resultado', name: 'Resultado' },
    { id: 'escanteios', name: 'Escanteios' },
    { id: 'gols', name: 'Gols' },
    { id: 'tempos', name: '1º/2º Tempo' },
    { id: 'outro', name: 'Outro' },
    { id: 'asiaticas', name: 'Odds Asiáticas' },
  ],
  sections: [
    {
      kind: 'result',
      id: 's-result',
      title: 'Resultado Final',
      groups: ['popular', 'resultado'],
      ca: true,
      subtags: ['Pagamento Antecipado', 'Acum. Aumentado'],
      selections: [
        { id: 'r-1', name: 'UCV', price: 4.33 },
        { id: 'r-x', name: 'Empate', price: 3.40 },
        { id: 'r-2', name: 'Santos', price: 1.90 },
      ],
    },
    {
      kind: 'result',
      id: 's-qualify',
      title: 'Para se Qualificar',
      groups: ['popular', 'resultado'],
      selections: [
        { id: 'q-1', name: 'UCV', price: 6.00 },
        { id: 'q-2', name: 'Santos', price: 1.12 },
      ],
    },
    {
      kind: 'boosted',
      id: 's-boost',
      title: 'Aposta Aumentada',
      groups: ['popular'],
      picks: [
        { id: 'b-1', label: 'Alvaro Barreal — Marcar de Fora da Área', oldPrice: 10.0, newPrice: 11.0 },
        { id: 'b-2', label: 'Santos — Marcar em Ambos os Tempos', oldPrice: 3.25, newPrice: 3.5 },
        { id: 'b-3', label: 'UCV e Santos — Ambos +1.5 Gols', oldPrice: 2.5, newPrice: 2.75 },
      ],
    },
    {
      kind: 'buildcards',
      id: 's-build',
      title: 'Criar Aposta',
      groups: ['popular', 'criar'],
      cards: [
        {
          id: 'c-1',
          legs: ['Gabriel Barbosa - Para Marcar', 'Benjamin Rollheiser - Para Dar Assistência', 'Resultado Final: Santos'],
          oldPrice: 8.0,
          newPrice: 9.0,
        },
        {
          id: 'c-2',
          legs: ['Santos - Mais de 1.5 Gols', 'Escanteios: Mais de 8.5', 'Cartões: Mais de 3.5'],
          oldPrice: 6.5,
          newPrice: 7.25,
        },
        {
          id: 'c-3',
          legs: ['Neymar - Para Marcar ou Assistir', 'UCV - Menos de 1.5 Gols', 'Ambos Marcam: Não'],
          oldPrice: 5.0,
          newPrice: 5.75,
        },
      ],
    },
    {
      kind: 'playerprops',
      id: 's-players',
      title: 'Jogador a Marcar ou Dar Assistência',
      groups: ['popular', 'marcadores'],
      ca: true,
      tag: 'Substituição+',
      columns: ['Gol', 'Assist', 'Gol ou Assist'],
      rows: [
        { id: 'p-1', player: 'Gabriel Barbosa', last5: '3 gols / 5', odds: [2.4, 3.75, 1.66] },
        { id: 'p-2', player: 'Neymar Jr.', last5: '2 gols / 5', odds: [2.75, 2.9, 1.55] },
        { id: 'p-3', player: 'Benjamin Rollheiser', last5: '1 gol / 5', odds: [4.5, 3.2, 2.05] },
        { id: 'p-4', player: 'Alvaro Barreal', last5: '2 assist / 5', odds: [6.0, 3.5, 2.4] },
        { id: 'p-5', player: 'Deivid Washington', last5: '0 gols / 5', odds: [5.5, null, 3.1] },
      ],
    },
  ],
};
