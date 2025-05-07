import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useMediaQuery } from 'react-responsive';

// Carregar modal mobile e desktop separadamente (evita peso desnecessário)
const UserModalMobile = dynamic(() => import('./UserModalMobile'), { ssr: false });
const UserModalDesktop = dynamic(() => import('./UserModalDesktop'), { ssr: false });

const UnifiedUserModal = () => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Evita erro de renderização no SSR
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return isMobile ? <UserModalMobile /> : <UserModalDesktop />;
};

export default UnifiedUserModal;
