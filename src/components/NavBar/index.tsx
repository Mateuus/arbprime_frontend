import Link from 'next/link';
import { Handshake, Ticket, Menu, X } from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';


const NavBar: React.FC = () => {
  //const { isAuthenticated } = useAuth();
  const router = useRouter();
  const isAuthenticated = true;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = useMemo(() => [
    { name: 'HOME', path: '/', id: 'nav-home', icon: <Ticket size={20} />, requiresAuth: false },
    { name: 'ARBITRAGEM CRYPTO', path: '/arbitragem', id: 'nav-arbitragem', icon: <Handshake size={20} />, requiresAuth: true },
    { name: 'SUREBETS', path: '/plans', id: 'nav-surebets', icon: <Handshake size={20} />, requiresAuth: true },
    //{ name: 'PLANOS', path: '/plans', id: 'nav-plans', icon: <History size={20} />, requiresAuth: true },
  ], []);

  const filteredMenuItems = useMemo(
    () => menuItems.filter(item => !item.requiresAuth || (item.requiresAuth && isAuthenticated)),
    [menuItems, isAuthenticated]
  );

  useEffect(() => {
    const activePathIndex = filteredMenuItems.findIndex(item => item.path === router.pathname);
    if (activePathIndex !== -1) {
      setActiveIndex(activePathIndex);
    }
  }, [router.pathname, filteredMenuItems]);


  return (
	<nav className="bg-slate-800 border-gray-100 px-4 py-2 fixed -top-1 left-0 right-0 z-50">
	  <div className="flex justify-between items-center min-h-16">

        {/* Botão para abrir o menu no mobile */}
        <button 
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden"
        >
            <Menu size={28} className='text-white' />
        </button>

        {/* Título Centralizado */}
        <h1 className="text-white font-bold text-2xl uppercase">
          <span className="md:hidden"><span className='text-red-600'>ARB</span>CRYPTO</span> {/* Exibe "P" no mobile */}
          <span className="hidden md:inline"><span className='text-red-600'>ARB</span>CRYPTO</span> {/* Exibe "ArbCrypto" no desktop */}
        </h1>

        {/* Overlay para fechar o sidebar ao clicar fora */}
        {isMenuOpen && (
          <div
            className="fixed inset-0 bg-black opacity-50 z-40"
            onClick={() => setIsMenuOpen(false)}
          ></div>
        )}

        {/* Sidebar com design atualizado */}
        <div className={`fixed inset-y-0 left-0 w-64 bg-zinc-800 p-4 transition-transform transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} z-50 shadow-lg rounded-r-lg`}>
          <div className="flex justify-end lg:hidden mb-4">
            <button onClick={() => setIsMenuOpen(false)} className="p-2">
              <X size={28} className="text-white" />
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4 text-white">MENU</h2>
            <ul className="space-y-2">
              {filteredMenuItems.map((item, index) => (
                <li
                  key={item.id}
                  className={`flex items-center space-x-2 cursor-pointer p-2 rounded-md ${
                    activeIndex === index ? 'bg-gray-100 text-black font-bold' : 'text-white hover:bg-gray-700'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.icon}
                  <Link href={item.path} legacyBehavior>
                    <a className="flex-1 uppercase">{item.name}</a>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Menu de Navegação para Desktop */}
        <div className="hidden xl:flex justify-between items-center w-full lg:order-1 px-40">
          <ul className="flex flex-col m-0 p-0 font-normal lg:flex-row gap-2 space-x-6">
            {filteredMenuItems.map((item, index) => (
              <li
                key={index}
                id={item.id}
                className={`relative list-none flex items-center cursor-pointer ${
                  activeIndex === index ? 'text-white font-bold' : 'text-gray-300'
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <Link href={item.path} legacyBehavior>
                  <a className="no-underline text-sm uppercase whitespace-nowrap transition-colors h-16 leading-6 flex items-center justify-center">
                    {item.name}
                  </a>
                </Link>
                {activeIndex === index && (
                  <span className="absolute left-[-10%] right-[-10%] bottom-[-4px] h-[4px] bg-white rounded-full"></span>
                )}
              </li>
            ))}
          </ul>
        </div>

      </div>
	</nav>
  );
};

export default NavBar;