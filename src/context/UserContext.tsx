import { apiGateway, setupAxiosInterceptors } from "@/gateways";
import React, { createContext, useContext, useEffect, useState } from "react";

// Definindo a interface User conforme especificado
export interface User {
  id: string,
  fullname: string,
  cpf: string,
  phone: string,
  email: string,
  balace: string,
  role: string,
  level: number,
  referralCode: string,
  profile: string
}

interface UserContextType {
    user:  User | null;
    setUser: (user: User | null) => void;
    isAuthenticated: boolean;
    setIsAuthenticated: (auth: boolean) => void;
    // true enquanto a verificação inicial de auth está em andamento — evita
    // mostrar conteúdo "deslogado" por um instante para quem está logado.
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Intercepta as respostas da API para verificar se o token expirou
    setupAxiosInterceptors(setUser, setIsAuthenticated);

    // Verificação inicial de autenticação
    const checkAuthStatus = async () => {
        try {
          const response = await apiGateway.getUserInfo();
          if (response.data.result === 1) {
            setUser(response.data.data.user);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        } catch {
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
        }
      };
      checkAuthStatus();
      // Adiciona verificação periódica
      const interval = setInterval(checkAuthStatus, 5 * 60 * 1000); // A cada 5 minutos
      return () => clearInterval(interval);
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, isAuthenticated, setIsAuthenticated, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
};
