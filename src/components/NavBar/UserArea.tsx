import React, { useEffect, useState } from 'react';
import { User as IconUser } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth'; 
import UserAuthButtons from '@/components/Buttons/UserAuthButtons';
import UserDetailsModal from '@/components/modals/UserDetailsModal';

interface UserAreaProps {
    isAuthenticated: boolean;
}

const UserArea: React.FC<UserAreaProps> = ({ isAuthenticated }) => {
    const { user } = useAuth(); // Acesse o usuário do contexto
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAccountDetailsOpen, setIsAccountDetailsOpen] = useState(false); // Estado para controlar a visibilidade do modal

    // Função para salvar o idioma no localStorage e fechar o modal
    const handleLanguageChange = (language: string) => {
        localStorage.setItem('preferredLanguage', language);
        setIsSettingsOpen(false); // Fecha o modal
    };

    // Função para carregar o idioma ao montar o componente (opcional)
    useEffect(() => {
        const savedLanguage = localStorage.getItem('preferredLanguage');
        if (savedLanguage) {
            handleLanguageChange(savedLanguage);
        }
    }, []);

    const handleOpenAccountDetails = () => {
        setIsAccountDetailsOpen(true);
    };

    const handleCloseAccountDetails = () => {
        setIsAccountDetailsOpen(false);
    };

    return (
        <div className="flex flex-row items-center gap-2">
            {isAuthenticated ? (
                <>
                    <div 
                        className="flex items-center gap-2 bg-gray-600 px-4 py-1 rounded cursor-pointer"
                        onClick={handleOpenAccountDetails} // Alterna a visibilidade do modal ao clicar na div
                    >
                        {/* Círculo ao redor do ícone */}
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border"> 
                            <IconUser size={24} className="text-white" />
                        </div>
                        {/* Saldo do usuário */}
                        <span className="text-white font-semibold">{user?.username || 'username'}</span> 
                    </div>
                </>
            ) : (
                <>
                    {/* Buttons Register e Login */}
                    <UserAuthButtons />
                </>
            )}

            {/* Modal de detalhes da conta */}
            {isAccountDetailsOpen && (
                <UserDetailsModal 
                isOpen={isAccountDetailsOpen} 
                onClose={handleCloseAccountDetails} 
                user={user} // Passa os dados do usuário para o modal
                />
            )}
        </div>
    );
};

export default UserArea;