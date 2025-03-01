import React from 'react';
import UserLoginForm from '@/components/modals/Login/UserLoginForm';

const UserLoginModal: React.FC<{ isOpen: boolean, onClose: () => void, onRegisterClick: () => void }> = ({ isOpen, onClose, onRegisterClick }) => {

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-slate-800 w-full h-full sm:h-auto sm:w-3/4 lg:w-[1025px] lg:h-[640px] flex flex-col rounded-lg shadow-lg overflow-hidden">
            
            {/* Header do Modal */}
            <div className="w-full flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex space-x-4">
                    <div className="text-sm text-white">
                        <span>Novo usuário? </span> 
                        <button onClick={onRegisterClick} className="text-red-600 font-semibold"> Cadastre-se aqui</button>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-600 hover:text-gray-800 text-xl"
                    aria-label="Close modal"
                >
                    &times;
                </button>
            </div>

            {/* Corpo do Modal */}
            <div className="flex flex-col lg:flex-row flex-grow bg-gray-100">
                {/* Área do Formulário */}
                <div className="w-full lg:w-1/2 flex flex-col">
                    <UserLoginForm onClose={onClose} />
                </div>

                {/* Área de Propaganda */}
                <div className="hidden lg:flex w-full lg:w-1/2 bg-red-600 items-center justify-center">
                    <p className="text-white text-xl">Espaço para Propaganda</p>
                </div>
            </div>
        </div>
    </div>
    );
};

export default UserLoginModal;
