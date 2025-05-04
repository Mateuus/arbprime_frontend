import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useMenuItems } from '@/utils/menu.config';
import { useState, ReactNode } from 'react';

interface MenuSubItem {
  id: string;
  name: string;
  path: string;
  icon?: ReactNode;
  onClick?: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  path?: string;
  icon: ReactNode;
  onClick?: () => void;
  requiresAuth?: boolean;
  button?: boolean;
  subItems?: MenuSubItem[];
}

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
      <div className="absolute left-0 top-0 h-full w-[80%] max-w-xs bg-[#062121] p-4 flex flex-col overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-white text-2xl font-bold">Betão</h1>
          <button onClick={onClose} className="text-white hover:text-red-400">
            <X />
          </button>
        </div>

        <ul className="space-y-1 text-white text-sm mt-4">
          {menuItems.map((item, index) => (
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
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SidebarMenu;