import { useEffect } from 'react';
import { useRouter } from 'next/router';

/** Rota antiga — redireciona para a nova página de Banca. */
export default function BankrollRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/analytix/banca'); }, [router]);
  return null;
}
