/**
 * Registry dos servidores de backend do ArbPrime.
 *
 * Em produção (Vercel) temos dois dedicados atrás de proxy reverso, cada um com
 * sua própria REST e seu próprio WebSocket:
 *   - Principal:   REST https://api.arbprime.pro   WS wss://wss.arbprime.pro
 *   - Secundário:  REST https://api2.arbprime.pro  WS wss://wss2.arbprime.pro
 *
 * O frontend mede a latência de cada um (GET /ping) e escolhe o melhor; se o
 * ativo cair, faz failover para o outro e volta sozinho quando o preferido
 * normaliza (ver serverManager).
 *
 * Em desenvolvimento usamos localhost — nesse caso o seletor some e o app opera
 * com um único servidor "Local" derivado das envs NEXT_PUBLIC_*.
 */

export type ServerId = 'primary' | 'secondary' | 'local';

export interface ServerDef {
  id: ServerId;
  /** Rótulo curto exibido na UI. */
  label: string;
  /** Base da API REST (axios baseURL). */
  apiUrl: string;
  /** Base do WebSocket. */
  wsUrl: string;
  /** URL batida para medir latência (health-check público). */
  pingUrl: string;
}

const envApi = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const envWs = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '';

/** Estamos apontando para um backend local (dev)? */
export const isLocalBackend =
  /localhost|127\.0\.0\.1/.test(envApi) || /localhost|127\.0\.0\.1/.test(envWs);

const stripSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * Permite sobrescrever os hosts via env sem recompilar a lógica:
 *   NEXT_PUBLIC_API_PRIMARY / NEXT_PUBLIC_WS_PRIMARY
 *   NEXT_PUBLIC_API_SECONDARY / NEXT_PUBLIC_WS_SECONDARY
 * Caem nos defaults de produção quando ausentes.
 */
const PROD_SERVERS: ServerDef[] = [
  {
    id: 'primary' as ServerId,
    label: 'Principal',
    apiUrl: stripSlash(process.env.NEXT_PUBLIC_API_PRIMARY || 'https://api.arbprime.pro'),
    wsUrl: stripSlash(process.env.NEXT_PUBLIC_WS_PRIMARY || 'wss://wss.arbprime.pro'),
    pingUrl: '',
  },
  {
    id: 'secondary' as ServerId,
    label: 'Secundário',
    apiUrl: stripSlash(process.env.NEXT_PUBLIC_API_SECONDARY || 'https://api2.arbprime.pro'),
    wsUrl: stripSlash(process.env.NEXT_PUBLIC_WS_SECONDARY || 'wss://wss2.arbprime.pro'),
    pingUrl: '',
  },
].map((s) => ({ ...s, pingUrl: `${s.apiUrl}/ping` }));

const LOCAL_SERVER: ServerDef = {
  id: 'local',
  label: 'Local',
  apiUrl: stripSlash(envApi || 'http://localhost:3000'),
  wsUrl: stripSlash(envWs || 'ws://localhost:8080'),
  pingUrl: `${stripSlash(envApi || 'http://localhost:3000')}/ping`,
};

/** Lista de servidores disponíveis no ambiente atual. */
export const SERVERS: ServerDef[] = isLocalBackend ? [LOCAL_SERVER] : PROD_SERVERS;

/** Servidor padrão quando ainda não há preferência salva nem ping resolvido. */
export const DEFAULT_SERVER_ID: ServerId = SERVERS[0].id;

export const getServer = (id: ServerId): ServerDef | undefined =>
  SERVERS.find((s) => s.id === id);
