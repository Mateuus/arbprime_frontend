import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Menu, X, Ticket, Bitcoin, Dices, Radio, CalendarClock, Infinity
} from 'lucide-react';
import { useUserContext } from '@/context/UserContext';

const MobileMenu = () => {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<string | null>(null);

  const menuItems = useMemo(() => [
    { name: 'HOME', path: '/', id: 'nav-home', icon: <Ticket size={20} />, requiresAuth: false },
    {
      name: 'ARB CRYPTO', id: 'nav-arbcrypto', icon: <Bitcoin size={20} />, requiresAuth: true,
      subItems: [
        { name: 'ARB PERPETUALS', path: '/arbcrypto/perpetuals', id: 'nav-arbcrypto-perpetual', icon: <Infinity size={20} />, requiresAuth: false }
      ]
    },
    {
      name: 'ARB BETS', id: 'nav-arbbets', icon: <Dices size={20} />, requiresAuth: true,
      subItems: [
        { name: 'ARB LIVE', path: '/arbbets', id: 'nav-arbbets-live', icon: <Radio size={20} color="red" />, requiresAuth: false },
        { name: 'ARB PREMATCH', path: '/arbbets', id: 'nav-arbbets-prematch', icon: <CalendarClock size={20} />, requiresAuth: false }
      ]
    }
  ], []);

  const filteredItems = menuItems.filter(item => !item.requiresAuth || isAuthenticated);

  return (
    <>
      {/* Botão hambúrguer visível apenas no mobile */}
      <div className="md:hidden p-4">
        <button onClick={() => setIsOpen(true)}>
          <Menu size={28} className="text-white" />
        </button>
      </div>

      {/* Menu lateral */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed top-0 left-0 w-64 h-full bg-zinc-900 z-50 shadow-lg p-4 overflow-y-auto">
            <div className="flex justify-end mb-4">
              <button onClick={() => setIsOpen(false)}>
                <X size={28} className="text-white" />
              </button>
            </div>

            <nav className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.id}>
                  <div
                    className="flex items-center justify-between cursor-pointer p-2 text-white hover:bg-zinc-700 rounded"
                    onClick={() => {
                      if (item.subItems) {
                        setSubMenu(subMenu === item.id ? null : item.id);
                      } else {
                        router.push(item.path);
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.name}</span>
                    </div>
                    {item.subItems && <span className="text-white">▼</span>}
                  </div>

                  {item.subItems && subMenu === item.id && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.subItems.map(sub => (
                        <Link key={sub.id} href={sub.path} legacyBehavior>
                          <a className="flex items-center gap-2 text-sm text-gray-300 hover:bg-gray-700 p-2 rounded" onClick={() => setIsOpen(false)}>
                            {sub.icon}
                            <span>{sub.name}</span>
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default MobileMenu;
