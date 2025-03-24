import { Sliders, Clock, List, Moon } from 'lucide-react';

interface HeaderTopProps {
  onToggleSidebar: () => void;
  showSidebar: boolean;
}

const HeaderTop: React.FC<HeaderTopProps> = ({ onToggleSidebar, showSidebar }) => {
  return (
    <header className="w-full h-[40px] bg-cyan-700 text-white flex items-center justify-between">
      <div className="relative h-full">
            {/* Fundo que aparece com a sidebar */}
            <div
                className={`
                absolute top-0 left-0 h-full
                transition-all duration-300 ease-in-out
                bg-[#1c1f24] border-r border-[#2c2f36]
                ${showSidebar ? 'w-[160px] opacity-100' : 'w-0 opacity-0'}
                z-0
                `}
            />

            {/* Ícones sempre visíveis */}
            <div className="relative z-10 flex gap-5 items-center text-gray-300 px-4 h-full">
                <button
                    onClick={onToggleSidebar}
                    type="button"
                    className="hover:text-white focus:outline-none"
                >
                    <Sliders size={18} />
                </button>

                <button type="button" className="hover:text-white focus:outline-none">
                    <Clock size={18} />
                </button>

                <button type="button" className="hover:text-white focus:outline-none">
                    <List size={18} />
                </button>

                <button type="button" className="hover:text-white focus:outline-none">
                    <Moon size={18} />
                </button>
            </div>
      </div>

      {/* Logo central */}
      <div className="flex items-center justify-center flex-1 font-bold text-white text-sm">

      </div>

      {/* Ações do lado direito */}
      <div className="flex gap-3 text-sm text-white px-4">
        <span className="cursor-pointer hover:text-gray-300">Surebet</span>
        <span className="cursor-pointer hover:text-gray-300">Markets</span>
      </div>
    </header>
  );
};

export default HeaderTop;