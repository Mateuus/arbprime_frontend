import { useUserContext } from "@/context/UserContext";
import { apiGateway } from '@/gateways';
import { wsManager } from "@/services/wsManager";


export const useAuth = () => {
  const context = useUserContext();
  if (!context) {
    throw new Error('useAuth must be used within a UserProvider');
  }

  const { user, setUser, isAuthenticated, setIsAuthenticated } = context;
  const login = async (username: string, password: string) => {
    try {
      const response = await apiGateway.login(username, password);

      if (response.status === 200) {
        // Ao receber a data de expiração do backend
        setUser(response.data.data); // Atualiza o estado do usuário
        setIsAuthenticated(true);

        const newToken = response.data.data.token;
        if (newToken) {
          wsManager.reconnect(newToken); // reconecta com token novo
        }
      }

      return response; // Retorna a resposta da API para que possa ser manipulada fora da função
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error; // Re-lança o erro para ser capturado pelo chamador
    } finally {}
  };

  const logout = async () => {
    try {
        // Chame a API para destruir o token, removendo o cookie HttpOnly
        await apiGateway.logout();
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    } finally {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('tokenExpiration');
    }
  };

  /*
  const updateUserBalance = async () => {
    try {
      // Buscar apenas o saldo atualizado
      const response = await apiGateway.getUserBalance();
      if (response.result == 1) {
        const newBalance = response.data.balance;

        if (user) {
          const updatedUser = { ...user, balance: newBalance };
          setUser(updatedUser); // Atualiza o estado do usuário
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar o saldo do usuário:', error);
    }
  };
  */

  return {
    login,
    logout,
    isAuthenticated,
    user
    //updateUserBalance
  };
};