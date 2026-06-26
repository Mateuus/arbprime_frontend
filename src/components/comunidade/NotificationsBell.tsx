import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Bell, UserPlus, Check } from 'lucide-react';
import { apiGateway, NotificationDTO } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import { unwrap, fmtDateTime } from '@/components/analytix/format';

/** Sino de notificações da Comunidade (server-side). Só p/ logados. */
export default function NotificationsBell() {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await apiGateway.getCommunityNotifications();
      const d = unwrap<{ items: NotificationDTO[]; unread: number }>(r, { items: [], unread: 0 });
      setItems(d.items); setUnread(d.unread);
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void (async () => { if (active) await load(); })();
    const iv = setInterval(() => { void load(); }, 60000);
    return () => { active = false; clearInterval(iv); };
  }, [isAuthenticated]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!isAuthenticated) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try { await apiGateway.markCommunityNotificationsRead(); setUnread(0); } catch { /* noop */ }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative grid place-items-center h-9 w-9 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10" title="Notificações">
        <Bell size={17} />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-white/10 bg-brand-dark shadow-2xl z-[10000] overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-300 border-b border-white/10">Notificações</div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-500">Nenhuma notificação.</div>
            ) : items.map((n) => (
              <button
                key={n.id}
                onClick={() => { setOpen(false); if (n.actorHandle) router.push(`/comunidade/u/${n.actorHandle}`); }}
                className={`flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-white/5 transition ${!n.readAt ? 'bg-teal-500/[0.06]' : ''}`}
              >
                <span className="grid place-items-center h-7 w-7 rounded-full bg-teal-500/15 text-teal-300 shrink-0 mt-0.5">
                  {n.kind === 'new_follower' ? <UserPlus size={13} /> : <Check size={13} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-gray-200">{n.title || 'Notificação'}</span>
                  <span className="block text-[10px] text-gray-500">{fmtDateTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
