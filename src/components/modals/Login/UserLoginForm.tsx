import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

const UserLoginForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        setErrorMessage(null);
      
        const result = await login(email, password);
      
        if (result.success) {
          onClose(); // Login bem-sucedido
        } else {
          setErrorMessage(result.message);
        }
      
        setLoading(false);
      };
      
    return (
        <div className="bg-gray-300 flex-grow p-6 flex flex-col text-black">
            <label htmlFor="email" className="mb-1 text-gray-700 font-semibold">Email</label>
            <input 
                id="email"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Digite seu email" 
                className={`w-full p-3 mb-4 border ${errorMessage ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:${errorMessage ? 'ring-red-600' : 'ring-red-600'}`}
            />

            <label htmlFor="password" className="mb-1 text-gray-700 font-semibold">Senha</label>
            <div className="relative w-full mb-4">
                <input 
                    id="password"
                    type={showPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Digite sua senha" 
                    className={`w-full p-3  border ${errorMessage ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:${errorMessage ? 'ring-red-600' : 'ring-red-600'}`}
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-3 top-3 text-gray-600 hover:text-gray-800 focus:outline-none"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>

            {errorMessage && (
                <div className="flex justify-center">
                    <p className="text-red-500 mb-4 text-center">{errorMessage}</p>
                </div>
            )}

            <button 
                onClick={handleLogin} 
                className={`w-full p-3 rounded-lg font-semibold ${email && password ? 'bg-brand-button text-white hover:bg-brand-dark' : 'bg-gray-400 text-gray-800 cursor-not-allowed'}`}
                disabled={!email || !password || loading}
            >
                {loading ? 'Carregando...' : 'ENTRAR'}
            </button>
        </div>
    );
};

export default UserLoginForm;