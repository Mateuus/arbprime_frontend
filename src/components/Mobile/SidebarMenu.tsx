import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useMenuItems, MenuItem, MenuSubItem } from '@/utils/menu.config';
import { useState } from 'react';
import LogoText from '../ui/LogoText';

interface SidebarMenuProps {
  onClose: () => void;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ onClose }) => {
  const menuItems: MenuItem[] = useMenuItems();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleItemClick = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 md:hidden">
      <div className="absolute left-0 bottom-0 h-full w-[80%] max-w-xs bg-[#062121] p-4 flex flex-col overflow-y-auto rounded-tr-[30px] animate-slide-up">
        <div className="flex justify-between items-center mb-4">
          <LogoText />
          <button onClick={onClose} className="text-white hover:text-red-400">
            <X />
          </button>
        </div>

        <ul className="space-y-1 text-white text-sm mt-4">
          {menuItems.map((item, index) => {
            // Cabeçalho de seção (ex.: PLATAFORMA / SISTEMA) — não clicável.
            if (item.header) {
              return (
                <li key={item.id} className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 select-none">
                  {item.name}
                </li>
              );
            }
            return (
            <li key={item.id}>
              <div
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#1a3a3a] rounded cursor-pointer justify-between"
                onClick={() => {
                  if (item.subItems && item.subItems.length > 0) {
                    handleItemClick(index);
                  } else {
                    item.onClick?.();
                    onClose();
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="font-semibold">{item.name.toUpperCase()}</span>
                </div>
                {item.subItems && (
                  openIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />
                )}
              </div>

              {item.subItems && openIndex === index && (
                <ul className="ml-6 mt-1 space-y-1">
                  {item.subItems.map((sub: MenuSubItem) => (
                    <li
                      key={sub.id}
                      onClick={() => {
                        if (sub.onClick) {
                          sub.onClick();
                        } else if (sub.path) {
                          window.location.href = sub.path;
                        }
                        onClose();
                      }}
                      className="flex items-center gap-2 px-3 py-1 text-gray-300 hover:text-white hover:bg-[#0f2e2e] rounded"
                    >
                      {sub.icon && <span className="text-white">{sub.icon}</span>}
                      <span>{sub.name}</span>
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
  );
};

export default SidebarMenu;