import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import FloatingInput from '@/components/ui/FloatingInput';
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';
import ServerSelector from '@/components/ServerSelector';

const Login: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [currentError, setCurrentError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Navega entre as páginas do modal de auth (login/recover/register) mantendo
    // o modal aberto via query (?modal=auth&page=...).
    const goTo = (page: string) =>
      router.replace(
        { pathname: router.pathname, query: { ...router.query, modal: 'auth', page } },
        undefined,
        { shallow: true },
      );

    const handleLogin = async () => {
      if (loading) return;
      setLoading(true);
      setCurrentError('');
      try {
        const response = await login(email, password);
        if (response.success) {
          onClose();
        } else {
          setCurrentError(response.message);
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        const message = e?.response?.data?.message || 'Erro ao entrar.';
        setCurrentError(message);
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="space-y-5">
      {/* Cabeçalho com a marca */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#012b2c] to-[#00141a] shadow-lg ring-1 ring-[#013f38]">
          <span className="text-2xl font-extrabold leading-none bg-gradient-to-br from-green-400 to-[#48fff3] bg-clip-text text-transparent">A</span>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight">
            <span className="text-white">ARB</span><span className="text-green-500">PRIME</span>
          </p>
          <p className="text-sm text-gray-400">Bem-vindo de volta — entre para continuar.</p>
        </div>
      </div>

      {/* Seleção de servidor (Principal/Secundário) — some em dev/local. */}
      <ServerSelector compact />

      <form
        className="space-y-3"
        onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
      >
        <FloatingInput
          label="E-mail"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FloatingInput
          label="Senha"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Senha"
          showTogglePassword
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => goTo('recover')}
            className="text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
          >
            Esqueceu sua senha?
          </button>
        </div>

        {currentError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
            {currentError}
          </div>
        )}

        {loading ? (
          <div className="flex w-full justify-center py-1">
            <SportsCryptoLoading />
          </div>
        ) : (
          <button
            type="submit"
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-[#00191d] shadow-lg shadow-teal-900/30 transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99]"
          >
            Entrar
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </form>

      {/* Criar conta */}
      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-[#2b534f4d]" />
        <span className="text-xs text-gray-500">ou</span>
        <span className="h-px flex-1 bg-[#2b534f4d]" />
      </div>
      <p className="text-center text-sm text-gray-400">
        Ainda não tem conta?{' '}
        <button
          type="button"
          onClick={() => goTo('register')}
          className="font-semibold text-green-400 hover:text-green-300 transition-colors"
        >
          Criar conta
        </button>
      </p>
    </div>
  );
};

export default Login;
