import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { hasDashboardAccess } from '@/utils/adminAccess';
import UserArea from './UserArea';

const NavBar: React.FC = () => {
  //const { logout } = useAuth();
  const { isAuthenticated, user } = useUserContext();
  const showDashboard = isAuthenticated && hasDashboardAccess(user);

  return (
    <nav className="w-full border-b border-brand-border min-h-[62px] h-[62px] px-4 flex items-center justify-between text-white z-50">
      {/* Lado esquerdo (pode adicionar logo, menu, etc.) */}
      <div className="text-xl font-bold text-white">
        <span className="text-white">ARB</span><span className="text-green-500">PRIME</span>
      </div>

      {/* Lado direito: acesso ao Painel (admin) + User Area */}
      <div className="flex items-center gap-3">
        {/* Porta primária do Dashboard — SEMPRE visível (não depende de hover),
            ao contrário do dropdown do avatar, que quebra no touch. */}
        {showDashboard && (
          <Link
            href="/admin/dashboard"
            aria-label="Painel administrativo"
            className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1.5 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-400/20"
          >
            <LayoutDashboard size={16} /> <span className="hidden sm:inline">Painel</span>
          </Link>
        )}
        <UserArea isAuthenticated={isAuthenticated} />
      </div>
    </nav>
  );
};

export default NavBar;
