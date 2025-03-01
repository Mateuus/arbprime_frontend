import React from 'react';
import { User as IconUser } from 'lucide-react';
import { User } from '@/context/UserContext'; // Importe o tipo User
import { useAuth } from '@/hooks/useAuth'; // Importe o hook useAuth

interface AccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const UserDetailsModal: React.FC<AccountDetailsModalProps> = ({ isOpen, onClose, user }) => {
  const { logout } = useAuth(); // Acesse a função de logout

  if (!isOpen || !user) return null;

  const handleLogout = async () => {
    await logout();
    onClose(); // Feche o modal após o logout
  };

  return (
    <div 
      className="absolute top-full mt-2 right-0 bg-white p-4 rounded-lg shadow-lg w-72 z-50"
      onClick={(e) => e.stopPropagation()} // Evita fechar o modal ao clicar nele
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconUser size={24} className="text-gray-700" />
          <span>{user.username}</span>
        </div>
        <button onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mb-4">
        <div className="flex items-center">
          <p className="font-semibold mr-2">Plano Atual:</p>
          <p className="text-xl font-bold">GOLD</p>
        </div>
        <p className="text-gray-500 text-sm">(5 dias para expirar)</p>
      </div>


      <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
        MINHA CONTA
      </button>
      <button 
        className="w-full mt-2 bg-red-600 text-white py-2 rounded hover:bg-red-700"
        onClick={handleLogout}
      >
        SAIR
      </button>
    </div>
  );
};

export default UserDetailsModal;
