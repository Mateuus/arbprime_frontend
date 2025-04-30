import { useUserContext } from '@/context/UserContext';
import UserArea from './UserArea';

const NavBar: React.FC = () => {
  //const { logout } = useAuth();
  const { isAuthenticated } = useUserContext();

  return (
    <nav className="w-full border-b border-brand-border min-h-[62px] h-[62px] px-4 flex items-center justify-between text-white z-50">
      {/* Lado esquerdo (pode adicionar logo, menu, etc.) */}
      <div className="text-xl font-bold text-white">
        <span className="text-white">ARB</span><span className="text-green-500">PRIME</span>
      </div>

      {/* Lado direito: User Area */}
      <div className="flex items-center">
        <UserArea isAuthenticated={isAuthenticated} />
      </div>
    </nav>
  );
};

export default NavBar;
