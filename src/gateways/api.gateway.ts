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
  league: string | null;
  country: string | null;
  houses: GroupedHouse[];
}

export interface EventGroupPrice {
  bookmaker: string;
  eventId: string;
  price: number;
  inverted: boolean;
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
  comment?: string;
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

const bulkAddProxies = async (list: string, protocol?: string) => {
  return apiClient.post('/proxy/bulk', { list, protocol });
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
    // Bookmakers
    getBookmakers,
    addBookmaker,
    updateBookmaker,
    toggleBookmaker,
    deleteBookmaker
};
    
export default apiGateway;