import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { userMenus } from "@/utils/user.menu.config";
import dynamic from "next/dynamic";
import { useUserContext } from "@/context/UserContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UserPages: Record<string, any> = {
  details: dynamic(() => import("@/pages/_user/details")),
  mensagens: dynamic(() => import("@/pages/_user/mensagens")),
  "abfilter": dynamic(() => import("@/pages/_user/abfilter/index")),
  "abfilter-edit": dynamic(() => import("@/pages/_user/abfilter/edit/index")),
  "change-password": dynamic(() => import("@/pages/_user/change-password")),
};

const UserModalDesktop = () => {
  const router = useRouter();
  const currentPage = router.query.page as string | undefined;
  const [openSection, setOpenSection] = useState<string | null>('perfil');
  const { user } = useUserContext();

  const currentItem = userMenus
  .flatMap(menu => menu.children || [])
  .find(child => child.id === currentPage);

  const CurrentComponent = currentPage ? UserPages[currentPage] : null;

  useEffect(() => {
    if (!router.query.modal || router.query.modal !== 'user') return;
    const page = router.query.page as string;
    if (page && !UserPages[page]) {
      router.replace({ pathname: router.pathname, query: { modal: 'user' } }, undefined, { shallow: true });
    }
  }, [router]);

  if (router.query.modal !== "user") return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center">
      <div className="bg-brand-dark w-full max-w-5xl h-[90vh] sm:rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
        <button
          onClick={() => router.replace({ pathname: router.pathname, query: {} }, undefined, { shallow: true })}
          className="absolute top-4 right-4 text-white hover:text-red-500 z-10"
        >
          <X size={24} />
        </button>

        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Sidebar */}
          <aside className={`w-[320px] h-full p-4 bg-brand-dark overflow-y-auto`} style={{ boxShadow: '5px 0 12px rgba(0, 0, 0, 0.4)', zIndex: 1 }}>
            {/* Cabeçalho */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#114646] to-[#072b2e]`} style={{ boxShadow: '5px 0 12px rgba(0, 0, 0, 0.4)', zIndex: 1 }}>
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#4d5c5a] text-white font-semibold text-sm">
                {user?.fullname
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-white">{user?.fullname.toUpperCase()}</span>
                </div>
            </div>
            <nav className="space-y-3 mt-6">
              {userMenus.map((menu) => {
                const isSelected = openSection === menu.id;
                return (
                  <div key={menu.id} className={`bg-gradient-to-b from-[#114646] to-[#202c2a] rounded-xl`} style={{ boxShadow: '20px 0 20px rgba(0, 0, 0, 0.5)', zIndex: 1 }}>
                    <button
                      onClick={() => setOpenSection(isSelected ? null : menu.id)}
                      className={`w-full flex items-center justify-between px-4 py-5 text-white font-semibold text-sm`}
                    >
                      <span className="flex items-center gap-2">{menu.icon} {menu.label}</span>
                      {isSelected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isSelected && (
                      <div className="bg-gradient-to-b flex-1 from-[#114646] to-[#202c2a] px-4 py-4 rounded-b-xl">
                        {menu.children?.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => router.replace({ pathname: router.pathname, query: { modal: 'user', page: child.id } }, undefined, { shallow: true })}
                            className={`w-full text-left px-6 py-2 text-sm border-l-2 transition-transform duration-200 ease-in-out
                                ${
                                  currentPage === child.id || child.match?.includes(currentPage ?? '')
                                    ? "border-green-400 text-white bg-gradient-to-r from-[#0f232281] to-[#0f23220e] translate-y-[2px]"
                                    : "border-[#2b534f83] text-gray-400"
                                }`}
                          >
                            <span className="flex items-center gap-2">{child.icon} {child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            {/* Botão de logout */}
            <button
                className="w-full mt-6 py-3 bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold rounded-xl"
              >
                TERMINAR SESSÃO
              </button>
          </aside>

          {/* Main content */}
          <main className="flex-1 bg-brand-dark text-white p-6 overflow-y-auto">
            {currentPage && currentItem && (
              <div className="mb-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col">
                    <h1 className="text-lg font-bold leading-tight">{currentItem.label}</h1>
                    <p className="text-sm text-gray-400 leading-tight">{currentItem.description}</p>
                  </div>
                </div>
                <hr className="border-t border-[#2b534f83] my-4" />
              </div>
            )}

            {CurrentComponent ? <CurrentComponent /> : (
              <div className="text-gray-400">Selecione um item do menu ao lado para começar.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default UserModalDesktop;