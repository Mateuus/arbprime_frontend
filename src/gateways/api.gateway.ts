import axios from "axios";

import { CreateOrUpdateFilterDTO } from '@/interfaces/FilterDTO';

const ApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

const getPreferredLanguage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('preferredLanguage') || 'en';
    }
    return 'pt-BR'; // Valor padrão caso esteja no servidor
};

// Configurações básicas do Axios
const apiClient = axios.create({
    baseURL: `${ApiUrl}`,
    headers: {
      'Content-Type': 'application/json',
      'accept-language': getPreferredLanguage(), // Define o idioma inicial
    },
    withCredentials: true, // Garante que os cookies HttpOnly sejam enviados com as requisições
});

// Interceptor para atualizar o header de idioma
apiClient.interceptors.request.use((config) => {
    const language = getPreferredLanguage();
    if (config.headers) {
      config.headers['accept-language'] = language; // Atualiza o idioma
    }
    return config;
});


export const setupAxiosInterceptors = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUser: (user: any) => void, 
    setIsAuthenticated: (auth: boolean) => void
  ) => {
    apiClient.interceptors.response.use(
      response => {
        // Caso a resposta contenha dados do usuário, atualize o estado
        if (response.data?.user) {
          setUser(response.data.user); // Atualiza o usuário no estado
          setIsAuthenticated(true); // Define como autenticado
        }
        return response;
      },
      error => {
        const originalRequest = error.config;

        // Se a URL do request for /user/auth ou /user/info ou /user/logout
        const isAuthCheck = originalRequest?.url?.includes("/user/auth") || originalRequest?.url?.includes("/user/info");

        if (error.response?.status === 401 && isAuthCheck) {
          // Trate o erro 401, removendo o usuário e autenticidade
          setUser(null); // Reseta o usuário
          setIsAuthenticated(false); // Define como não autenticado
          //console.warn("Erro 401: Usuário não autorizado. Reautenticação necessária.");
        }
        return Promise.reject(error); // Rejeita o erro para ser tratado onde a requisição foi feita
      }
    );
};

const register = async (email: string, fullname: string, personal_id: string, phone: string, password: string) => {
  const inviteBy = localStorage.getItem('referralCode') || '';
  return apiClient.post('/user/register', { email, fullname, personal_id, phone, password, inviteBy  });
};

const login = async (email: string, password: string) => {
    return apiClient.post('/user/login', { email, password });
};

const logout = async () => {
    return apiClient.post('/user/logout'); // Pode ser diferente, dependendo da API
};

const getUserInfo = async () => {
    return apiClient.get('/user/info'); // Retorna o status mesmo em erro
};

const getUserAuth = async () => {
  try {
    const res = await apiClient.get('/user/auth');
    
    if (res && res.data?.result === 1) {
      return res.data.data;
    }

    return 'anonymous'; // caso result seja !== 1
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return 'anonymous';
    }
  
    console.error('Erro inesperado em getUserAuth:', error);
    return 'anonymous';
  }
};

const changePassowrd = async (currentPassword: string, newPassword: string) => {
  return apiClient.put('/user/change-password', { currentPassword, newPassword });
};

const lookupCPF = async (personal_id: string) => {
  return apiClient.post('/user/lookup', { personal_id });
};

const getUserFilters = async () => {
  return apiClient.get('/user/abfilters');
};

const getFilterById = async (id: string) => {
  return apiClient.get(`/user/abfilters/${id}`);
};

const createFilter = async (filterData: CreateOrUpdateFilterDTO) => {
  return apiClient.post('/user/abfilters', filterData);
};

const updateFilter = async (id: string, filterData: CreateOrUpdateFilterDTO) => {
  return apiClient.put(`/user/abfilters/${id}`, filterData);
};

const deleteFilter = async (id: string) => {
  return apiClient.delete(`/user/abfilters/${id}`);
};

// ==================== EVENTOS ====================

export interface EventsParams {
  page?: number;
  limit?: number;
  search?: string;
  sport?: string;
  disabled?: string;
  league?: string;
  bookmaker?: string;
}

const getEvents = async (params: EventsParams = {}) => {
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });

  const queryString = queryParams.toString();
  const url = `/events${queryString ? `?${queryString}` : ''}`;
  
  return apiClient.get(url);
};

const getEventById = async (id: string) => {
  return apiClient.get(`/events/${id}`);
};

const getEventsStats = async () => {
  return apiClient.get('/events/stats');
};

const getEventDetails = async (id: string) => {
  return apiClient.get(`/events/${id}/details`);
};

// ============ EVENTOS DO BANCO (arbbetting_master via DB) ============

export interface ExternalEvent {
  id: string;
  bookmaker: string;
  eventId: string;
  sport: string;
  league: string | null;
  leagueName: string | null;
  home: string;
  away: string;
  eventDate: string | null;
  country: string | null;
  link: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ExternalEventsParams {
  page?: number;
  limit?: number;
  bookmaker?: string;
  sport?: string;
  league?: string;
  countryKey?: string;
  leagueId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  upcomingOnly?: boolean;
  pastOnly?: boolean;
  sort?: 'asc' | 'desc';
}

export interface ExternalOdd {
  id: string;
  bookmaker: string;
  eventId: string;
  marketId: string;
  marketName: string | null;
  selection: string;
  handicap: string;
  price: number;
  eventDate: string | null;
  changesCount: number;
  updatedAt: string;
}

export interface GroupedHouse {
  bookmaker: string;
  eventId: string;
  home: string;
  away: string;
  inverted: boolean;
  link: string | null;
}

export interface GroupedEvent {
  key: string;
  sport: string;
  home: string;
  away: string;
  eventDate: string | null;
  league: string | null;       // nome canônico da liga (fallback: cru)
  country: string | null;      // país canônico (via leagues)
  countryKey?: string | null;  // chave do país (ex.: "br")
  leagueId?: string | null;
  // 'active' | 'review' = grupo canônico (jogo casado); 'solo' = evento de 1 casa não casado.
  status?: string;
  houses: GroupedHouse[];
}

export interface EventGroupPrice {
  bookmaker: string;
  eventId: string;
  price: number;
  inverted: boolean;
  // odd com vantagem (Super Placar/Super Odds). Tem limite de stake / 1 por cliente.
  boosted?: boolean;
}
export interface EventGroupSelection {
  selection: string;
  handicap: string;
  prices: EventGroupPrice[];
}
export interface EventGroupMarket {
  marketId: string;
  marketName: string | null;
  selections: EventGroupSelection[];
}
export interface EventGroupDetail {
  event: { sport: string; home: string; away: string; eventDate: string | null; league: string | null; country: string | null };
  houses: GroupedHouse[];
  markets: EventGroupMarket[];
}

const buildEventsQuery = (params: ExternalEventsParams): string => {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== false) {
      qp.append(key, String(value));
    }
  });
  const qs = qp.toString();
  return qs ? `?${qs}` : '';
};

const getExternalEvents = async (params: ExternalEventsParams = {}) => {
  return apiClient.get(`/external/events${buildEventsQuery(params)}`);
};

// Lista AGRUPADA (1 item por evento real, deduplicado entre casas).
const getGroupedEvents = async (params: ExternalEventsParams = {}) => {
  return apiClient.get(`/external/events/grouped${buildEventsQuery(params)}`);
};

// Esportes + campeonatos presentes (para a sidebar de eventos).
const getEventFacets = async (params: ExternalEventsParams = {}) => {
  return apiClient.get(`/external/events/facets${buildEventsQuery(params)}`);
};

// Evento real (grupo) + comparação de odds entre casas.
const getEventGroup = async (bookmaker: string, eventId: string) => {
  return apiClient.get(`/external/events/group/${encodeURIComponent(bookmaker)}/${encodeURIComponent(eventId)}`);
};

const getExternalEvent = async (bookmaker: string, eventId: string) => {
  return apiClient.get(`/external/events/${encodeURIComponent(bookmaker)}/${encodeURIComponent(eventId)}`);
};

const getExternalEventOdds = async (bookmaker: string, eventId: string) => {
  return apiClient.get(`/external/events/${encodeURIComponent(bookmaker)}/${encodeURIComponent(eventId)}/odds`);
};

// ==================== BOOKMAKERS (casas de aposta) ====================

export interface BookmakerDTO {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  url: string | null;
  cloneOf: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBookmakerDTO {
  slug: string;
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  url?: string | null;
  cloneOf?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

const getBookmakers = async () => {
  return apiClient.get('/bookmaker');
};

const addBookmaker = async (data: UpsertBookmakerDTO) => {
  return apiClient.post('/bookmaker', data);
};

const updateBookmaker = async (id: string, data: Partial<UpsertBookmakerDTO>) => {
  return apiClient.put(`/bookmaker/${id}`, data);
};

const toggleBookmaker = async (id: string, isActive: boolean) => {
  return apiClient.patch(`/bookmaker/${id}/toggle`, { isActive });
};

const deleteBookmaker = async (id: string) => {
  return apiClient.delete(`/bookmaker/${id}`);
};

const getExternalEventHistory = async (
  bookmaker: string,
  eventId: string,
  opts: { limit?: number; marketId?: string; selection?: string } = {}
) => {
  const qp = new URLSearchParams();
  if (opts.limit) qp.append('limit', String(opts.limit));
  if (opts.marketId) qp.append('marketId', opts.marketId);
  if (opts.selection) qp.append('selection', opts.selection);
  const qs = qp.toString();
  return apiClient.get(
    `/external/events/${encodeURIComponent(bookmaker)}/${encodeURIComponent(eventId)}/history${qs ? `?${qs}` : ''}`
  );
};

// ==================== PROXIES ====================

export interface ProxyDTO {
  id: string;
  provider: string;
  externalId: string | null;
  protocol: string;
  ipType: string;
  ip: string;
  port: number;
  portSocks: number | null;
  login: string;
  password: string;
  country: string | null;
  countryAlpha3: string | null;
  status: string | null;
  isPrivate: boolean;
  isEnabled: boolean;
  scope: string[] | null; // slugs de casas; null/vazio = pool global
  comment: string | null;
  createdAt: string;
}

export interface AddProxyDTO {
  ip: string;
  port: number;
  protocol?: string;
  ipType?: string;
  login?: string;
  password?: string;
  isPrivate?: boolean;
  scope?: string[] | null;
  comment?: string;
}

// Pacote residencial do Proxy-Seller (banda/tráfego em BYTES — a API entrega como string).
export interface ResidentPackageDTO {
  is_active?: boolean;
  rotation?: number;
  tarif_id?: number | string;
  traffic_limit?: number | string;
  traffic_usage?: number | string;
  traffic_left?: number | string;
  expired_at?: string;
  auto_renew?: boolean;
  [key: string]: unknown;
}

export interface ResidentListDTO {
  id: number | string;
  title?: string;
  [key: string]: unknown;
}

export interface ResidentGeoCountryDTO {
  code: string;
  name: string;
}

export interface CreateResidentListDTO {
  title: string;
  country: string;
  region?: string;
  city?: string;
  isp?: string;
  rotation?: number;
  ports?: number;
  whitelist?: string;
}

const getProxies = async () => {
  return apiClient.get('/proxy');
};

const syncProxies = async (provider: string, type: string) => {
  return apiClient.post('/proxy/sync', { provider, type });
};

const addProxy = async (data: AddProxyDTO) => {
  return apiClient.post('/proxy', data);
};

const bulkAddProxies = async (list: string, protocol?: string, scope?: string[] | null) => {
  return apiClient.post('/proxy/bulk', { list, protocol, scope });
};

const updateProxy = async (id: string, data: Partial<ProxyDTO>) => {
  return apiClient.put(`/proxy/${id}`, data);
};

const toggleProxy = async (id: string, isEnabled: boolean) => {
  return apiClient.patch(`/proxy/${id}/toggle`, { isEnabled });
};

const testProxy = async (id: string) => {
  return apiClient.post(`/proxy/${id}/test`);
};

const deleteProxy = async (id: string) => {
  return apiClient.delete(`/proxy/${id}`);
};

// ---- Residencial (Proxy-Seller) ----
const getResidentPackage = async () => {
  return apiClient.get('/proxy/resident/package');
};

const getResidentLists = async () => {
  return apiClient.get('/proxy/resident/lists');
};

const importResidentList = async (listId: number | string, proto?: string, scope?: string[] | null, title?: string) => {
  return apiClient.post('/proxy/resident/import', { listId, proto, scope, title });
};

const getResidentGeo = async () => {
  return apiClient.get('/proxy/resident/geo');
};

const createResidentList = async (data: CreateResidentListDTO) => {
  return apiClient.post('/proxy/resident/list/create', data);
};

const renameResidentList = async (id: number | string, title: string) => {
  return apiClient.post('/proxy/resident/list/rename', { id, title });
};

const deleteResidentList = async (id: number | string) => {
  return apiClient.delete(`/proxy/resident/list/${id}`);
};

// ==================== TEAMS & ALIASES (curadoria — admin) ====================

export interface TeamAliasDTO {
  id: string;
  teamId: string;
  alias: string;
  aliasNorm: string;
  sport: string;
  category: string;
  bookmaker: string | null;
  source: string;
  status: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDTO {
  id: string;
  canonicalName: string;
  canonicalNorm: string;
  sport: string;
  category: string;
  country: string | null;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  aliasCount?: number;
}

export interface TeamDetailDTO extends TeamDTO {
  aliases: TeamAliasDTO[];
}

export interface UpsertTeamDTO {
  canonicalName?: string;
  sport?: string;
  category?: string;
  country?: string | null;
  status?: string;
}

export interface UpsertAliasDTO {
  alias?: string;
  bookmaker?: string | null;
  status?: string;
}

export interface TeamsPaginationDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TeamsListDTO {
  teams: TeamDTO[];
  pagination: TeamsPaginationDTO;
}

const getTeams = async (params: { search?: string; sport?: string; category?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.sport) qp.append('sport', params.sport);
  if (params.category) qp.append('category', params.category);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/teams${qs ? `?${qs}` : ''}`);
};

const getTeam = async (id: string) => {
  return apiClient.get(`/teams/${id}`);
};

const createTeam = async (data: UpsertTeamDTO) => {
  return apiClient.post('/teams', data);
};

const updateTeam = async (id: string, data: UpsertTeamDTO) => {
  return apiClient.put(`/teams/${id}`, data);
};

const mergeTeams = async (sourceId: string, targetId: string) => {
  return apiClient.post('/teams/merge', { sourceId, targetId });
};

const addAlias = async (teamId: string, data: UpsertAliasDTO) => {
  return apiClient.post(`/teams/${teamId}/aliases`, data);
};

const updateAlias = async (teamId: string, aliasId: string, data: UpsertAliasDTO) => {
  return apiClient.put(`/teams/${teamId}/aliases/${aliasId}`, data);
};

const deleteAlias = async (teamId: string, aliasId: string) => {
  return apiClient.delete(`/teams/${teamId}/aliases/${aliasId}`);
};

// ==================== LEAGUES & ALIASES (curadoria — admin) ====================

export interface LeagueAliasDTO {
  id: string;
  leagueId: string;
  alias: string;
  aliasNorm: string;
  sport: string;
  bookmaker: string;
  source: string;
  status: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueDTO {
  id: string;
  canonicalName: string;
  canonicalNorm: string;
  sport: string;
  country: string | null;
  countryKey: string | null;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  aliasCount?: number;
}

export interface LeagueDetailDTO extends LeagueDTO {
  aliases: LeagueAliasDTO[];
}

export interface UpsertLeagueDTO {
  canonicalName?: string;
  sport?: string;
  country?: string | null;
  countryKey?: string | null;
  status?: string;
}

export interface UpsertLeagueAliasDTO {
  alias?: string;
  bookmaker?: string;
  status?: string;
}

export interface LeagueCountryDTO {
  countryKey: string | null;
  country: string | null;
  count: number;
}

const getLeagues = async (params: { search?: string; sport?: string; countryKey?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.sport) qp.append('sport', params.sport);
  if (params.countryKey) qp.append('countryKey', params.countryKey);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/leagues${qs ? `?${qs}` : ''}`);
};
const getLeagueCountries = async () => apiClient.get('/leagues/countries');
const getLeague = async (id: string) => apiClient.get(`/leagues/${id}`);
const createLeague = async (data: UpsertLeagueDTO) => apiClient.post('/leagues', data);
const updateLeague = async (id: string, data: UpsertLeagueDTO) => apiClient.put(`/leagues/${id}`, data);
const mergeLeagues = async (sourceId: string, targetId: string) => apiClient.post('/leagues/merge', { sourceId, targetId });
const addLeagueAlias = async (leagueId: string, data: UpsertLeagueAliasDTO) => apiClient.post(`/leagues/${leagueId}/aliases`, data);
const updateLeagueAlias = async (leagueId: string, aliasId: string, data: UpsertLeagueAliasDTO) => apiClient.put(`/leagues/${leagueId}/aliases/${aliasId}`, data);
const deleteLeagueAlias = async (leagueId: string, aliasId: string) => apiClient.delete(`/leagues/${leagueId}/aliases/${aliasId}`);

// ==================== NOMES DE MERCADO POR CASA (curadoria — admin) ====================

export interface MarketNameDTO {
  id: string;
  bookmaker: string;   // "" = override global
  marketId: string;    // id canônico (slug), ex.: "win-to-nil-away"
  displayName: string; // nome como a casa apresenta no site
  source: string;      // seed | feed | manual
  createdAt: string;
  updatedAt: string;
}

const getMarketNames = async (params: { search?: string; bookmaker?: string; marketId?: string } = {}) => {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.bookmaker !== undefined) qp.append('bookmaker', params.bookmaker);
  if (params.marketId) qp.append('marketId', params.marketId);
  const qs = qp.toString();
  return apiClient.get(`/markets${qs ? `?${qs}` : ''}`);
};
const upsertMarketName = async (data: { bookmaker: string; marketId: string; displayName: string }) => apiClient.post('/markets', data);
const bulkUpsertMarketNames = async (data: { marketId: string; displayName: string; bookmakers: string[] }) => apiClient.post('/markets/bulk', data);
const updateMarketName = async (id: string, data: { displayName?: string; bookmaker?: string }) => apiClient.put(`/markets/${id}`, data);
const deleteMarketName = async (id: string) => apiClient.delete(`/markets/${id}`);

export const apiGateway = {
    register,
    login,
    logout,
    getUserInfo,
    getUserAuth,
    changePassowrd,
    lookupCPF,
    getUserFilters,
    getFilterById,
    createFilter,
    updateFilter,
    deleteFilter,
    // Eventos
    getEvents,
    getEventById,
    getEventsStats,
    getEventDetails,
    // Eventos do banco (arbbetting via DB)
    getExternalEvents,
    getGroupedEvents,
    getEventFacets,
    getEventGroup,
    getExternalEvent,
    getExternalEventOdds,
    getExternalEventHistory,
    // Proxies
    getProxies,
    syncProxies,
    addProxy,
    bulkAddProxies,
    updateProxy,
    toggleProxy,
    testProxy,
    deleteProxy,
    getResidentPackage,
    getResidentLists,
    importResidentList,
    getResidentGeo,
    createResidentList,
    renameResidentList,
    deleteResidentList,
    // Bookmakers
    getBookmakers,
    addBookmaker,
    updateBookmaker,
    toggleBookmaker,
    deleteBookmaker,
    // Times & Aliases
    getTeams,
    getTeam,
    createTeam,
    updateTeam,
    mergeTeams,
    addAlias,
    updateAlias,
    deleteAlias,
    // Ligas & Aliases
    getLeagues,
    getLeagueCountries,
    getLeague,
    createLeague,
    updateLeague,
    mergeLeagues,
    addLeagueAlias,
    updateLeagueAlias,
    deleteLeagueAlias,
    // Nomes de mercado por casa
    getMarketNames,
    upsertMarketName,
    bulkUpsertMarketNames,
    updateMarketName,
    deleteMarketName
};
    
export default apiGateway;