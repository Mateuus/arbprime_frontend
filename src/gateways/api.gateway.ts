import axios from "axios";

import { CreateOrUpdateFilterDTO } from '@/interfaces/FilterDTO';
import { serverManager } from '@/services/serverManager';

const getPreferredLanguage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('preferredLanguage') || 'en';
    }
    return 'pt-BR'; // Valor padrão caso esteja no servidor
};

// Configurações básicas do Axios.
// IMPORTANTE: a baseURL NÃO é fixada aqui — ela é resolvida por requisição pelo
// serverManager (Principal/Secundário + failover). Assim, trocar de servidor ou
// cair e fazer failover passa a valer imediatamente, sem recriar o client.
const apiClient = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'accept-language': getPreferredLanguage(), // Define o idioma inicial
    },
    withCredentials: true, // Garante que os cookies HttpOnly sejam enviados com as requisições
});

// Interceptor de request: define a baseURL ativa e atualiza o idioma.
apiClient.interceptors.request.use((config) => {
    // Garante o monitor de servidores ligado e usa o servidor ativo no momento.
    serverManager.init();
    if (!config.baseURL) config.baseURL = serverManager.getApiBase();
    const language = getPreferredLanguage();
    if (config.headers) {
      config.headers['accept-language'] = language; // Atualiza o idioma
    }
    return config;
});

// Interceptor de failover: se uma requisição falhar por REDE (servidor fora do
// ar — sem `error.response`), marca o ativo como down, troca de servidor e
// repete a requisição UMA vez na nova baseURL. Erros HTTP (4xx/5xx com resposta)
// não disparam failover, pois o servidor está de pé.
apiClient.interceptors.response.use(undefined, (error) => {
    const config = error?.config;
    const isNetworkError = !!config && !error?.response && error?.code !== 'ERR_CANCELED';
    if (isNetworkError && !config.__failoverRetried) {
      const switched = serverManager.markActiveDown();
      if (switched) {
        config.__failoverRetried = true;
        config.baseURL = serverManager.getApiBase();
        return apiClient(config);
      }
    }
    return Promise.reject(error);
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
  // Pagamento Antecipado: a casa paga a aposta como vencedora se o time abrir a
  // vantagem de gols definida pela casa, mesmo que o placar mude depois.
  pa?: boolean;
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
  commissionPct: number | null;
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
  commissionPct?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

const getBookmakers = async () => {
  return apiClient.get('/bookmaker');
};

// Estatísticas agregadas da landing (público, só números — sem dados gated).
const getHomeStats = async () => {
  return apiClient.get('/stats');
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

// ==================== PLANOS & ASSINATURA ====================

export interface PlanDTO {
  id: string;
  name: string;
  description: string | null;
  price: number;            // preço cheio
  promotionType: 'none' | 'percent' | 'fixed';
  promotionValue: number;
  finalPrice: number;       // preço cobrado (com promoção)
  discount: number;         // desconto em R$
  hasPromotion: boolean;
  durationInDays: number;
  level: number;
  isTrial: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPlanDTO {
  name?: string;
  description?: string;
  price?: number;
  promotionType?: 'none' | 'percent' | 'fixed';
  promotionValue?: number;
  durationInDays?: number;
  level?: number;
  isTrial?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UserPlanDTO {
  id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  level: number;
  isTrial: boolean;
  startDate: string | null;
  expirationDate: string | null;
  createdAt: string;
  plan: PlanDTO | null;
}

export interface SubscriptionInfoDTO {
  level: number;
  hasActivePlan: boolean;
  expiresAt: string | null;
  subscription: UserPlanDTO | null;
  history: UserPlanDTO[];
  trial: { available: boolean; plan: PlanDTO | null; usedAt: string | null };
}

export interface CheckoutDTO {
  txid: string;
  status: string;
  amountCents: number;
  originalAmountCents?: number;
  discountCents?: number;
  couponCode?: string | null;
  pixCopiaECola: string;
  pixQrCodeImage: string | null;
  expiresAt: string | null;
}

export interface CouponValidationDTO {
  valid: boolean;
  originalAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  couponCode: string | null;
  isAffiliate: boolean;
}

// Métodos de pagamento disponíveis no checkout (Efí automático / PIX manual).
export interface PaymentMethodsDTO {
  efibank: { active: boolean };
  manual: { active: boolean; displayName: string; hasQr: boolean; hasCopyPaste: boolean };
}

// Resultado do checkout manual (PIX estático + comprovante).
export interface ManualCheckoutDTO {
  txid: string;
  status: string; // pending | in_review | completed | rejected
  amountCents: number;
  originalAmountCents?: number;
  discountCents?: number;
  couponCode?: string | null;
  pixKey: string | null;
  pixCopiaECola: string | null;
  qrImage: string | null;
  instructions: string | null;
  displayName: string;
  proofUploadedAt?: string | null;
  reviewNote?: string | null;
}

// Público
const getPlans = async () => apiClient.get('/plans');
// Admin
const getAllPlans = async () => apiClient.get('/plans/all');
const createPlan = async (data: UpsertPlanDTO) => apiClient.post('/plans', data);
const updatePlan = async (id: string, data: UpsertPlanDTO) => apiClient.put(`/plans/${id}`, data);
const deletePlan = async (id: string) => apiClient.delete(`/plans/${id}`);

// Assinatura (usuário logado)
const getMySubscription = async () => apiClient.get('/subscription/me');
const createCheckout = async (planId: string, couponCode?: string) => apiClient.post('/subscription/checkout', { planId, couponCode });
const getCheckoutStatus = async (txid: string) => apiClient.get(`/subscription/checkout/${txid}`);
const activateTrial = async () => apiClient.post('/subscription/trial');
const validateCoupon = async (code: string, planId: string) => apiClient.post('/coupons/validate', { code, planId });
// Pagamento manual (usuário)
const getPaymentMethods = async () => apiClient.get('/subscription/payment-methods');
const createManualCheckout = async (planId: string, couponCode?: string) => apiClient.post('/subscription/checkout/manual', { planId, couponCode });
const submitManualProof = async (txid: string, data: { dataBase64: string; mime: string }) =>
  apiClient.post(`/subscription/checkout/manual/${txid}/proof`, data);

// ==================== PAGAMENTOS (admin) ====================

export interface ProviderConfigDTO {
  id: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  environment: 'sandbox' | 'production';
  sandboxClientId: string;
  sandboxClientSecret: string;
  sandboxCertPath: string | null;
  sandboxPixKey: string | null;
  prodClientId: string;
  prodClientSecret: string;
  prodCertPath: string | null;
  prodPixKey: string | null;
  webhookSecret: string;
  webhookBaseUrl: string | null;
  updatedAt: string;
}

export interface UpdateProviderConfigDTO {
  isActive?: boolean;
  environment?: 'sandbox' | 'production';
  sandboxClientId?: string;
  sandboxClientSecret?: string;
  sandboxCertPath?: string;
  sandboxPixKey?: string;
  prodClientId?: string;
  prodClientSecret?: string;
  prodCertPath?: string;
  prodPixKey?: string;
  webhookSecret?: string;
  webhookBaseUrl?: string;
}

export interface PaymentTxDTO {
  id: string;
  txid: string;
  provider: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paidAt: string | null;
  createdAt: string;
  user: { id: string; fullname: string; email: string } | null;
  plan: { id: string; name: string } | null;
}

export interface AdminDashboardDTO {
  totalUsers: number;
  activeSubscriptions: number;
  revenueTotalCents: number;
  revenueMonthCents: number;
  paidCount: number;
  pendingCount: number;
  recentTransactions: Array<{
    id: string; txid: string; amountCents: number; status: string; createdAt: string;
    user: { fullname: string; email: string } | null; plan: { name: string } | null;
  }>;
}

// ==================== USUÁRIOS (admin) ====================

export interface AdminUserDTO {
  id: string;
  fullname: string;
  email: string;
  cpf: string;
  phone: string;
  role: string;
  level: number;
  profile: string;
  trialUsedAt: string | null;
  activeSubscription: UserPlanDTO | null;
}

export interface AdminUserDetailDTO {
  user: Omit<AdminUserDTO, 'activeSubscription'>;
  history: UserPlanDTO[];
  transactions: Array<{ id: string; txid: string; amountCents: number; status: string; paidAt: string | null; createdAt: string; plan: { id: string; name: string } | null }>;
}

const getAdminUsers = async (params: { search?: string; role?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.role) qp.append('role', params.role);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/admin/users${qs ? `?${qs}` : ''}`);
};
const getAdminUser = async (id: string) => apiClient.get(`/admin/users/${id}`);
const updateAdminUser = async (id: string, data: { role?: string; level?: number; fullname?: string; phone?: string }) => apiClient.put(`/admin/users/${id}`, data);
const grantUserPlan = async (id: string, planId: string, isTrial?: boolean) => apiClient.post(`/admin/users/${id}/grant`, { planId, isTrial });
const revokeUserPlan = async (id: string) => apiClient.post(`/admin/users/${id}/revoke`);

// ==================== AFILIADOS / CUPONS ====================

export interface AffiliateBalancesDTO {
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  lifetimeCents: number;
}

export interface AffiliateDTO {
  id: string;
  code: string;
  isActive: boolean;
  commissionType: 'percent' | 'fixed';
  commissionValue: number;
  holdDays: number;
  pixKey: string | null;
  totalReferrals: number;
  totalEarningsCents: number;
  lastCommissionAt: string | null;
  createdAt: string;
  notes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  user?: { id: string; fullname: string; email: string } | null;
  balances?: AffiliateBalancesDTO;
}

export interface CouponDTO {
  id: string;
  code: string;
  description: string | null;
  affiliateId: string | null;
  affiliate: { id: string; code: string; user: { id: string; fullname: string; email: string } | null } | null;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
  maxRedemptions: number;
  timesRedeemed: number;
  maxPerUser: number;
  minAmountCents: number;
  maxDiscountCents: number;
  firstPurchaseOnly: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCouponDTO {
  code?: string;
  description?: string | null;
  affiliateId?: string | null;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  isActive?: boolean;
  maxRedemptions?: number;
  maxPerUser?: number;
  minAmountCents?: number;
  maxDiscountCents?: number;
  firstPurchaseOnly?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface AffiliateRedemptionDTO {
  id: string;
  couponCode: string;
  customer: string;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  createdAt: string;
}

export interface AffiliateCommissionDTO {
  id: string;
  customer: string;
  couponCode: string | null;
  baseAmountCents: number;
  amountCents: number;
  status: 'pending' | 'available' | 'paid' | 'cancelled';
  availableAt: string | null;
  createdAt: string;
}

export interface AffiliatePayoutDTO {
  id: string;
  amountCents: number;
  commissionsCount: number;
  method: string;
  pixKey: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  createdAt: string;
}

export interface AffiliateDashboardDTO {
  affiliate: AffiliateDTO;
  balances: AffiliateBalancesDTO;
  totals: {
    lifetimeCommissionCents: number;
    totalReferrals: number;
    totalRedemptions: number;
    periodCommissionCents: number;
    periodSalesCents: number;
    periodSalesCount: number;
  };
  daily: Array<{ date: string; sales: number; salesCents: number; commissionCents: number }>;
}

export interface ActivateAffiliateDTO {
  userId: string;
  code?: string;
  commissionType?: 'percent' | 'fixed';
  commissionValue?: number;
  holdDays?: number;
  pixKey?: string | null;
  notes?: string | null;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
}

// --- Afiliado (usuario logado) ---
const getAffiliateMe = async () => apiClient.get('/affiliate/me');
const getAffiliateDashboard = async (period: 'week' | 'month' | 'year' | 'all' = 'month') => apiClient.get(`/affiliate/dashboard?period=${period}`);
const getAffiliateCoupons = async () => apiClient.get('/affiliate/coupons');
const getAffiliateRedemptions = async (params: { page?: number; limit?: number; search?: string } = {}) => {
  const qp = new URLSearchParams();
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  if (params.search) qp.append('search', params.search);
  const qs = qp.toString();
  return apiClient.get(`/affiliate/redemptions${qs ? `?${qs}` : ''}`);
};
const getAffiliateCommissions = async (params: { page?: number; limit?: number; status?: string } = {}) => {
  const qp = new URLSearchParams();
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  if (params.status) qp.append('status', params.status);
  const qs = qp.toString();
  return apiClient.get(`/affiliate/commissions${qs ? `?${qs}` : ''}`);
};
const getAffiliatePayouts = async (params: { page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/affiliate/payouts${qs ? `?${qs}` : ''}`);
};

// --- Admin: afiliados ---
const getAdminAffiliates = async (params: { search?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.search) qp.append('search', params.search);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/admin/affiliates${qs ? `?${qs}` : ''}`);
};
const getAdminAffiliate = async (id: string) => apiClient.get(`/admin/affiliates/${id}`);
const activateAffiliate = async (data: ActivateAffiliateDTO) => apiClient.post('/admin/affiliates/activate', data);
const updateAffiliate = async (id: string, data: Partial<Pick<AffiliateDTO, 'isActive' | 'commissionType' | 'commissionValue' | 'holdDays' | 'pixKey' | 'notes'>>) => apiClient.put(`/admin/affiliates/${id}`, data);
const createAffiliatePayout = async (id: string, data: { note?: string; pixKey?: string; reference?: string } = {}) => apiClient.post(`/admin/affiliates/${id}/payout`, data);

// --- Admin: cupons ---
const getAdminCoupons = async (params: { type?: 'system' | 'affiliate' | 'all'; affiliateId?: string; search?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.type) qp.append('type', params.type);
  if (params.affiliateId) qp.append('affiliateId', params.affiliateId);
  if (params.search) qp.append('search', params.search);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/admin/coupons${qs ? `?${qs}` : ''}`);
};
const createCoupon = async (data: UpsertCouponDTO) => apiClient.post('/admin/coupons', data);
const updateCoupon = async (id: string, data: UpsertCouponDTO) => apiClient.put(`/admin/coupons/${id}`, data);
const deleteCoupon = async (id: string) => apiClient.delete(`/admin/coupons/${id}`);

// ==================== REPORTS / OCULTAR / EXCLUSÕES ====================

export type ReportReason = 'different_teams' | 'event_not_found' | 'wrong_markets' | 'different_odds' | 'closed_market' | 'other';

export interface CreateReportDTO {
  reason: ReportReason;
  scope: 'event' | 'leg';
  eventId: string;
  sport?: string;
  league?: string;
  home?: string;
  away?: string;
  eventStartAt?: string | null;
  bookmaker?: string;
  houseEventId?: string;
  market?: string;
  selection?: string;
  handicap?: string;
  price?: number;
  surebetKey?: string;
  note?: string;
}

export interface ReportDTO {
  id: string;
  reason: ReportReason;
  scope: 'event' | 'leg';
  eventId: string;
  sport: string;
  league: string | null;
  home: string | null;
  away: string | null;
  eventStartAt: string | null;
  bookmaker: string | null;
  houseEventId: string | null;
  market: string | null;
  selection: string | null;
  handicap: string | null;
  price: number | null;
  surebetKey: string | null;
  note: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  user: { id: string; fullname: string; email: string } | null;
}

export interface HiddenItemDTO {
  id: string;
  type: 'event' | 'house' | 'selection';
  itemKey: string;
  label: string | null;
  eventStartAt: string | null;
  createdAt: string;
}

export interface ExclusionDTO {
  id: string;
  scope: 'house' | 'event' | 'market';
  bookmaker: string | null;
  houseEventId: string | null;
  market: string | null;
  groupId: string | null;
  label: string | null;
  reason: string | null;
  createdBy: string | null;
  isActive: boolean;
  createdAt: string;
}

// Reports (usuário)
const createReport = async (data: CreateReportDTO) => apiClient.post('/reports', data);
const getMyReports = async () => apiClient.get('/reports/mine');
// Reports (admin)
const getReports = async (params: { status?: string; reason?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.status) qp.append('status', params.status);
  if (params.reason) qp.append('reason', params.reason);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/reports${qs ? `?${qs}` : ''}`);
};
const updateReport = async (id: string, data: { status?: string; adminNote?: string }) => apiClient.put(`/reports/${id}`, data);

// Ocultar (usuário)
const getHidden = async () => apiClient.get('/hidden');
const addHidden = async (type: 'event' | 'house' | 'selection', itemKey: string, label?: string, eventStartAt?: string | null) => apiClient.post('/hidden', { type, itemKey, label, eventStartAt });
const removeHidden = async (type: 'event' | 'house' | 'selection', itemKey: string) => apiClient.delete('/hidden', { data: { type, itemKey } });
const clearHidden = async () => apiClient.delete('/hidden/clear');

// Exclusões (admin)
const getExclusions = async () => apiClient.get('/exclusions');
const createExclusion = async (data: { scope: 'house' | 'event' | 'market'; bookmaker?: string; houseEventId?: string; market?: string; groupId?: string; label?: string; reason?: string; eventStartAt?: string | null }) => apiClient.post('/exclusions', data);
const deleteExclusion = async (id: string) => apiClient.delete(`/exclusions/${id}`);

const getPaymentDashboard = async () => apiClient.get('/payment/dashboard');
const getPaymentTransactions = async (params: { status?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.status) qp.append('status', params.status);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/payment/transactions${qs ? `?${qs}` : ''}`);
};
const getProviderConfig = async () => apiClient.get('/payment/config');
const updateProviderConfig = async (data: UpdateProviderConfigDTO) => apiClient.put('/payment/config', data);
const uploadProviderCert = async (data: { environment: 'sandbox' | 'production'; filename: string; dataBase64: string }) =>
  apiClient.post('/payment/config/cert', data);
const registerPaymentWebhook = async () => apiClient.post('/payment/config/register-webhook');
const getPaymentWebhookInfo = async () => apiClient.get('/payment/config/webhook-info');

// ---------- Provider manual (admin) ----------
export interface ManualConfigDTO {
  id: string;
  provider: string;
  isActive: boolean;
  displayName: string;
  pixKey: string | null;
  pixCopiaECola: string | null;
  hasQr: boolean;
  qrImage: string | null;
  instructions: string | null;
  updatedAt: string;
}
export interface UpdateManualConfigDTO {
  isActive?: boolean;
  displayName?: string;
  pixKey?: string;
  pixCopiaECola?: string;
  instructions?: string;
}
export interface ManualReviewItemDTO {
  id: string;
  txid: string;
  amountCents: number;
  status: string;
  hasProof: boolean;
  proofMime: string | null;
  proofUploadedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; fullname: string; email: string } | null;
  plan: { id: string; name: string } | null;
}

const getManualConfig = async () => apiClient.get('/payment/manual/config');
const updateManualConfig = async (data: UpdateManualConfigDTO) => apiClient.put('/payment/manual/config', data);
const uploadManualQr = async (data: { dataBase64: string; mime: string }) => apiClient.post('/payment/manual/config/qr', data);
const deleteManualQr = async () => apiClient.delete('/payment/manual/config/qr');
const getManualReviewQueue = async (params: { status?: string; page?: number; limit?: number } = {}) => {
  const qp = new URLSearchParams();
  if (params.status) qp.append('status', params.status);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  const qs = qp.toString();
  return apiClient.get(`/payment/manual/review${qs ? `?${qs}` : ''}`);
};
const getManualProof = async (txid: string) => apiClient.get(`/payment/manual/review/${txid}/proof`);
const approveManualPayment = async (txid: string, note?: string) => apiClient.post(`/payment/manual/review/${txid}/approve`, { note });
const rejectManualPayment = async (txid: string, note: string) => apiClient.post(`/payment/manual/review/${txid}/reject`, { note });

// ==================== ANALYTIX (rastreador de apostas + banca) ====================

export type LegStatusValue = 'pending' | 'won' | 'lost' | 'void' | 'half_won' | 'half_lost' | 'cashout';
export type BetStatusValue = 'open' | 'partially_settled' | 'settled' | 'void';
export type TxTypeValue = 'deposit' | 'withdrawal' | 'adjustment' | 'bonus' | 'partner_payout' | 'bet_result';
export type CostModelValue = 'rent' | 'profit_share' | 'hybrid';

export interface PartnerReportDTO {
  accountCount: number;
  profit: number;
  profitSharePct: number;
  owedFromShare: number;
  rentAmount: number;
  totalPaid: number;
  balanceDue: number;
}

export interface PartnerDTO {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  pixKey: string | null;
  costModel: CostModelValue;
  rentAmount: number | null;
  rentPeriod: 'week' | 'month';
  profitSharePct: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  report?: PartnerReportDTO;
}

export interface CreatePartnerDTO {
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  pixKey?: string;
  costModel?: CostModelValue;
  rentAmount?: number;
  rentPeriod?: 'week' | 'month';
  profitSharePct?: number;
  notes?: string;
}

export interface ValuebetConfigDTO {
  referenceBookmaker: string;
  allowedHouses: string[];
  edgeFloor: number;
  edgeCeil: number;
  edgeMax: number;
  cMin: number;
  oddMin: number;
  oddMax: number;
  kellyFraction: number;
  tierWeights: Record<string, number>;
  consensus: { enabled: boolean; minSources: number; dispersionMax: number };
}

export interface ClvSummaryDTO {
  settledCount: number;
  clvAvgPct: number | null;
  edgeAvgPct: number | null;
  clvPositivePct: number | null;
  pendingCount: number;
  windowDays: number;
}

export interface ClvBreakdownRowDTO {
  key: string;
  n: number;
  clvAvgPct: number | null;
  edgeAvgPct: number | null;
  clvPositivePct: number | null;
}

// Ranking de juice/margem por casa ou mercado (doc 11 §6.1) — sobre TODAS as
// emissões com house_vig (independente de settled), menor juice primeiro.
export interface JuiceRowDTO {
  key: string;
  n: number;
  juiceAvgPct: number | null; // house_vig × 100
}

export interface ClvPendingDTO {
  emissionId: string;
  bookmaker: string;
  market: string;
  selection: string;
  handicap: string | null;
  tier: number | null;
  ref: string | null;
  oddTaken: number;
  edgeTakenPct: number;
  confidence: number;
  houseVig: number | null; // juice/margem da casa (fração) — doc 11
  eventDate: string | null;
  takenAt: string;
}

export interface BankrollDTO {
  id: string;
  name: string;
  currency: string;
  kind?: 'general' | 'valuebet';
  initialCapital: number;
  unitValue: number;
  commissionPct: number | null;
  isDefault: boolean;
  isActive: boolean;
  visibility: 'private' | 'followers' | 'public';
  showCurrency: boolean;
  isPublic: boolean;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDTO {
  id: string;
  slug: string;
  label: string | null;
  isCustom: boolean;
  customName: string | null;
  customLogoUrl: string | null;
  customColor: string | null;
  partnerId: string | null;
  partnerName: string | null;
  bankrollId: string | null;
  bankrollName: string | null;
  initialBalance: number;
  username: string | null;
  scope: string | null;
  limited: boolean;
  isActive: boolean;
  notes: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface BetLegDTO {
  id: string;
  bookmakerSlug: string;
  accountId: string | null;
  houseEventId: string | null;
  market: string | null;
  rawMarket: string | null;
  selection: string | null;
  handicap: string | null;
  side: 'back' | 'lay';
  isFreebet: boolean;
  odd: number;
  stake: number;
  commissionPct: number | null;
  closingOdd: number | null;
  status: LegStatusValue;
  settledReturn: number | null;
  legProfit: number | null;
  potentialReturn: number;
  settledAt: string | null;
}

export interface BetDTO {
  id: string;
  bankrollId: string;
  betType: 'arb' | 'single';
  status: BetStatusValue;
  eventId: string | null;
  home: string | null;
  away: string | null;
  sport: string | null;
  league: string | null;
  eventStart: string | null;
  surebetKey: string | null;
  totalStake: number;
  expectedProfitPct: number | null;
  expectedProfit: number | null;
  realizedProfit: number | null;
  turnover: number;
  roiPct: number | null;
  tags: string[];
  notes: string | null;
  source: string;
  hidden: boolean;
  legs: BetLegDTO[];
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BetsPageDTO {
  items: BetDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionDTO {
  id: string;
  bankrollId: string;
  accountId: string | null;
  partnerId: string | null;
  type: TxTypeValue;
  amount: number;
  betId: string | null;
  description: string | null;
  createdAt: string;
}

export interface AnalytixSummaryDTO {
  totalProfit: number;
  turnover: number;
  roi: number;
  yield: number;
  winRate: number;
  avgOdd: number;
  betsCount: number;
  openCount: number;
  settledCount: number;
  currentBankroll: number;
  roiBase: number;
}

export interface TimeseriesPointDTO {
  date: string;
  profit: number;
  netFlow: number;
  cumulativeProfit: number;
  bankroll: number;
}

export interface BreakdownRowDTO {
  key: string;
  betsCount: number;
  turnover: number;
  profit: number;
  yield: number;
  winRate: number;
  avgOdd: number;
}

export interface CreateBetLegDTO {
  bookmakerSlug: string;
  accountId?: string | null;
  houseEventId?: string | null;
  market?: string | null;
  rawMarket?: string | null;
  selection?: string | null;
  handicap?: string | null;
  side?: 'back' | 'lay';
  isFreebet?: boolean;
  odd: number;
  stake: number;
  commissionPct?: number | null;
}

export interface CreateBetDTO {
  bankrollId?: string;
  betType: 'arb' | 'single';
  eventId?: string | null;
  home?: string | null;
  away?: string | null;
  sport?: string | null;
  league?: string | null;
  eventStart?: string | null;
  surebetKey?: string | null;
  totalStake: number;
  expectedProfitPct?: number | null;
  expectedProfit?: number | null;
  source: 'calculator' | 'manual';
  tags?: string[];
  notes?: string | null;
  legs: CreateBetLegDTO[];
}

export interface CreateAccountDTO {
  slug?: string;
  label?: string;
  initialBalance?: number;
  username?: string;
  scope?: string;
  notes?: string;
  isCustom?: boolean;
  customName?: string;
  customLogoUrl?: string;
  customColor?: string;
  partnerId?: string | null;
  bankrollId?: string | null;
}

export interface SettleLegInput { legId: string; status: LegStatusValue; settledReturn?: number; legProfit?: number }

const analytixQp = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : '';
};

// Bancas
const getBankrolls = async () => apiClient.get('/analytix/bankrolls');
const createBankroll = async (data: { name: string; initialCapital?: number; currency?: string; unitValue?: number; commissionPct?: number }) => apiClient.post('/analytix/bankrolls', data);
// Garante (e retorna) a banca dedicada de value bet do usuário.
const ensureValuebetBankroll = async () => apiClient.post('/analytix/bankrolls/ensure-valuebet', {});

// ===================== VALUE BETS — config (admin) + CLV =====================
const getValuebetConfig = async () => apiClient.get('/valuebet/config');
const updateValuebetConfig = async (data: Partial<ValuebetConfigDTO>) => apiClient.put('/valuebet/config', data);
const getClvSummary = async (days = 30) => apiClient.get(`/valuebet/clv/summary?days=${days}`);
const getClvBreakdown = async (dimension: 'bookmaker' | 'market' | 'tier', days = 30) => apiClient.get(`/valuebet/clv/breakdown?dimension=${dimension}&days=${days}`);
const getJuiceBreakdown = async (dimension: 'bookmaker' | 'market', days = 30) => apiClient.get(`/valuebet/clv/juice?dimension=${dimension}&days=${days}`);
const getClvTimeseries = async (days = 30) => apiClient.get(`/valuebet/clv/timeseries?days=${days}`);
const getClvPending = async (limit = 100) => apiClient.get(`/valuebet/clv/pending?limit=${limit}`);
const updateBankroll = async (id: string, data: Partial<{ name: string; initialCapital: number; currency: string; unitValue: number; commissionPct: number; isDefault: boolean; isActive: boolean }>) => apiClient.put(`/analytix/bankrolls/${id}`, data);
const deleteBankroll = async (id: string) => apiClient.delete(`/analytix/bankrolls/${id}`);

// Casas do usuário
const getMyAccounts = async () => apiClient.get('/analytix/accounts');
const createAccount = async (data: CreateAccountDTO) => apiClient.post('/analytix/accounts', data);
const updateAccount = async (id: string, data: Partial<{ label: string; initialBalance: number; username: string; scope: string; notes: string; limited: boolean; isActive: boolean; customName: string; customLogoUrl: string; customColor: string; partnerId: string | null; bankrollId: string | null }>) => apiClient.put(`/analytix/accounts/${id}`, data);
const deleteAccount = async (id: string) => apiClient.delete(`/analytix/accounts/${id}`);

// Parceiros (donos de conta)
const getPartners = async () => apiClient.get('/analytix/partners');
const createPartner = async (data: CreatePartnerDTO) => apiClient.post('/analytix/partners', data);
const updatePartner = async (id: string, data: Partial<CreatePartnerDTO & { isActive: boolean }>) => apiClient.put(`/analytix/partners/${id}`, data);
const deletePartner = async (id: string) => apiClient.delete(`/analytix/partners/${id}`);

// Apostas
const getBets = async (params: { status?: string; bookmaker?: string; sport?: string; betType?: string; bankrollId?: string; from?: string; to?: string; page?: number; limit?: number } = {}) => apiClient.get(`/analytix/bets${analytixQp(params)}`);
const getBetById = async (id: string) => apiClient.get(`/analytix/bets/${id}`);
const createBet = async (data: CreateBetDTO) => apiClient.post('/analytix/bets', data);
const updateBet = async (id: string, data: Partial<{ tags: string[]; notes: string; hidden: boolean; home: string; away: string; sport: string; league: string }>) => apiClient.put(`/analytix/bets/${id}`, data);
const settleBet = async (id: string, legs: SettleLegInput[]) => apiClient.post(`/analytix/bets/${id}/settle`, { legs });
const deleteBet = async (id: string) => apiClient.delete(`/analytix/bets/${id}`);

// Transações
const getAnalytixTransactions = async (params: { bankrollId?: string; accountId?: string; type?: string; from?: string; to?: string } = {}) => apiClient.get(`/analytix/transactions${analytixQp(params)}`);
const createAnalytixTransaction = async (data: { bankrollId: string; type: TxTypeValue; amount: number; accountId?: string; partnerId?: string; description?: string }) => apiClient.post('/analytix/transactions', data);
const deleteAnalytixTransaction = async (id: string) => apiClient.delete(`/analytix/transactions/${id}`);

// Analytics
const getAnalytixSummary = async (params: { bankrollId?: string; from?: string; to?: string } = {}) => apiClient.get(`/analytix/summary${analytixQp(params)}`);
const getAnalytixTimeseries = async (params: { bankrollId?: string; from?: string; to?: string; bucket?: 'day' | 'week' | 'month' } = {}) => apiClient.get(`/analytix/timeseries${analytixQp(params)}`);
const getAnalytixBreakdown = async (params: { by?: 'bookmaker' | 'sport' | 'league' | 'market' | 'month'; bankrollId?: string; from?: string; to?: string } = {}) => apiClient.get(`/analytix/breakdown${analytixQp(params)}`);

// ==================== COMUNIDADE ====================

export type VisibilityValue = 'private' | 'followers' | 'public';

export interface PublicStatsDTO {
  roi: number; yield: number; winRate: number; avgOdd: number;
  betsCount: number; settledCount: number; openCount: number; verifiedCount: number;
  profitUnits: number | null; totalProfit?: number; currentBankroll?: number;
}
export interface PublicProfileDTO {
  handle: string; displayName: string; avatar: string | null; bio: string | null;
  isVerifiedTipster: boolean; followersCount: number; followingCount: number;
  realName: string | null; since: string; showCurrency: boolean; unit: number;
  stats: PublicStatsDTO;
  isFollowing?: boolean; isSelf?: boolean;
}
export interface PublicBetLegDTO {
  houseLabel: string; market: string | null; selection: string | null; handicap: string | null;
  side: 'back' | 'lay'; isFreebet: boolean; odd: number; status: LegStatusValue;
  stake?: number; stakeUnits?: number | null;
}
export interface PublicBetDTO {
  id: string; home: string | null; away: string | null; sport: string | null; league: string | null;
  eventStart: string | null; createdAt: string; settledAt: string | null;
  betType: 'arb' | 'single'; status: BetStatusValue; verified: 'verified' | 'unverified';
  expectedProfitPct: number | null; roiPct: number | null; profitUnits: number | null; stakeUnits: number | null;
  realizedProfit?: number | null; totalStake?: number; legs: PublicBetLegDTO[];
}
export interface PublicCurvePointDTO { date: string; index: number; profitUnits: number | null }
export interface ProfileCardDTO {
  handle: string; displayName: string; avatar: string | null; bio: string | null;
  isVerifiedTipster: boolean; followersCount: number; roi: number; yield: number; betsCount: number; winRate: number;
  isFollowing?: boolean; isSelf?: boolean;
}

export interface LeaderboardEntryDTO {
  rank: number; handle: string; displayName: string; avatar: string | null; isVerifiedTipster: boolean;
  betsCount: number; yield: number; roi: number; winRate: number; avgOdd: number; profitUnits: number;
  lowSample: boolean; isFollowing?: boolean; isSelf?: boolean;
}
export interface LeaderboardDTO { items: LeaderboardEntryDTO[]; communityYield: number; minSample: number }

export interface BreakdownPublicRowDTO { key: string; betsCount: number; yield: number }
export interface CommunityAnalyticsDTO {
  kpis: { activeUsers: number; totalBets: number; settledBets: number; yield: number; avgOdd: number };
  bySport: BreakdownPublicRowDTO[];
  byMarket: BreakdownPublicRowDTO[];
  byHouse: { slug: string; count: number }[];
  trending: { home: string | null; away: string | null; sport: string | null; count: number }[];
}

export interface FeedAuthorDTO { handle: string; displayName: string; avatar: string | null; isVerifiedTipster: boolean }
export interface FeedItemDTO { author: FeedAuthorDTO; bet: PublicBetDTO }
export interface NotificationDTO {
  id: string; kind: string; actorHandle: string | null; actorName: string | null; actorAvatar: string | null;
  targetId: string | null; title: string | null; readAt: string | null; createdAt: string;
}
export interface MyCommunityProfileDTO {
  id: string; handle: string; displayName: string | null; avatar: string | null; bio: string | null;
  visibility: VisibilityValue; showRealName: boolean; isVerifiedTipster: boolean;
  followersCount: number; followingCount: number; createdAt: string; updatedAt: string;
}
export interface CommunityConsentDTO { id: string; type: string; granted: boolean; termsVersion: string; createdAt: string }
export interface SaveProfileDTO { handle?: string; displayName?: string; avatar?: string; bio?: string; visibility?: VisibilityValue; showRealName?: boolean }

const getCommunityProfiles = async () => apiClient.get('/community/profiles');
const getPublicProfile = async (handle: string) => apiClient.get(`/community/u/${encodeURIComponent(handle)}`);
const getPublicTrackRecord = async (handle: string, params: { page?: number; limit?: number } = {}) => apiClient.get(`/community/u/${encodeURIComponent(handle)}/track-record${analytixQp(params)}`);
const getPublicCurve = async (handle: string, params: { bucket?: 'day' | 'week' | 'month' } = {}) => apiClient.get(`/community/u/${encodeURIComponent(handle)}/curve${analytixQp(params)}`);
const getMyCommunityProfile = async () => apiClient.get('/community/profile/me');
const saveCommunityProfile = async (data: SaveProfileDTO) => apiClient.post('/community/profile', data);
const recordCommunityConsent = async (data: { type: string; granted: boolean }) => apiClient.post('/community/profile/consent', data);
const setBankrollVisibility = async (id: string, data: { visibility: VisibilityValue; showCurrency?: boolean }) => apiClient.put(`/community/bankrolls/${id}/visibility`, data);
const setBetVisibility = async (id: string, data: { visibility: 'inherit' | VisibilityValue }) => apiClient.put(`/community/bets/${id}/visibility`, data);
const followUser = async (handle: string) => apiClient.post(`/community/follow/${encodeURIComponent(handle)}`);
const unfollowUser = async (handle: string) => apiClient.delete(`/community/follow/${encodeURIComponent(handle)}`);
const getCommunityFeed = async (params: { page?: number; limit?: number } = {}) => apiClient.get(`/community/feed${analytixQp(params)}`);
const getLeaderboard = async (params: { window?: string; metric?: string; sport?: string; minSample?: number } = {}) => apiClient.get(`/community/leaderboard${analytixQp(params)}`);
const getCommunityAnalytics = async (params: { window?: string } = {}) => apiClient.get(`/community/analytics${analytixQp(params)}`);
const getCommunityNotifications = async () => apiClient.get('/community/notifications');
const markCommunityNotificationsRead = async () => apiClient.put('/community/notifications/read');

export const apiGateway = {
    register,
    login,
    logout,
    getUserInfo,
    getUserAuth,
    changePassowrd,
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
    getHomeStats,
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
    deleteMarketName,
    // Planos & assinatura
    getPlans,
    getAllPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getMySubscription,
    createCheckout,
    getCheckoutStatus,
    activateTrial,
    validateCoupon,
    // Pagamento manual (usuário)
    getPaymentMethods,
    createManualCheckout,
    submitManualProof,
    // Pagamentos (admin)
    getPaymentDashboard,
    getPaymentTransactions,
    getProviderConfig,
    updateProviderConfig,
    uploadProviderCert,
    registerPaymentWebhook,
    getPaymentWebhookInfo,
    // Provider manual (admin)
    getManualConfig,
    updateManualConfig,
    uploadManualQr,
    deleteManualQr,
    getManualReviewQueue,
    getManualProof,
    approveManualPayment,
    rejectManualPayment,
    // Usuários (admin)
    getAdminUsers,
    getAdminUser,
    updateAdminUser,
    grantUserPlan,
    revokeUserPlan,
    // Afiliados / cupons
    getAffiliateMe,
    getAffiliateDashboard,
    getAffiliateCoupons,
    getAffiliateRedemptions,
    getAffiliateCommissions,
    getAffiliatePayouts,
    getAdminAffiliates,
    getAdminAffiliate,
    activateAffiliate,
    updateAffiliate,
    createAffiliatePayout,
    getAdminCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    // Reports / ocultar / exclusões
    createReport,
    getMyReports,
    getReports,
    updateReport,
    getHidden,
    addHidden,
    removeHidden,
    clearHidden,
    getExclusions,
    createExclusion,
    deleteExclusion,
    // Analytix
    getBankrolls,
    createBankroll,
    ensureValuebetBankroll,
    getValuebetConfig,
    updateValuebetConfig,
    getClvSummary,
    getClvBreakdown,
    getJuiceBreakdown,
    getClvTimeseries,
    getClvPending,
    updateBankroll,
    deleteBankroll,
    getMyAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getPartners,
    createPartner,
    updatePartner,
    deletePartner,
    getBets,
    getBetById,
    createBet,
    updateBet,
    settleBet,
    deleteBet,
    getAnalytixTransactions,
    createAnalytixTransaction,
    deleteAnalytixTransaction,
    getAnalytixSummary,
    getAnalytixTimeseries,
    getAnalytixBreakdown,
    // Comunidade
    getCommunityProfiles,
    getPublicProfile,
    getPublicTrackRecord,
    getPublicCurve,
    getMyCommunityProfile,
    saveCommunityProfile,
    recordCommunityConsent,
    setBankrollVisibility,
    setBetVisibility,
    followUser,
    unfollowUser,
    getCommunityFeed,
    getLeaderboard,
    getCommunityAnalytics,
    getCommunityNotifications,
    markCommunityNotificationsRead
};
    
export default apiGateway;