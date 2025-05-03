import { useUserContext } from "@/context/UserContext";
import { apiGateway } from '@/gateways';
import { wsManager } from "@/services/wsManager";

export const useAuth = () => {
  const context = useUserContext();
  if (!context) {
    throw new Error('useAuth must be used within a UserProvider');
  }

  const { user, setUser, isAuthenticated, setIsAuthenticated } = context;
  const login = async (email: string, password: string) => {
    try {
      const response = await apiGateway.login(email, password);
      const resData = response.data;
  
      if (response.status === 200 && resData.result === 1) {
        setUser(resData.data);
        setIsAuthenticated(true);
  
        const token = resData.data.token;
        if (token) {
          wsManager.reconnect(token);
        }
  
        return { success: true, data: resData.data };
      }
  
      // Mesmo com 200, se result !== 1, falhou
      return { success: false, message: resData.message || 'Login falhou' };
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Erro ao fazer login.';
      return { success: false, message };
    }
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