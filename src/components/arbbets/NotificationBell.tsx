import { useState } from 'react';
import { Bell, BellRing, Volume2, Trash2, X, TrendingUp, Eye, Zap } from 'lucide-react';
import { unlockAudio, playBeep, NotificationsApi, AlertKind, AlertItem } from '@/hooks/useNotifications';

// Linha de toggle reutilizável.
function Toggle({ label, hint, checked, onChange, disabled }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
    >
      <span className="min-w-0">
        <span className="block text-sm text-gray-200">{label}</span>
        {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-teal-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

const KIND_ICON: Record<AlertKind, React.ReactNode> = {
  new: <Zap size={14} className="text-teal-300" />,
  watched: <Eye size={14} className="text-amber-300" />,
  gone: <X size={14} className="text-rose-400" />
};

const fmtTime = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function NotificationBell({ notif, watchCount = 0, onOpenAlert }: { notif: NotificationsApi; watchCount?: number; onOpenAlert?: (a: AlertItem) => void }) {
  const [open, setOpen] = useState(false);
  const { settings, setSettings, alerts, unread, markAllRead, clear } = notif;

  const openPanel = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead();
  };

  const toggleMaster = () => {
    const next = !settings.enabled;
    if (next) {
      unlockAudio(); // gesto do usuário → destrava o áudio
      if (settings.sound) playBeep();
    }
    setSettings({ enabled: next });
  };

  const toggleDesktop = (v: boolean) => {
    if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => setSettings({ desktop: p === 'granted' }));
      return;
    }
    setSettings({ desktop: v && typeof Notification !== 'undefined' && Notification.permission === 'granted' });
  };

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className={`relative grid place-items-center h-9 w-9 rounded-lg border transition ${
          settings.enabled ? 'bg-teal-500/15 border-teal-500/40 text-teal-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
        }`}
        title="Notificações de surebets"
      >
        {settings.enabled ? <BellRing size={16} className={unread > 0 ? 'animate-pulse' : ''} /> : <Bell size={16} />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid place-items-center h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-brand-dark shadow-2xl overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white">Notificações</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-rose-400"><X size={16} /></button>
            </div>

            {/* Configuração */}
            <div className="p-2 border-b border-white/10">
              <Toggle
                label="Ativar alertas"
                hint={settings.enabled ? 'Tocando e mostrando alertas' : 'Toque para ligar (libera o som)'}
                checked={settings.enabled}
                onChange={toggleMaster}
              />
              <Toggle
                label="Efeito LED na borda"
                hint="Borda RGB animada nos cards novos"
                checked={settings.ledEffect}
                onChange={(v) => setSettings({ ledEffect: v })}
              />
              <div className={settings.enabled ? '' : 'pointer-events-none opacity-40'}>
                <Toggle label="Som" checked={settings.sound} onChange={(v) => { setSettings({ sound: v }); if (v) { unlockAudio(); playBeep(); } }} />
                <Toggle label="Novas surebets" hint="Avisar quando surgir uma surebet nova" checked={settings.alertNew} onChange={(v) => setSettings({ alertNew: v })} />
                <Toggle label="Seguidas" hint="Avisar mudança nas que você segue" checked={settings.alertWatched} onChange={(v) => setSettings({ alertWatched: v })} />
                <Toggle label="Notificação do sistema" hint="Mostrar no desktop (precisa permitir)" checked={settings.desktop} onChange={toggleDesktop} />
                <div className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2">
                  <span className="text-sm text-gray-200">Lucro mínimo p/ avisar
                    <span className="block text-[11px] text-gray-500">Só novas surebets acima de</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      value={String(settings.minProfit)}
                      onChange={(e) => setSettings({ minProfit: parseFloat(e.target.value) || 0 })}
                      inputMode="decimal"
                      className="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2.5 pt-1">
                  <button onClick={() => playBeep()} className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-teal-300 transition">
                    <Volume2 size={13} /> Testar som
                  </button>
                  {watchCount > 0 && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-300/80">
                      <Eye size={12} /> {watchCount} seguindo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Feed */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-500">Recentes</span>
              {alerts.length > 0 && (
                <button onClick={clear} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-rose-300 transition">
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto px-2 pb-3 space-y-1">
              {alerts.length === 0 ? (
                <div className="px-2 py-8 text-center text-xs text-gray-500">
                  {settings.enabled ? 'Sem alertas ainda. Você será avisado quando surgir algo.' : 'Ative os alertas para começar a receber avisos.'}
                </div>
              ) : (
                alerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { if (a.kind !== 'gone') { onOpenAlert?.(a); setOpen(false); } }}
                    disabled={a.kind === 'gone'}
                    className={`flex w-full items-start gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-left transition ${a.kind === 'gone' ? 'cursor-default opacity-70' : 'hover:bg-white/10'}`}
                  >
                    <span className="mt-0.5 shrink-0">{KIND_ICON[a.kind]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-white truncate">{a.title}</span>
                        {typeof a.profit === 'number' && (
                          <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-300 tabular-nums"><TrendingUp size={11} />{a.profit.toFixed(2)}%</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{a.subtitle}</div>
                      <div className="text-[10px] text-gray-600">{fmtTime(a.ts)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default NotificationBell;
