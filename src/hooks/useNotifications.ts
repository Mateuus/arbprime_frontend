import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Engine de notificações do ArbBets. Centraliza configurações (persistidas),
// o feed de alertas e o disparo (som + feed + desktop). É o ÚNICO ponto onde,
// no futuro, plugamos o Telegram (basta o `notify` também chamar um gateway
// quando o usuário tiver telegramId configurado).
// ---------------------------------------------------------------------------

export type AlertKind = 'new' | 'watched' | 'gone';

export interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  subtitle: string;
  eventId: string;
  surebetKey?: string;
  profit?: number;
  ts: number;
  read: boolean;
}

export type NotifyInput = Omit<AlertItem, 'id' | 'ts' | 'read'>;

export interface NotifSettings {
  enabled: boolean;      // mestre — liga/desliga tudo
  sound: boolean;        // tocar som
  desktop: boolean;      // notificação do sistema (Notification API)
  alertNew: boolean;     // alertar quando surgir surebet nova
  alertWatched: boolean; // alertar mudança nas surebets/eventos seguidos
  minProfit: number;     // só alertar surebets novas com lucro >= isto (anti-spam)
  ledEffect: boolean;    // efeito de borda "LED RGB" nos cards novos
}

const DEFAULTS: NotifSettings = {
  enabled: false,
  sound: true,
  desktop: false,
  alertNew: true,
  alertWatched: true,
  minProfit: 0,
  ledEffect: true
};

const LS_KEY = 'arbbets:notif';
const FEED_MAX = 40;

// -- Som (Web Audio, sem depender de arquivo) -------------------------------
let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Destrava o áudio — deve ser chamado a partir de um gesto do usuário. */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** Toca um "ding-dong" curto e agradável. */
export function playBeep(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const tone = (freq: number, start: number, dur = 0.18) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + start);
    g.gain.exponentialRampToValueAtTime(0.25, now + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    o.start(now + start);
    o.stop(now + start + dur + 0.02);
  };
  tone(880, 0);      // dó agudo
  tone(1174.66, 0.15); // ré — segundo toque
}

export function useNotifications(onActivate?: (a: AlertItem) => void) {
  const [settings, setSettingsState] = useState<NotifSettings>(DEFAULTS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const settingsRef = useRef(settings);
  const seqRef = useRef(0);
  const activateRef = useRef(onActivate);

  // Mantém os refs sincronizados (fora do render) para os callbacks lerem o atual.
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { activateRef.current = onActivate; }, [onActivate]);

  // Hidrata as configurações salvas.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSettingsState({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const setSettings = useCallback((patch: Partial<NotifSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Dispara um alerta (feed + som + desktop). No-op se desabilitado.
  const notify = useCallback((a: NotifyInput) => {
    const s = settingsRef.current;
    if (!s.enabled) return;
    const item: AlertItem = { ...a, id: `n${Date.now()}_${seqRef.current++}`, ts: Date.now(), read: false };
    setAlerts((prev) => [item, ...prev].slice(0, FEED_MAX));
    if (s.sound) playBeep();
    if (s.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(a.title, { body: a.subtitle, tag: item.id });
        // Clicar na notificação do sistema foca a janela e abre a surebet no modal.
        n.onclick = () => {
          try { window.focus(); } catch { /* ignore */ }
          activateRef.current?.(item);
          n.close();
        };
      } catch { /* ignore */ }
    }
  }, []);

  const unread = alerts.reduce((n, a) => n + (a.read ? 0 : 1), 0);
  const markAllRead = useCallback(() => setAlerts((prev) => (prev.some((a) => !a.read) ? prev.map((a) => ({ ...a, read: true })) : prev)), []);
  const clear = useCallback(() => setAlerts([]), []);

  return { settings, setSettings, alerts, unread, notify, markAllRead, clear };
}

export type NotificationsApi = ReturnType<typeof useNotifications>;
