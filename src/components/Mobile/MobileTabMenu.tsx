import { useState } from "react";
import {
  Menu,
} from "lucide-react";
import SidebarMenu from './SidebarMenu';

const tabs = [
  { label: "Menu", icon: <Menu size={20} /> }
];

const MobileTabMenu: React.FC = () => {
  const [activeTab, setActiveTab] = useState("Cassino");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleTabClick = (tabLabel: string) => {
    if (tabLabel === "Menu") {
      setSidebarOpen(true);
    } else {
      setActiveTab(tabLabel);
    }
  };
  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#0c1f1f] border-t border-gray-700 z-50 md:hidden">
      <div className="flex justify-start px-4 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => handleTabClick(tab.label)}
            className={`flex flex-col items-center justify-center text-xs transition ${
              activeTab === tab.label
                ? "text-teal-400 font-semibold"
                : "text-gray-400"
            }`}
          >
            {tab.icon}
            <span className="mt-1 truncate max-w-[60px]">{tab.label}</span>
          </button>
        ))}
      </div>
      {sidebarOpen && <SidebarMenu onClose={() => setSidebarOpen(false)} />}
    </div>
  );
};

export default MobileTabMenu;