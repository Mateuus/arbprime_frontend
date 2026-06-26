import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { apiGateway } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import { useMyHandle } from './useMyHandle';

interface Props {
  handle: string;
  following?: boolean;
  isSelf?: boolean;
  size?: 'sm' | 'md';
  onChange?: (following: boolean) => void;
}

/** Botão Seguir / Seguindo (hover → Deixar de seguir). Gate de login na ação. */
export default function FollowButton({ handle, following = false, isSelf = false, size = 'md', onChange }: Props) {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();
  const myHandle = useMyHandle();
  const [f, setF] = useState(following);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  // Não mostra "Seguir" no próprio perfil (via backend isSelf OU handle próprio).
  if (isSelf || (myHandle && myHandle.toLowerCase() === handle.toLowerCase())) return null;

  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm';
  const ic = size === 'sm' ? 13 : 15;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push({ pathname: '/comunidade', query: { modal: 'auth', page: 'login' } });
      return;
    }
    setLoading(true);
    try {
      if (f) { await apiGateway.unfollowUser(handle); setF(false); onChange?.(false); }
      else { await apiGateway.followUser(handle); setF(true); onChange?.(true); }
    } catch { /* noop */ } finally { setLoading(false); }
  };

  if (f) {
    return (
      <button
        onClick={toggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition ring-1 ${pad} ${hover ? 'bg-rose-500/15 text-rose-300 ring-rose-500/40' : 'bg-white/5 text-gray-200 ring-white/15'}`}
      >
        {loading ? <Loader2 className="animate-spin" size={ic} /> : <UserCheck size={ic} />}
        {hover ? 'Deixar de seguir' : 'Seguindo'}
      </button>
    );
  }
  return (
    <button onClick={toggle} disabled={loading} className={`inline-flex items-center gap-1.5 rounded-lg font-semibold bg-teal-500 hover:bg-teal-400 text-slate-900 transition ${pad} disabled:opacity-60`}>
      {loading ? <Loader2 className="animate-spin" size={ic} /> : <UserPlus size={ic} />} Seguir
    </button>
  );
}
