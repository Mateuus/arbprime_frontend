import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Flag, EyeOff, Check, Loader2, Users, SearchX, Tag, TrendingUp, Lock, MessageSquare, ShieldAlert, Store, CalendarX } from 'lucide-react';
import { apiGateway, CreateReportDTO, ReportReason } from '@/gateways/api.gateway';
import { SurebetData, Surebet, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { HideType, houseKey, selectionKey } from '@/hooks/useHiddenSet';
import { surebetKey } from '@/utils/surebetKey';
import { useUserContext } from '@/context/UserContext';

const REASONS: { key: ReportReason; label: string; scope: 'event' | 'leg'; icon: React.ReactNode }[] = [
  { key: 'different_teams', label: 'Times diferentes', scope: 'event', icon: <Users size={13} /> },
  { key: 'event_not_found', label: 'Evento não encontrado', scope: 'leg', icon: <SearchX size={13} /> },
  { key: 'wrong_markets', label: 'Mercados errados', scope: 'leg', icon: <Tag size={13} /> },
  { key: 'different_odds', label: 'Chances têm valores diferentes', scope: 'leg', icon: <TrendingUp size={13} /> },
  { key: 'closed_market', label: 'Mercado fechado', scope: 'leg', icon: <Lock size={13} /> },
  { key: 'other', label: 'Outro', scope: 'leg', icon: <MessageSquare size={13} /> },
];

interface Props {
  event: SurebetData;
  sb: Surebet;
  leg: SurebetOdd;
  // Ocultar (do hook useHiddenSet)
  onHide: (type: HideType, itemKey: string, label?: string, eventStartAt?: string | null) => void;
  isHidden: (type: HideType, itemKey: string) => boolean;
  notify?: (text: string) => void;
}

/**
 * Menu kebab (3 pontinhos) de uma perna da surebet: Reclamações (report) +
 * Ocultar (odd/casa/evento). "Times diferentes" é a única reclamação de escopo
 * 'event' (afeta o grupo todo); as demais — inclusive "evento não encontrado" —
 * vão com scope 'leg', carregando a casa da seleção (admin remove só aquela casa).
 */
type AdminScope = 'market' | 'house' | 'event';

const SurebetActionsMenu = ({ event, sb, leg, onHide, isHidden, notify }: Props) => {
  const { user } = useUserContext();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [sending, setSending] = useState<ReportReason | null>(null);
  const [excluding, setExcluding] = useState<AdminScope | null>(null);
  const [sent, setSent] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setSent(false); }, []);

  // Posição fixa calculada do botão (o card tem overflow-hidden).
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 248;
    let left = r.right - width;
    if (left < 8) left = 8;
    setPos({ top: r.bottom + 4, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  const submitReport = async (reason: ReportReason, scope: 'event' | 'leg') => {
    setSending(reason);
    const base: CreateReportDTO = {
      reason,
      scope,
      eventId: event.id,
      sport: event.sport,
      league: event.league,
      home: event.home,
      away: event.away,
      eventStartAt: event.date || null,
      surebetKey: surebetKey(event, sb),
    };
    if (scope === 'leg') {
      base.bookmaker = leg.bookmaker;
      base.houseEventId = leg.eventId;
      base.market = leg.market;
      base.selection = leg.option;
      base.handicap = leg.handicap != null ? String(leg.handicap) : undefined;
      base.price = Number(leg.price);
    }
    try {
      const res = await apiGateway.createReport(base);
      if (res.data?.result === 1) {
        setSent(true);
        notify?.('Reclamação enviada. Obrigado!');
        setTimeout(close, 1200);
      } else {
        notify?.(res.data?.message || 'Erro ao enviar reclamação.');
      }
    } catch {
      notify?.('Erro ao enviar reclamação.');
    } finally {
      setSending(null);
    }
  };

  // Exclusão GLOBAL (admin): tira do cálculo de surebets para TODOS os usuários.
  // market = só este mercado da casa; house = a casa inteira; event = o evento todo.
  const adminExclude = async (scope: AdminScope) => {
    const mkt = leg.rawMarket || leg.market;
    const confirmMsg =
      scope === 'event' ? `Remover o EVENTO inteiro "${event.home} x ${event.away}" do cálculo (todas as casas)?`
      : scope === 'house' ? `Remover a casa ${leg.bookmaker} (TODOS os mercados) de "${event.home} x ${event.away}"?`
      : `Remover o mercado "${mkt}" da casa ${leg.bookmaker} em "${event.home} x ${event.away}"?`;
    if (!window.confirm(confirmMsg)) return;
    setExcluding(scope);
    try {
      const payload: { scope: AdminScope; bookmaker?: string; houseEventId?: string; market?: string; groupId?: string; label?: string; reason?: string; eventStartAt?: string | null } = {
        scope,
        label: `${event.home} x ${event.away}`,
        reason: 'admin',
        eventStartAt: event.date || null,
      };
      if (scope === 'event') {
        payload.groupId = event.id;
      } else {
        payload.bookmaker = leg.bookmaker;
        payload.houseEventId = leg.eventId;
        if (scope === 'market') {
          payload.market = leg.market;
          payload.label = `${event.home} x ${event.away} · ${mkt}`;
          payload.reason = `admin:${mkt}`;
        }
      }
      const res = await apiGateway.createExclusion(payload);
      notify?.(res.data?.message || (res.data?.result === 1 ? 'Removido do cálculo.' : 'Erro ao remover.'));
      if (res.data?.result === 1) close();
    } catch {
      notify?.('Erro ao remover do cálculo.');
    } finally {
      setExcluding(null);
    }
  };

  const hKey = houseKey(leg.bookmaker, leg.eventId);
  const sKey = selectionKey(leg);
  const evHidden = isHidden('event', event.id);

  const doHide = (type: HideType, key: string, label: string) => {
    // Leva o início do evento (event.date) p/ o item ser auto-removido quando o jogo começar.
    onHide(type, key, label, event.date || null);
    notify?.('Ocultado. Você pode reexibir nas configurações.');
    close();
  };

  const itemCls = 'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-gray-200 hover:bg-white/10 transition disabled:opacity-50';
  const adminItemCls = 'w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left text-rose-200 hover:bg-rose-500/15 transition disabled:opacity-50';

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="grid place-items-center h-5 w-5 rounded text-gray-500 hover:text-teal-300 hover:bg-white/10 shrink-0 transition"
        title="Reportar ou ocultar"
        aria-label="Reportar ou ocultar"
      >
        <MoreVertical size={13} />
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 248 }}
          className="z-[10000] rounded-xl border border-white/10 bg-brand-dark shadow-2xl py-1.5 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {sent ? (
            <div className="px-3 py-4 text-center text-sm text-emerald-300 flex items-center justify-center gap-2">
              <Check size={16} /> Reclamação enviada!
            </div>
          ) : (
            <>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-1"><Flag size={11} /> Reclamações</div>
              {REASONS.map((r) => (
                <button key={r.key} disabled={!!sending} onClick={() => submitReport(r.key, r.scope)} className={itemCls}>
                  <span className="text-gray-400">{sending === r.key ? <Loader2 size={13} className="animate-spin" /> : r.icon}</span>
                  <span className="truncate">{r.label}</span>
                </button>
              ))}

              <div className="my-1 border-t border-white/10" />
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-1"><EyeOff size={11} /> Ocultar</div>
              <button onClick={() => doHide('selection', sKey, `${leg.bookmaker} · ${leg.option}`)} className={itemCls} disabled={isHidden('selection', sKey)}>
                <EyeOff size={13} className="text-gray-400" /> Ocultar esta odd
              </button>
              <button onClick={() => doHide('house', hKey, `${leg.bookmaker} · ${event.home} x ${event.away}`)} className={itemCls} disabled={isHidden('house', hKey)}>
                <EyeOff size={13} className="text-gray-400" /> Ocultar esta casa no evento
              </button>
              <button onClick={() => doHide('event', event.id, `${event.home} x ${event.away}`)} className={itemCls} disabled={evHidden}>
                <EyeOff size={13} className="text-gray-400" /> Ocultar este evento
              </button>

              {isAdmin && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-rose-400/80 flex items-center gap-1"><ShieldAlert size={11} /> Admin · remover do cálculo</div>
                  <button onClick={() => adminExclude('market')} disabled={!!excluding} className={adminItemCls}>
                    {excluding === 'market' ? <Loader2 size={13} className="animate-spin" /> : <Tag size={13} className="text-rose-300/80" />}
                    <span className="truncate">Remover mercado · {leg.rawMarket || leg.market}</span>
                  </button>
                  <button onClick={() => adminExclude('house')} disabled={!!excluding} className={adminItemCls}>
                    {excluding === 'house' ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} className="text-rose-300/80" />}
                    <span className="truncate">Remover casa {leg.bookmaker} (todos os mercados)</span>
                  </button>
                  <button onClick={() => adminExclude('event')} disabled={!!excluding} className={adminItemCls}>
                    {excluding === 'event' ? <Loader2 size={13} className="animate-spin" /> : <CalendarX size={13} className="text-rose-300/80" />}
                    <span className="truncate">Remover evento (todas as casas)</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default SurebetActionsMenu;
