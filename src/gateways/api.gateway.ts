import axios from "axios";

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
        if (error.response?.status === 401) {
          // Trate o erro 401, removendo o usuário e autenticidade
          setUser(null); // Reseta o usuário
          setIsAuthenticated(false); // Define como não autenticado
          //console.warn("Erro 401: Usuário não autorizado. Reautenticação necessária.");
        }
        return Promise.reject(error); // Rejeita o erro para ser tratado onde a requisição foi feita
      }
    );
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

export const apiGateway = {
    login,
    logout,
    getUserInfo,
    getUserAuth
};
    
export default apiGateway;