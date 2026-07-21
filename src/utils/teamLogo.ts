/**
 * URL do escudo do time a partir do id SoFaScore — CENTRALIZADA aqui de propósito.
 *
 * Usa `api.sofascore.com/api/v1/team/{id}/image` — a MESMA que o /admin/primeradio
 * e o /primetv já usam com sucesso no browser real do app. (Testes headless/de
 * origem estranha caem no 403 anti-bot da SoFaScore, mas o browser real do usuário
 * carrega; por isso não precisa de proxy.) O componente TeamLogo mantém o fallback
 * de iniciais no `onError` para os casos em que a imagem não vier.
 */
export function teamLogoUrl(sofascoreId: number | string): string {
  return `https://api.sofascore.com/api/v1/team/${sofascoreId}/image`;
}
