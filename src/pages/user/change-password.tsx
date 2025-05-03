import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiGateway } from "@/gateways/api.gateway";
import AlertModal from "@/components/modals/AlertModal";
import SportsCryptoLoading from "@/components/loaders/SportsCryptoLoading";

const ChangePassword = () => {
  // Configurações
  const PASSWORD_MIN_LENGTH = 6;
  const requireNumber = true;
  const requireUppercase = true;
  const requireSpecialChar = true;

  // States
  const [current, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMessage, setModalMessage] = useState('');

  // Validações
  const validatePassword = (pass: string) => {
    const errors = [];
    if (pass.length < PASSWORD_MIN_LENGTH) errors.push("Mínimo de 6 caracteres");
    if (requireNumber && !/\d/.test(pass)) errors.push("Deve conter um número");
    if (requireUppercase && !/[A-Z]/.test(pass)) errors.push("Deve conter letra maiúscula");
    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]/.test(pass)) {
      errors.push("Deve conter caractere especial");
    }
    return errors;
  };

  const newPassErrors = validatePassword(newPassword);
  const confirmError = confirm && confirm !== newPassword ? "As senhas não coincidem" : "";

  const isValid =
    current.length >= PASSWORD_MIN_LENGTH &&
    newPassErrors.length === 0 &&
    confirm === newPassword;

    const handleSubmit = async () => {
      setLoading(true);
      setCurrentError("");
    
      try {
        const response = await apiGateway.changePassowrd(current, newPassword);
    
        if (response.status === 200) {
          setModalType("success");
          setModalMessage("Mudança de senha");
          setShowModal(true);
    
          setCurrent("");
          setNewPassword("");
          setConfirm("");
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        const message = err?.response?.data?.message || "Erro ao trocar senha.";
        setCurrentError(message);
      } finally {
        setLoading(false);
      }
    };
    
  return (
    <>
    <div className="text-white space-y-6">
      <h1 className="text-2xl font-bold">Trocar Senha</h1>
      <hr className="border-t border-[#2b534f83] my-4" />

      <div className="space-y-6 max-w-xl mt-8">
        {/* Senha atual */}
        <div className="space-y-1">
          <label className="block text-sm text-gray-400 mb-1">Senha atual</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Digite sua senha atual"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={`w-full bg-[#1d2f2e] text-white placeholder:text-gray-400 p-4 pr-12 rounded-xl outline-none focus:ring-2 transition ${
                currentError ? "ring-2 ring-red-500 border border-red-500" : "focus:ring-brand-input-focus"
              }`}
            />
            {current.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white"
              >
                {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>
          {currentError && (
            <p className="mt-2 text-red-400 bg-red-900/30 px-3 py-2 rounded text-sm">
              {currentError}
            </p>
          )}
        </div>

        {/* Nova senha */}
        <div className="space-y-1">
          <label className="block text-sm text-gray-400 mb-1">Nova senha</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              placeholder="Digite a nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full bg-[#1d2f2e] text-white placeholder:text-gray-400 p-4 pr-12 rounded-xl outline-none focus:ring-2 transition ${
                newPassword && newPassErrors.length ? "ring-2 ring-red-500" : "focus:ring-brand-input-focus"
              }`}
            />
            {newPassword.length > 0 && (
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white"
              >
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>

          {newPassword &&
            newPassErrors.map((err, i) => (
              <p key={i} className="text-red-400 text-sm">{err}</p>
            ))}
        </div>

        {/* Confirmar nova senha */}
        <div className="space-y-1">
          <label className="block text-sm text-gray-400 mb-1">Confirmar nova senha</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirme sua nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`w-full bg-[#1d2f2e] text-white placeholder:text-gray-400 p-4 pr-12 rounded-xl outline-none focus:ring-2 transition ${
                confirm && confirm !== newPassword ? "ring-2 ring-red-500" : "focus:ring-brand-input-focus"
              }`}
            />
            {confirm.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-4 top-4 text-gray-400 hover:text-white"
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>
          {confirmError && <p className="text-red-400 text-sm">{confirmError}</p>}
        </div>

        {loading ? (
            <div className="w-full flex justify-center">
              <SportsCryptoLoading />
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`px-6 py-3 w-full rounded-full font-semibold uppercase tracking-wide transition ${
                isValid
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-[#1d2f2e] text-gray-400 cursor-not-allowed"
              }`}
            >
              MUDAR SENHA
            </button>
          )}
      </div>
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

export default ChangePassword;