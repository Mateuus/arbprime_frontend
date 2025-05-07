import React from 'react';
import FloatingInput from '@/components/ui/FloatingInput';
import { useUserContext } from '@/context/UserContext';
import { formatCpf } from '@/utils/functions';

const Details: React.FC = () => {
  const { user } = useUserContext();

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 rounded-xl shadow-lg">
      <form className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {/* Nome completo em toda a linha */}
        <div className="md:col-span-2">
          <FloatingInput
            label="Nome completo"
            name="fullname"
            autoComplete="name"
            value={user?.fullname || ''}
            onChange={() => {}}
            placeholder="Seu nome completo"
            disabled
          />
        </div>

        <FloatingInput
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={user?.email || ''}
          onChange={() => {}}
          placeholder="Digite seu e-mail"
          disabled
        />

        <FloatingInput
          label="CPF"
          name="cpf"
          autoComplete="cpf"
          value={formatCpf(user?.cpf || '') }
          onChange={() => {}}
          placeholder="000.000.000-00"
          disabled
        />

        <FloatingInput
          label="Telefone"
          name="phone"
          autoComplete="tel"
          value={user?.phone || ''}
          onChange={() => {}}
          placeholder="(00) 00000-0000"
        />
      </form>

      {/* Botão fixo no canto inferior direito */}
      <div className="absolute bottom-6 right-6">
        <button className="px-6 py-3 bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold rounded-xl">
          Salvar Alterações
        </button>
      </div>
    </div>
  );
};

export default Details;