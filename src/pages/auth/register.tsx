/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import FloatingInput from '@/components/ui/FloatingInput';
import AlertModal from "@/components/modals/AlertModal";
import { apiGateway } from '@/gateways/api.gateway';
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';
import { validatePassword } from '@/utils/functions';

function isValidCpf(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf.charAt(10));
}

const Register: React.FC = () => {
  const router = useRouter();
  const [fullName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [countryCode, setCountryCode] = useState('55');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cpf, setCpf] = useState('');
 
  const [nameDisabled, setNameDisabled] = useState(false);
  const [isVerifyingCpf, setIsVerifyingCpf] = useState(false);

  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMessage, setModalMessage] = useState('');

  const PASSWORD_MIN_LENGTH = 6;

  const newPassErrors = validatePassword(password);
  const isValid = password.length >= PASSWORD_MIN_LENGTH && newPassErrors.length === 0 && confirmPassword === password;

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length <= 11) {
      const formatted = formatCpf(raw);
      setCpf(formatted);
  
      // Verifica automaticamente quando o CPF tiver 11 dígitos
      if (raw.length === 11) {
        handleCpfVerify(formatted);
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');

    let formatted = raw;

    if (raw.length > 0) {
      formatted = '(' + raw.substring(0, 2); // DDD
    }
    if (raw.length >= 3) {
      formatted += ') ' + raw.substring(2, 3); // nono dígito
    }
    if (raw.length >= 4) {
      formatted += ' ' + raw.substring(3, 7); // primeira parte
    }
    if (raw.length >= 8) {
      formatted += '-' + raw.substring(7, 11); // segunda parte
    }

    setPhone(formatted);
  };

  const handleClearCpf = () => {
    setCpf('');
    setFirstName('');
    setNameDisabled(false);
  };

  const handleCpfVerify = async (cpfToVerify: string = cpf) => {
    const cleanCpf = cpfToVerify.replace(/\D/g, '');
    setCurrentError('');
    if (!isValidCpf(cleanCpf)) {
      setCurrentError('CPF inválido');
      return;
    }
  
    setIsVerifyingCpf(true);
    try {
      const res = await apiGateway.lookupCPF(cleanCpf);
      const data = res?.data?.data;
      if (data?.name) {
        setFirstName(data.name);
        setNameDisabled(true);
      } else {
        setCurrentError('Nome não encontrado para este CPF');
      }
    } catch (err) {
      console.error('Erro ao verificar CPF:', err);
      setCurrentError('Erro ao verificar CPF');
    } finally {
      setIsVerifyingCpf(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (confirmEmail && e.target.value !== confirmEmail) {
      setCurrentError('Os e-mails não coincidem');
    } else {
      setCurrentError('');
    }
  };

  const handleConfirmEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmEmail(e.target.value);
    if (email && e.target.value !== email) {
      setCurrentError('Os e-mails não coincidem');
    } else {
      setCurrentError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (confirmPassword && e.target.value !== confirmPassword) {
      setCurrentError('As senhas não coincidem');
    } else {
      setCurrentError('');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (password && e.target.value !== password) {
      setCurrentError('As senhas não coincidem');
    } else {
      setCurrentError('');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setCurrentError('');
    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanPhone = phone.replace(/\D/g, '');
      const formatPhone = `${countryCode}${cleanPhone}`;
      const response = await apiGateway.register(email, fullName, cleanCpf, formatPhone, password);
      const resData = response.data;
  
      if (response.status === 201) {
        setModalType("success");
        setModalMessage(resData.message);
        setShowModal(true);
      
        setTimeout(() => {
          router.push('/?modal=auth&page=login');
        }, 1000); // espera 2 segundos
      }
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Erro ao registar.';
      setCurrentError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="w-full max-w-[700px] text-white space-y-6 mx-auto">
      {/* Cabeçalho com a marca */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#012b2c] to-[#00141a] shadow-lg ring-1 ring-[#013f38]">
          <span className="text-2xl font-extrabold leading-none bg-gradient-to-br from-green-400 to-[#48fff3] bg-clip-text text-transparent">A</span>
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight">
            <span className="text-white">Crie sua </span><span className="text-green-500">conta</span>
          </p>
          <p className="text-sm text-gray-400">Cadastro rápido e seguro.</p>
        </div>
      </div>

      <div className="space-y-4">
      <FloatingInput
        label="CPF"
        name="cpf"
        autoComplete='cpf'
        value={cpf}
        onChange={handleCpfChange}
        placeholder="000.000.000-00"
        rightButtonLabel={
          nameDisabled && cpf.replace(/\D/g, '').length === 11
            ? isVerifyingCpf ? '...' : 'Limpar'
            : 'Verificar'
        }
        onRightButtonClick={
          nameDisabled && cpf.replace(/\D/g, '').length === 11
            ? handleClearCpf
            : () => handleCpfVerify()
        }
      />

        <FloatingInput
          label="Nome completo"
          name="firstName"
          autoComplete='name'
          value={fullName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Seu nome completo"
          disabled={nameDisabled}
        />

      <div className="grid grid-cols-[100px_1fr] gap-2">
        <FloatingInput
          label="Código"
          name="countryCode"
          autoComplete="off"
          value={countryCode}
          onChange={() => {}}
          disabled
        />
        <FloatingInput
          label="Telefone"
          name="tel"
          autoComplete="tel"
          value={phone}
          onChange={handlePhoneChange}
          type="tel"
          placeholder="Telefone"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FloatingInput
          label="E-mail"
          name="email"
          autoComplete='email'
          value={email}
          onChange={handleEmailChange}
        />
        <FloatingInput
          label="Confirmar E-mail"
          name="confirmEmail"
          autoComplete='email'
          value={confirmEmail}
          onChange={handleConfirmEmailChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
          <FloatingInput
            label="Senha"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={handlePasswordChange}
            type="password"
            placeholder="Senha"
            showTogglePassword
          />
          <FloatingInput
            label="Confirmar senha"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            type="password"
            placeholder="Confirme sua senha"
            showTogglePassword
          />
      </div>

        {password && newPassErrors.length > 0 && (
          <div className="mt-2 space-y-1 bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-md text-sm">
            <p className="font-semibold mb-1 text-red-400">❌ Requisitos da senha:</p>
            <ul className="list-disc list-inside space-y-1">
              {newPassErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {currentError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
            {currentError}
          </div>
        )}
      </div>

      {loading ? (
            <div className="w-full flex justify-center">
              <SportsCryptoLoading />
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`w-full rounded-lg py-3 font-bold uppercase tracking-wide transition-all ${
                isValid
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-[#00191d] shadow-lg shadow-teal-900/30 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99]"
                  : "bg-[#1d2f2e] text-gray-400 cursor-not-allowed"
              }`}
            >
              Registrar
            </button>
          )}

      <p className="text-center text-sm text-gray-400">
        Já tem conta?{' '}
        <button
          type="button"
          onClick={() => router.replace({ pathname: router.pathname, query: { ...router.query, modal: 'auth', page: 'login' } }, undefined, { shallow: true })}
          className="font-semibold text-green-400 hover:text-green-300 transition-colors"
        >
          Entrar
        </button>
      </p>
    </div>
    {showModal && (
        <AlertModal
          type={modalType}
          title={modalType === 'success' ? 'SUCESSO' : 'ERRO'}
          message={modalMessage}
          onClose={() => setShowModal(false)}
        />
      )} 
    </>
  );
};

export default Register;