import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { X, User as IconUser, ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { useUserContext } from "@/context/UserContext";
import DadosPessoais from "@/pages/user/details";
import UserMensagens from "@/pages/user/mensagens";
import ChangePassword from "@/pages/user/change-password";
import { GiCoins, GiSoccerBall } from "react-icons/gi";

export const abaTabs = ["details", "change-password", "mensagens"] as const;
export type AbaTab = typeof abaTabs[number];

export function isValidTab(value: string): value is AbaTab {
    return abaTabs.includes(value as AbaTab);
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialTab: AbaTab | null;
}

interface SubItem {
    id: string;
    name: string;
    action?: () => void;
}
  
interface MenuItem {
    id: string;
    name: string;
    icon: React.ReactNode;
    subItems?: SubItem[];
}

const UserProfileModal: React.FC<Props> = ({ isOpen, onClose, initialTab }) => {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<AbaTab>("details");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { user } = useUserContext();

  const menuItems = useMemo<MenuItem[]>(() => [
    {
      name: 'Minha Conta',
      id: 'perfil',
      icon: <IconUser size={24} />,
      subItems: [
        { id: 'details', name: 'Dados Pessoais', action: () => setAbaAtiva("details") },
        { id: 'change-password', name: 'Trocar Senha', action: () => setAbaAtiva("change-password") },
        { id: 'mensagens', name: 'Mensagens', action: () => setAbaAtiva("mensagens") },
      ]
    },
    {
        name: 'ARB BET',
        id: 'arbbet',
        icon: <GiSoccerBall size={24} />,
        subItems: [
          { id: 'ab-bookmakers', name: 'Casas de Apostas' },
          { id: 'ab-filters', name: 'Filtros' }
        ]
    },
    {
      name: 'ARB CRYPTO',
      id: 'arbcrypto',
      icon: <GiCoins size={24} />,
      subItems: [
        { id: 'ac-exchanges', name: 'Exchanges' },
        { id: 'ac-filters', name: 'Filtros' }
      ]
    },
    {
      name: 'Apostas',
      id: 'apostador',
      icon: <ScrollText size={24} />,
      subItems: [
        { id: 'historico', name: 'Histórico de Apostas' },
        { id: 'criador', name: 'Histórico do Criador' }
      ]
    }
  ], []);

  useEffect(() => {
    if (initialTab) {
      setAbaAtiva(initialTab);
  
      // Abrir o menu pai correspondente
      const parent = menuItems.find((menu) =>
        menu.subItems?.some((sub) => sub.id === initialTab)
      );
      if (parent) {
        setOpenMenu(parent.id);
      }
    }
  }, [initialTab, menuItems]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center">
      <div className="bg-brand-dark w-full max-w-[1300px] h-[90vh] rounded-xl shadow-2xl flex overflow-hidden relative">
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-red-500 z-10"
        >
          <X size={24} />
        </button>

        {/* Sidebar dinâmica */}
        <aside className={`w-[320px] h-full p-4 bg-brand-dark overflow-y-auto`} style={{ boxShadow: '5px 0 12px rgba(0, 0, 0, 0.4)', zIndex: 1 }}>
            {/* Cabeçalho */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#114646] to-[#072b2e]`} style={{ boxShadow: '5px 0 12px rgba(0, 0, 0, 0.4)', zIndex: 1 }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#4d5c5a] text-white font-semibold text-sm">
                {user.fullname
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-white">{user.fullname.toUpperCase()}</span>
                </div>
            </div>

            {/* Menu principal */}
            <nav className="space-y-3 mt-6">
                {menuItems.map((item) => (
                <div key={item.id} className={`bg-gradient-to-b from-[#114646] to-[#202c2a] rounded-xl`} style={{ boxShadow: '20px 0 20px rgba(0, 0, 0, 0.5)', zIndex: 1 }}>
                    <button
                    onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between px-4 py-5 text-white font-semibold text-sm"
                    >
                    <span className="flex items-center gap-2">{item.icon}{item.name.toUpperCase()}</span>
                    {openMenu === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {/* Submenu */}
                    {openMenu === item.id && item.subItems && (
                        <div className="bg-gradient-to-b flex-1 from-[#114646] to-[#202c2a] px-4 py-4 rounded-b-xl">
                            {item.subItems.map((sub) => (
                            <button
                                key={sub.id}
                                onClick={() => {
                                setAbaAtiva(sub.id as AbaTab); // muda localmente
                                router.replace(
                                    {
                                    pathname: router.pathname,
                                    query: { ...router.query, page: sub.id },
                                    },
                                    undefined,
                                    { shallow: true }
                                );
                                }}
                                className={`w-full text-left px-6 py-2 text-sm border-l-2 transition-transform duration-200 ease-in-out
                                ${
                                    abaAtiva === sub.id
                                    ? "border-green-400 text-white bg-gradient-to-r from-[#0f232281] to-[#0f23220e] translate-y-[2px]"
                                    : "border-[#2b534f83] text-gray-400"
                                }`}
                            >
                                {sub.name}
                            </button>
                            ))}
                        </div>
                    )}
                </div>
                ))}
            </nav>

            {/* Botão de logout */}
            <button
                onClick={onClose}
                className="w-full mt-6 text-center px-4 py-3 bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold rounded-xl"
            >
                SAIR
            </button>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 bg-brand-dark text-white p-6 overflow-y-auto">
          {abaAtiva === "details" && <DadosPessoais />}
          {abaAtiva === "change-password" && <ChangePassword />}
          {abaAtiva === "mensagens" && <UserMensagens />}

          {!abaTabs.includes(abaAtiva || "") && (
            <div className="text-gray-400 text-sm">Conteúdo em breve...</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default UserProfileModal;
