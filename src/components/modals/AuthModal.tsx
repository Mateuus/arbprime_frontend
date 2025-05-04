import React, { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useModalManager } from "@/hooks/useModalManager";
import { X } from "lucide-react";

const authPages = ["login", "register", "recover"] as const;
type AuthPage = typeof authPages[number];

export function isValidAuthPage(value: string): value is AuthPage {
  return authPages.includes(value as AuthPage);
}

const AuthModal: React.FC = () => {
  const { isOpen, page, closeModal } = useModalManager("auth");
  const [activePage, setActivePage] = useState<AuthPage>("login");
  const modalWidth = activePage === "register" ? "max-w-[900px]" : "max-w-[480px]";

  useEffect(() => {
    if (page && isValidAuthPage(page)) {
      setActivePage(page);
    }
  }, [page]);

  const PageComponent = dynamic(() => import(`@/pages/auth/${activePage}`), { ssr: false });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 flex items-center justify-center">
      <div className={`bg-brand-dark w-full ${modalWidth} rounded-xl shadow-2xl relative p-6 min-h-[300px]`}>
        <button onClick={closeModal} className="absolute top-4 right-4 text-white hover:text-red-500">
          <X size={22} />
        </button>

        <h2 className="text-white text-xl font-bold mb-6 text-center uppercase">
          {activePage === "login" && "Entrar"}
          {activePage === "register" && "Criar Conta"}
          {activePage === "recover" && "Recuperar Senha"}
        </h2>

        <Suspense fallback={<div className="text-white">Carregando...</div>}>
          <PageComponent />
        </Suspense>
      </div>
    </div>
  );
};

export default AuthModal;