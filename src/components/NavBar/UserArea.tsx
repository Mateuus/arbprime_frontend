import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  User as IconUser,
  History,
  ScrollText,
  Wallet,
  Gift,
  Mail
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import UserAuthButtons from '@/components/Buttons/UserAuthButtons';
import UserProfileModal from "@/components/modals/UserProfileModal";
import { isValidTab, AbaTab } from "@/components/modals/UserProfileModal";

interface UserAreaProps {
  isAuthenticated: boolean;
}

const UserArea: React.FC<UserAreaProps> = ({ isAuthenticated }) => {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedTab, setSelectedTab] = useState<AbaTab | null>(null);

  
  useEffect(() => {
    const { profile, page } = router.query;
  
    if (profile === "open" && typeof page === "string") {
      const normalizedPage = page.toLowerCase();
      if (isValidTab(normalizedPage)) {
        setSelectedTab(normalizedPage as AbaTab);
      }
    }
  }, [router.query]);

  const handleLogout = async () => {
    await logout();
  };

  const handleMouseEnter = () => {
    if (selectedTab) return; // Evita abrir o dropdown se modal estiver aberto
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (selectedTab) return; // Evita fechar o dropdown se modal estiver aberto
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  const handleOpenModal = (tab: AbaTab) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(false);
    setSelectedTab(tab);
  };

  const handleCloseModal = () => {
    setSelectedTab(null);
    router.replace(router.pathname, undefined, { shallow: true });
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
            <button onClick={() => handleOpenModal("details")}>
              <IconUser size={22} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <UserAuthButtons />
      )}

      {/* Dropdown suspenso */}
      {open && isAuthenticated && !selectedTab && (
        <div className="absolute right-0 top-full mt-3 w-64 bg-[#0f2320] border border-[#00a387] text-white rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => handleOpenModal("details")}
            className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
          >
            <IconUser size={18} /> Meu Perfil
          </button>
          <button className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]">
            <History size={18} /> Histórico de apostas
          </button>
          <button className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]">
            <ScrollText size={18} /> Histórico do Criador de Apostas
          </button>
          <button className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]">
            <Wallet size={18} /> Gestão do saldo
          </button>
          <button className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]">
            <Gift size={18} /> Bônus
          </button>
          <button
            onClick={() => handleOpenModal("mensagens")}
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

        <UserProfileModal
        isOpen={selectedTab !== null}
        onClose={handleCloseModal}
        initialTab={selectedTab}
        />
    </div>
  );
};

export default UserArea;
