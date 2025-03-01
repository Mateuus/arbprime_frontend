import Link from 'next/link';
import { Ticket, Menu, X, Radio, CalendarClock, Infinity, Bitcoin, Dices } from 'lucide-react';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
//import { useAuth } from '@/hooks/useAuth';
import { useUserContext } from '@/context/UserContext';
import UserArea from './UserArea';


const NavBar: React.FC = () => {
  const router = useRouter();
  //const { logout } = useAuth();
  const { isAuthenticated } = useUserContext();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

  const menuItems = useMemo(() => [
    { name: 'HOME', path: '/', id: 'nav-home', icon: <Ticket size={20} />, requiresAuth: false },
    { name: 'ARB CRYPTO', id: 'nav-arbcrypto', icon: <Bitcoin size={20} />, requiresAuth: true,
      subItems: [
        { name: 'ARB PERPETUALS', path: '/arbcrypto/perpetuals', id: 'nav-arbcrypto-perpetual', icon: <Infinity size={20} />, requiresAuth: false }
      ]
    },
    { name: 'ARB BETS', id: 'nav-arbbets', icon: <Dices size={20} />, requiresAuth: true,
      subItems: [
        { name: 'ARB LIVE', path: '/arbbets/live', id: 'nav-arbbets-live', icon: <Radio color='red' size={20} />, requiresAuth: false },
        { name: 'ARB PREMATCH', path: '/arbbets/prematch', id: 'nav-arbbets-prematch', icon: <CalendarClock size={20} />, requiresAuth: false }
      ]
    },
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
            <span className="md:hidden"><span className='text-red-600'>ARB</span>PRIME</span> {/* Exibe "P" no mobile */}
            <span className="hidden md:inline"><span className='text-red-600'>ARB</span>PRIME</span> {/* Exibe "ArbMaster" no desktop */}
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

            {/* Menu de Navegação para Mobile */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 text-white">MENU</h2>
                <ul className="space-y-2">
                  {filteredMenuItems.map((item, index) => {
                    return (
                      <li key={item.id}>
                        <div
                          className={`flex items-center justify-between cursor-pointer p-2 rounded-md ${
                            activeIndex === index ? 'bg-gray-100 text-black font-bold' : 'text-white hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            if (!item.subItems) {
                              router.push(item.path);
                              setIsMenuOpen(false);
                            } else {
                              setIsSubMenuOpen(!isSubMenuOpen); // Abre/Fecha submenu
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            {item.icon}
                            <span className="flex-1 uppercase">{item.name}</span>
                          </div>
                          {item.subItems && <span className={`transition-transform ${isSubMenuOpen ? 'rotate-180' : ''} text-white`}>▼</span>}
                        </div>

                        {/* Submenus (abrem e fecham conforme estado) */}
                        {item.subItems && isSubMenuOpen && (
                          <ul className="ml-6 mt-2 space-y-1 transition-all duration-200">
                            {item.subItems.map(subItem => (
                              <li key={subItem.id}>
                                <Link href={subItem.path} legacyBehavior>
                                  <a className="flex items-center text-white hover:bg-gray-700 p-2 rounded-md" onClick={() => setIsMenuOpen(false)}>
                                    {subItem.icon}
                                    <span className="ml-2">{subItem.name}</span>
                                  </a>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
            </div>
          </div>

          {/* Menu de Navegação para Desktop */}
          <div className="hidden xl:flex justify-between items-center w-full lg:order-1 px-40">
            <ul className="flex gap-6">
              {filteredMenuItems.map((item, index) => (
                <li key={item.id} className="relative group">
                  {!item.subItems ? (
                    <Link href={item.path} legacyBehavior>
                      <a
                        className={`cursor-pointer flex items-center px-4 py-2 text-sm uppercase transition-colors ${
                          activeIndex === index ? 'text-white font-bold' : 'text-gray-300 hover:text-white'
                        }`}
                      >
                          <div className="flex items-center space-x-2">
                            {item.icon}
                            <span className="flex-1 uppercase">{item.name}</span>
                          </div>
                      </a>
                    </Link>
                  ) : (
                    <div className="cursor-pointer flex items-center px-4 py-2 text-sm uppercase text-gray-300 hover:text-white transition-colors space-x-2">
                      {item.icon}
                      <span className="flex-1 uppercase">{item.name}</span>
                    </div>
                  )}

                {item.subItems && (
                    <ul className="absolute left-0 top-full mt-2 w-52 bg-gray-800 shadow-lg rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform scale-95 group-hover:scale-100 z-50">
                      {item.subItems.map(subItem => (
                        <li key={subItem.id}>
                          <Link href={subItem.path} legacyBehavior>
                            <a className="flex items-center px-4 py-3 text-white hover:bg-gray-700 rounded-md transition-all duration-150">
                              {subItem.icon}
                              <span className="ml-2">{subItem.name}</span>
                            </a>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* User Area */}
          <aside className="order-2 lg:ml-1">
            <UserArea isAuthenticated={isAuthenticated} />
          </aside>
        </div>
    </nav>
  );
};

export default NavBar;