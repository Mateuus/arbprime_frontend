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
    getEventDetails
};
    
export default apiGateway;