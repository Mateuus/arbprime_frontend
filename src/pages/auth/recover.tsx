import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';
import FloatingInput from '@/components/ui/FloatingInput';

const Recover = () => {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');

  const goTo = (page: string) =>
    router.replace(
      { pathname: router.pathname, query: { ...router.query, modal: 'auth', page } },
      undefined,
      { shallow: true },
    );

  return (
    <div className="space-y-5">
      {/* Cabeçalho com a marca */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#012b2c] to-[#00141a] shadow-lg ring-1 ring-[#013f38]">
          <span className="text-2xl font-extrabold leading-none bg-gradient-to-br from-green-400 to-[#48fff3] bg-clip-text text-transparent">A</span>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight text-white">Recuperar senha</p>
          <p className="text-sm text-gray-400">Enviaremos as instruções para o seu e-mail.</p>
        </div>
      </div>

      <div className="space-y-3">
        <FloatingInput
          label="E-mail ou CPF"
          name="identifier"
          autoComplete="email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <button
          type="button"
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-[#00191d] shadow-lg shadow-teal-900/30 transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99]"
        >
          Recuperar Senha
        </button>
      </div>

      <button
        type="button"
        onClick={() => goTo('login')}
        className="mx-auto flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} /> Voltar para o login
      </button>
    </div>
  );
};

export default Recover;
