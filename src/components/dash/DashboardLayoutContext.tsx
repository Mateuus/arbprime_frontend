import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface DashboardLayoutState {
  /** icon-only no desktop (persistido em localStorage). */
  collapsed: boolean;
  /** hover temporário sobre o sidebar colapsado (expande sem fixar). */
  hovered: boolean;
  /** drawer off-canvas aberto no mobile. */
  mobileOpen: boolean;
  /** viewport >= lg (1024px). */
  isLg: boolean;
  /** largura efetiva expandida = !collapsed || hovered. */
  wide: boolean;
  toggleCollapsed: () => void;
  setHovered: (v: boolean) => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const Ctx = createContext<DashboardLayoutState | undefined>(undefined);
const LS_KEY = 'ap:dash:collapsed';

export const DashboardLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLg, setIsLg] = useState(true);

  // localStorage só no cliente (evita mismatch de hidratação).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved != null) setCollapsed(saved === '1');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setIsLg(mq.matches);
      if (mq.matches) setMobileOpen(false); // fecha o drawer ao crescer p/ desktop
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });

  const value = useMemo<DashboardLayoutState>(
    () => ({
      collapsed,
      hovered,
      mobileOpen,
      isLg,
      wide: !collapsed || hovered,
      toggleCollapsed,
      setHovered,
      toggleMobile: () => setMobileOpen((o) => !o),
      closeMobile: () => setMobileOpen(false),
    }),
    [collapsed, hovered, mobileOpen, isLg],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useDashboardLayout = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboardLayout deve estar dentro de DashboardLayoutProvider');
  return ctx;
};
