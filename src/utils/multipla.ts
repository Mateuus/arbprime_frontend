// Helpers da MÚLTIPLA (arbitragem de acumulada). Formatação (reaproveita as do
// middle), rótulos de cobertura, adaptadores p/ os componentes de surebet
// (OpenInHouse espera SurebetOdd/SurebetData) e chave/fingerprint estáveis p/ o
// motor de notificações.
import { MultiArbData, MultiGame, MultiLeg, MultiTicket } from '@/interfaces/multipla.interface';
import { SurebetData, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { optionLabel } from '@/utils/surebet';

export { fmtBRL, fmtDateTime, seenAgo, fmtSigned } from '@/utils/middle';

// Tom (cores) do lucro garantido da múltipla — acento CYAN da feature. Espelha
// profitTone das surebets, mas na paleta própria.
export const multiProfitTone = (pct: number): string => {
  if (pct >= 3) return 'bg-cyan-500/20 text-cyan-200 ring-cyan-400/40';
  if (pct >= 1) return 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30';
  if (pct > 0) return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25';
  return 'bg-white/5 text-gray-300 ring-white/10';
};

// Rótulo amigável da cobertura (cover key do robô: "1x2", "double-chance15", …).
// Sem catálogo dedicado ainda — humaniza a chave crua o suficiente p/ exibir.
export const coverLabel = (cover: string): string => {
  if (!cover) return 'Cobertura';
  const base = cover.replace(/[0-9.]+$/, ''); // separa a linha anexada (ex.: "over-under2.5")
  const line = cover.slice(base.length);
  const map: Record<string, string> = {
    '1x2': 'Resultado (1X2)',
    'double-chance': 'Chance dupla',
    'over-under': 'Mais/Menos',
    'btts': 'Ambas marcam',
    'draw-no-bet': 'Empate anula',
  };
  const name = map[base] || base.replace(/-/g, ' ');
  return line ? `${name} ${line}` : name;
};

// A seleção de uma perna, já localizada no contexto do jogo dela.
export const legSelectionLabel = (leg: MultiLeg, game?: MultiGame): string =>
  optionLabel(leg.option, game?.home, game?.away);

// Jogo (dono) de uma perna dentro do par.
export const gameOfLeg = (data: MultiArbData, leg: MultiLeg): MultiGame | undefined =>
  data.games.find((g) => g.groupId === leg.groupId);

// Adaptador: perna da múltipla → SurebetOdd (p/ OpenInHouse). A casa é do
// bilhete (as 2 pernas do bilhete são da mesma casa).
export const toSurebetLeg = (leg: MultiLeg, bookmaker: string): SurebetOdd => ({
  option: leg.option,
  price: leg.price,
  bookmaker,
  eventId: leg.eventId,
  market: leg.market,
  rawMarket: leg.rawMarket,
  rawSelection: leg.rawSelection,
  link: leg.link,
  historyPrice: [],
  otherOdds: [],
});

// Adaptador: jogo do par → SurebetData mínimo (p/ OpenInHouse montar o deep link).
export const toSurebetEvent = (game: MultiGame, sport: string): SurebetData => ({
  id: game.groupId,
  sport,
  league: game.league,
  home: game.home,
  away: game.away,
  date: game.date,
  surebets: [],
  update_at: '',
  create_at: '',
});

/**
 * Chave ESTÁVEL do par (identifica a MESMA múltipla entre updates do WS). Odds e
 * lucro mudam a cada tick; o que define a aposta é o par de jogos + as coberturas
 * usadas. Serve p/ detectar "múltipla nova" e p/ seguir uma específica.
 */
export const multiKey = (d: MultiArbData): string => `${d.id}::${[...(d.covers || [])].sort().join(',')}`;

/** "Impressão digital" do estado atual (lucro + odds combinadas dos bilhetes). */
export const multiFingerprint = (d: MultiArbData): string => {
  const odds = (d.tickets || []).map((t) => Number(t.combinedOdd).toFixed(3)).sort().join(',');
  return `${Number(d.profitMargin).toFixed(2)}|${odds}`;
};

// Casas distintas envolvidas no par (uma múltipla pode usar várias casas, uma
// por bilhete). Útil p/ mostrar no card sem repetir.
export const ticketHouses = (tickets: MultiTicket[]): string[] =>
  Array.from(new Set(tickets.map((t) => t.bookmaker)));
