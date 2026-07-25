import { useDashboardLayout } from './DashboardLayoutContext';

/** Overlay que fecha o drawer no mobile. Só aparece com o drawer aberto (< lg). */
export default function DashboardBackdrop() {
  const { mobileOpen, closeMobile } = useDashboardLayout();
  if (!mobileOpen) return null;
  return (
    <button
      type="button"
      aria-label="Fechar menu"
      onClick={closeMobile}
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
    />
  );
}
