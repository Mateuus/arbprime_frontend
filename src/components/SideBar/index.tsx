import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
 /*Radio,*/ChevronDown, ChevronUp,
  AlignJustify,
  X
} from 'lucide-react';
import { useMenuItems } from '@/utils/menu.config';
import { useUserContext } from '@/context/UserContext';

const Sidebar = () => {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();
  const [collapsed, setCollapsed] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const menuItems = useMenuItems();
  const filteredItems = menuItems.filter(item => !item.requiresAuth || isAuthenticated);

  useEffect(() => {
    for (const item of filteredItems) {
      if (item.subItems?.some(sub => sub.path === router.pathname)) {
        setOpenMenu(item.id);
        setCollapsed(false); // apenas abre, sem loop
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]); // ✅ apenas isso

  const isActive = (path?: string, subItems?: { path: string }[]) => {
    if (path && router.pathname === path) return true;
    if (subItems?.some(sub => sub.path === router.pathname)) return true;
    return false;
  };

  return (
    <div className={`h-screen bg-brand-dark text-white ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 flex flex-col`} style={{ boxShadow: '0 0 12px rgba(0, 0, 0, 0.25)', zIndex: 0 }}>
      {/* TOPO */}
      <div className="relative flex items-center justify-center p-4 border-b border-brand-border min-h-[62px]">
        {!collapsed ? <></> : 
        ( 
        <button onClick={() => setCollapsed(!collapsed)}>
            <AlignJustify className="text-white" size={24} />
        </button>
        )}
        {!collapsed && (
            <button onClick={() => setCollapsed(!collapsed)} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="text-white" size={24} />
            </button>
        )}
       </div>

      <nav className="flex-1 overflow-y-auto mt-4 space-y-2 px-2">
        {filteredItems.map(item => (
          <div key={item.id}>
            <div
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} p-3 rounded-xl cursor-pointer hover:bg-brand-hover transition-all
              ${isActive(item.path, item.subItems) ? 'bg-brand-active border border-teal-500' : ''}
              ${item.button ? 'border border-teal-400 text-teal-300 mt-4 justify-center' : ''}`}
              onClick={() => {
                if (item.subItems) {
                  if (collapsed) {
                    setCollapsed(false);
                  }
                  setOpenMenu(openMenu === item.id ? null : item.id);
                } else if (item.path) {
                  router.push(item.path);
                }
              }}
            >
              <span>{item.icon}</span>
              {!collapsed && <span className="text-sm font-medium flex-1 truncate">{item.name.toUpperCase()}</span>}
              {!collapsed && item.subItems && (openMenu === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
              {item.id === 'promo' && !collapsed && (
                <span className="ml-auto text-xs bg-pink-600 px-2 py-0.5 rounded-full">NOVO</span>
              )}
            </div>
            {/* Submenu */}
            {!collapsed && item.subItems && openMenu === item.id && (
              <div className="ml-4 space-y-1 mt-1">
                {item.subItems.map(sub => (
                  <Link href={sub.path} key={sub.id} legacyBehavior>
                    <a className={`flex items-center gap-2 p-2 text-sm rounded-xl hover:bg-brand-hover transition-all
                      ${isActive(sub.path) ? 'text-teal-300 bg-[#024c3b]' : 'text-gray-300'}`}>
                      <span className="flex items-center gap-2">
                        {sub.icon}
                        <span className="truncate">{sub.name.toUpperCase()}</span>
                      </span>
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
