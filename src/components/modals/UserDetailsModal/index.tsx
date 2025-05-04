import React from 'react';
import { User as IconUser } from 'lucide-react';
import { User } from '@/context/UserContext';
import { useAuth } from '@/hooks/useAuth';

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const UserDetailsModal: React.FC<AccountDetailsModalProps> = ({ isOpen, onClose, user }) => {
  const { logout } = useAuth();

  if (!isOpen || !user) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
      onClick={onClose} // Clicar fora do modal fecha ele
    >
      <div
        className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-lg w-full max-w-sm relative"
        onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar dentro do modal
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconUser size={24} className="text-gray-700 dark:text-white" />
            <span className="text-gray-900 dark:text-white">{user.fullname}</span>
          </div>
          <button onClick={onClose} className="text-gray-600 dark:text-white hover:text-red-600">
            ✕
          </button>
        </div>

        {/* Plano */}
        <div className="mb-4">
          <div className="flex items-center">
            <p className="font-semibold mr-2 text-gray-800 dark:text-white">Plano Atual:</p>
            <p className="text-xl font-bold text-green-500">GOLD</p>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">(5 dias para expirar)</p>
        </div>

        {/* Ações */}
        <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 mb-2">
          MINHA CONTA
        </button>
        <button
          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
          onClick={handleLogout}
        >
          SAIR
        </button>
      </div>
    </div>
  );
};

export default UserDetailsModal;