import React, { useRef, useState } from 'react';
import { useRouter } from 'next/router';

import {
  User as IconUser,
  Wallet,
  Mail
} from 'lucide-react';
import UserAuthButtons from '@/components/Buttons/UserAuthButtons';
import { useAuth } from '@/hooks';

interface UserAreaProps {
  isAuthenticated: boolean;
}

const UserArea: React.FC<UserAreaProps> = ({ isAuthenticated }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 50);
  };

  return (
    <div
      className="relative z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 p-[2px] bg-cyan-900 cursor-pointer flex items-center justify-center">
              <IconUser size={22} className="text-white" />
          </div>
        </div>
      ) : (
        <UserAuthButtons />
      )}

         {/* Dropdown suspenso */}
        {open && isAuthenticated && (
          <div className="absolute right-0 top-full mt-3 w-64 bg-[#0f2320] border border-[#00a387] text-white rounded-lg shadow-xl overflow-hidden">
            <button
              onClick={() => router.push('?modal=user')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <IconUser size={18} /> Meu Perfil
            </button>
            <button
              onClick={() => router.push('?modal=user&page=banca')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <Wallet size={18} /> Gestão de Banca
            </button>
            <button
              onClick={() => router.push('?modal=user&page=mensagens')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <Mail size={18} /> Mensagens
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-center bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold"
            >
              TERMINAR SESSÃO
            </button>
          </div>
      )}

    </div>
  );
};

export default UserArea;
