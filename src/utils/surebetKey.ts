import { SurebetData, Surebet } from '@/interfaces/arbitragem.interface';

/**
 * Chave ESTÁVEL de uma surebet: identifica a MESMA arbitragem entre updates do
 * WebSocket. As odds e o lucro mudam a cada tick, mas o conjunto de pernas
 * (casa + mercado + seleção) define a aposta — então usamos isso como identidade.
 * Serve tanto para detectar "surebet nova" quanto para "seguir" uma específica.
 */
export function surebetKey(event: SurebetData, sb: Surebet): string {
  const legs = sb.surebet
    .map((l) => {
      // Mercados combinados (ex.: btts-and-total-goals) trazem a linha de gols no
      // handicap, não na option — sem ela, surebets de linhas diferentes (2.5 vs 6.5)
      // teriam a MESMA chave. Anexa a linha só quando a option ainda não a carrega.
      const h = l.handicap;
      const line = (h === undefined || h === null || h === '' || (l.option || '').includes(String(h))) ? '' : `|${h}`;
      return `${(l.bookmaker || '').toLowerCase()}|${l.market}|${l.option}${line}`;
    })
    .sort()
    .join('~');
  const markets = [...(sb.marketTypes || [])].sort().join(',');
  return `${event.id}::${markets}::${legs}`;
}

/**
 * "Impressão digital" do estado atual da surebet (lucro + preços das pernas).
 * Comparando o fingerprint entre snapshots detectamos se a surebet MUDOU.
 */
export function surebetFingerprint(sb: Surebet): string {
  const odds = sb.surebet.map((l) => Number(l.price).toFixed(3)).join(',');
  return `${sb.profitMargin.toFixed(2)}|${odds}`;
}
