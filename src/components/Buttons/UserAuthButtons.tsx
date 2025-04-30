import React, { useState } from 'react';
import UserLoginModal from '../modals/Login';

const UserAuthButtons: React.FC = () => {
    const [isLoginOpen, setLoginOpen] = useState(false);
    const [isRegisterOpen, setRegisterOpen] = useState(false);

    const handleLoginOpen = () => {
        setRegisterOpen(false); // Fecha o modal de cadastro se estiver aberto
        setLoginOpen(true);
    };

    const handleRegisterOpen = () => {
        setLoginOpen(false); // Fecha o modal de login se estiver aberto
        setRegisterOpen(true);
    };

    const handleClose = () => {
        setLoginOpen(false);
        setRegisterOpen(false);
    };

    return (
        <div>
            <div className="flex flex-row gap-2">
                <button className="border border-white text-white px-4 py-1 rounded hover:bg-white hover:text-gray-900 text-sm sm:px-2 sm:text-xs"
                onClick={handleRegisterOpen} 
                >
                REGISTRAR
                </button>
                <button 
                className="bg-brand-button text-black font-semibold text-sm px-4 py-1 rounded-lg hover:opacity-90 transition"
                onClick={handleLoginOpen}
                >
                ENTRAR
                </button>
                <UserLoginModal isOpen={isLoginOpen} onClose={handleClose} onRegisterClick={handleRegisterOpen} />
                {isRegisterOpen && <div>Modal de Login</div>}
            </div>
        </div>
    );
};

export default UserAuthButtons;
