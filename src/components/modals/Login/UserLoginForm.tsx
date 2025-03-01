import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';
import { AxiosError } from 'axios';

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

        try {
            const response = await login(email, password);

            if (response.status === 200) {
                onClose(); // Fecha o modal após o sucesso do login
            } else {
                setErrorMessage(response.data?.message || "Erro ao tentar fazer login.");
            }
        } catch (error: unknown) {
            const axiosError = error as AxiosError;
            if (axiosError.response) {
                if (axiosError.response.status === 401) {
                    setErrorMessage(
                        (axiosError.response.data as { message: string })?.message || "Nome de usuário ou senha inválidos"
                    );
                } else {
                    setErrorMessage("Ocorreu um erro ao tentar fazer login. Por favor, tente novamente.");
                }
            } else {
                setErrorMessage("Erro inesperado. Por favor, verifique sua conexão ou tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-300 flex-grow p-6 flex flex-col">
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
                    className={`w-full p-3 border ${errorMessage ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:${errorMessage ? 'ring-red-600' : 'ring-red-600'}`}
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
                className={`w-full p-3 rounded-lg font-semibold ${email && password ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-400 text-gray-800 cursor-not-allowed'}`}
                disabled={!email || !password || loading}
            >
                {loading ? 'Carregando...' : 'ENTRAR'}
            </button>
        </div>
    );
};

export default UserLoginForm;