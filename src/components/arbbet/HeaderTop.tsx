import { Sliders, Clock, List, Moon, Sun } from 'lucide-react';

interface HeaderTopProps {
  onToggleSidebar: () => void;
  showSidebar: boolean;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

const HeaderTop: React.FC<HeaderTopProps> = ({ onToggleSidebar, showSidebar, darkMode, setDarkMode }) => {
  return (
    <header className="w-full h-[40px] bg-cyan-700 dark:bg-gray-900 text-white flex items-center justify-between">
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

                <button
                  title={darkMode ? 'Desativar modo escuro' : 'Ativar modo escuro'}
                  onClick={() => setDarkMode(!darkMode)}
                  className="relative group transition-colors duration-300 hover:text-yellow-400 focus:outline-none"
                >
                  <span className="transition-transform duration-500 group-hover:rotate-180">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                  </span>

                  {/* Tooltip */}
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-gray-700 dark:bg-gray-200 text-white dark:text-black text-[10px] px-2 py-[2px] rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </span>
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