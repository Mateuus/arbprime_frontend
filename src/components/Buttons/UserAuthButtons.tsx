import React from 'react';
import { useRouter } from 'next/router';

const UserAuthButtons: React.FC = () => {
    const router = useRouter();
  
    const handleLoginOpen = () => {
      router.push('/?modal=auth&page=login', undefined, { shallow: true });
    };
  
    const handleRegisterOpen = () => {
      router.push('/?modal=auth&page=register', undefined, { shallow: true });
    };
  
    return (
      <div className="flex flex-row gap-2">
        <button
          className="border border-white text-white px-4 py-1 rounded hover:bg-white hover:text-gray-900 text-sm sm:px-2 sm:text-xs"
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
      </div>
    );
};
  

export default UserAuthButtons;
