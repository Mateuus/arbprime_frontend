import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import FloatingInput from '@/components/ui/FloatingInput';
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';

const Login: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [currentError, setCurrentError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
      setLoading(true);
      setCurrentError('');
      try {
        const response = await login(email, password);    
        if (response.success) {
          onClose();
        } else {
          setCurrentError(response.message);
        }
    
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Erro ao entrar.';
        setCurrentError(message);
      } finally {
        setLoading(false);
      }
    };

  return (
    <>
      <div className="space-y-4">
          <FloatingInput
            label="E-mail"
            name="email"
            autoComplete='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
          />
          <FloatingInput
              label="Senha"
              name="password"
              autoComplete="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              type="password"
              placeholder="Senha"
              showTogglePassword
            />
         {currentError && (
              <div className="flex justify-center py-1">
                  <p className="text-red-500 mb-4 text-center">{currentError}</p>
              </div>
          )}  
         {loading ? (
            <div className="w-full flex justify-center">
              <SportsCryptoLoading />
            </div>
          ) : (
            <button 
            onClick={handleLogin}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold">
            Entrar
          </button>
          )}
      </div>
    </>
  );
};

export default Login;
