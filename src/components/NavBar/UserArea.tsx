import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

import {
  User as IconUser,
  Wallet,
  Mail,
  Clock,
  Crown,
  Sparkles
} from 'lucide-react';
import UserAuthButtons from '@/components/Buttons/UserAuthButtons';
import { useAuth } from '@/hooks';
import { apiGateway, SubscriptionInfoDTO } from '@/gateways/api.gateway';

interface UserAreaProps {
  isAuthenticated: boolean;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// Dias restantes (arredonda pra cima) até a data de expiração.
const daysUntil = (d: string | null): number | null => {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
};

const UserArea: React.FC<UserAreaProps> = ({ isAuthenticated }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { logout } = useAuth();

  // Assinatura do usuário (plano + expiração). Carregada ao autenticar e
  // revalidada sempre que o dropdown é aberto, pra refletir renovações.
  const [sub, setSub] = useState<SubscriptionInfoDTO | null>(null);

  const loadSubscription = async () => {
    try {
      const res = await apiGateway.getMySubscription();
      setSub(res?.data?.result === 1 ? res.data.data || null : null);
    } catch {
      setSub(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadSubscription();
    else setSub(null);
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!open && isAuthenticated) loadSubscription();
    setOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 50);
  };

  const hasActivePlan = !!sub?.hasActivePlan && !!sub?.subscription;
  const expirationDate = sub?.subscription?.expirationDate ?? sub?.expiresAt ?? null;
  const daysLeft = daysUntil(expirationDate);
  // Cor do aviso de expiração: vermelho se expirado, âmbar se ≤ 3 dias, verde caso ok.
  const expiryColor =
    daysLeft !== null && daysLeft <= 0
      ? 'text-rose-400'
      : daysLeft !== null && daysLeft <= 3
        ? 'text-amber-400'
        : 'text-emerald-300';

  return (
    <div
      className="relative z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 p-[2px] bg-cyan-900 cursor-pointer flex items-center justify-center">
              <IconUser size={22} className="text-white" />
          </div>
        </div>
      ) : (
        <UserAuthButtons />
      )}

         {/* Dropdown suspenso */}
        {open && isAuthenticated && (
          <div className="absolute right-0 top-full mt-3 w-64 bg-[#0f2320] border border-[#00a387] text-white rounded-lg shadow-xl overflow-hidden">
            {/* Cabeçalho: plano + expiração */}
            <div className="px-4 py-3 border-b border-[#1d3e3a] bg-[#0c1c1a]">
              {sub === null ? (
                <span className="text-xs text-[#7d978f]">Carregando plano…</span>
              ) : hasActivePlan ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Crown size={15} className="text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {sub!.subscription!.plan?.name || 'Plano ativo'}
                      {sub!.subscription!.isTrial ? ' · teste' : ''}
                    </span>
                  </div>
                  <div className={`mt-1 flex items-center gap-1.5 text-xs ${expiryColor}`}>
                    <Clock size={13} className="shrink-0" />
                    {daysLeft !== null && daysLeft <= 0 ? (
                      <span>Plano expirado</span>
                    ) : (
                      <span>
                        Expira em {formatDate(expirationDate)}
                        {daysLeft !== null && ` · ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => router.push('/plans')}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <Sparkles size={15} className="text-violet-400 shrink-0" />
                  <span className="text-sm">
                    <span className="font-semibold text-white">Sem plano ativo</span>
                    <span className="block text-xs text-[#9fb4ad]">Toque para ver os planos</span>
                  </span>
                </button>
              )}
            </div>

            <button
              onClick={() => router.push('?modal=user')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <IconUser size={18} /> Meu Perfil
            </button>
            <button
              onClick={() => router.push('?modal=user&page=banca')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <Wallet size={18} /> Gestão de Banca
            </button>
            <button
              onClick={() => router.push('?modal=user&page=mensagens')}
              className="w-full px-4 py-3 text-left hover:bg-[#143630] flex items-center gap-2 text-sm border-b border-[#1d3e3a]"
            >
              <Mail size={18} /> Mensagens
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-center bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold"
            >
              TERMINAR SESSÃO
            </button>
          </div>
      )}

    </div>
  );
};

export default UserArea;
