import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { userMenus } from '@/utils/user.menu.config';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

import Details from '@/pages/_user/details';
import ChangePassword from '@/pages/_user/change-password';
import FilterListPage from '@/pages/_user/abfilter';
import FilterFormPage from '@/pages/_user/abfilter/edit';
import AbBookmakersPage from '@/pages/_user/ab-bookmakers';
import ServerSettings from '@/pages/_user/server';

const getPageInfo = (pageId: string) => {
  for (const menu of userMenus) {
    const found = menu.children?.find((child) => child.id === pageId);
    if (found) return found;
  }
  return { label: '', description: '' };
};

const UserModalMobile = () => {
  const { query, push, pathname } = useRouter();
  const { user } = useUserContext();

  const isOpen = query.modal === 'user';
  const currentPage = String(query.page || '');
  const [openSection, setOpenSection] = useState<string | null>('perfil');

  const closeModal = () => {
    push({ pathname, query: { ...query, modal: undefined, page: undefined } }, undefined, { shallow: true });
  };

/*
  const goBack = () => {
    push({ pathname, query: { ...query, page: undefined } }, undefined, { shallow: true });
  };*/

  if (!isOpen || !user) return null;

  const pagesWithoutBackButton = ['abfilter-edit'];

  const renderPage = () => {
    switch (currentPage) {
      case 'details':
        return <Details />;
      case 'abfilter':
          return <FilterListPage />;
      case 'abfilter-edit':
            return <FilterFormPage />;
      case 'ab-bookmakers':
        return <AbBookmakersPage />;
      case 'change-password':
        return <ChangePassword />;
      case 'server':
        return <ServerSettings />;
      default:
        return <p className="text-sm text-gray-400">Conteúdo em breve para <b>{currentPage}</b></p>;
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black bg-opacity-70 flex items-center justify-center">
      <div className="w-full max-w-md h-full bg-brand-dark text-white flex flex-col relative overflow-y-auto">
        {/* BOTÃO FECHAR */}
        <button onClick={closeModal} className="absolute right-4 top-4 z-10 text-white">
          <X size={22} />
        </button>

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-green-800 border-2 border-green-400 overflow-hidden">
              <span className="flex items-center justify-center w-full h-full text-white font-bold text-sm">
                  {user.fullname
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
            </div>
            <div className="flex flex-col">
              <strong className="text-sm">{user.fullname.toUpperCase()}</strong>
              <span className="text-xs text-gray-300">ID: {user.id}</span>
              <span className="text-green-400 text-xs">✓ Verificado</span>
            </div>
          </div>
        </div>

        {/* 
        {!currentPage && (
          <div className="p-2">
            <div className="bg-[#0c1f1e] rounded-xl p-4 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-md overflow-hidden border-2 border-green-500 shadow-md">
                    <div className="flex items-center justify-center w-full h-full bg-green-900 text-white font-bold text-lg">
                      {user.fullname
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  </div>
                  <div className="flex flex-col leading-snug">
                    <span className="text-sm font-bold text-white">{user.fullname.split(' ')[0]}</span>
                    <span className="text-xs text-gray-400">ID: {user.id}</span>
                    <span className="text-xs text-green-400 font-semibold">✓ Verificado</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Saldo principal</p>
                  <p className="text-sm font-semibold">0.00 R$</p>
                  <p className="text-xs text-gray-400">Saldo de Bônus</p>
                  <p className="text-sm text-orange-400">0.00 R$</p>
                </div>
              </div>
            </div>
          </div>
        )}*/}

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentPage ? (
          <>
            <div className="mb-4">
              <div className="flex items-start gap-3">
               {!pagesWithoutBackButton.includes(currentPage) && (
                  <button
                    onClick={() => push({ pathname, query: { modal: 'user' } }, undefined, { shallow: true })}
                    className="px-3 py-3 bg-[#1a2c2e] hover:bg-[#1e3a38] text-white text-sm rounded-lg flex items-center gap-1"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold leading-tight">{getPageInfo(currentPage).label}</h1>
                  <p className="text-sm text-gray-400 leading-tight">{getPageInfo(currentPage).description}</p>
                </div>
              </div>
            </div>

            <div>
              {renderPage()}
            </div>
          </>
          ) : (
            <>
              {userMenus.map((menu) => {
                const isSelected = openSection === menu.id;

                if (openSection && !isSelected) return null;

                return (
                  <div key={menu.id} className="mb-2">
                    <button
                      onClick={() =>
                        setOpenSection(isSelected ? null : menu.id)
                      }
                      className={`w-full flex justify-between items-center px-4 py-3 rounded-lg text-sm mb-2 transition
                        ${isSelected ? 'bg-[#24433e]' : 'bg-[#1a2c2e] hover:bg-[#1e3a38]'}`}
                    >
                      <div className="flex items-center gap-2">{menu.icon}<span>{menu.label}</span></div>
                      {isSelected ? 
                        <ChevronLeft size={16} /> 
                        : 
                        <ChevronRight size={16} />
                      }
                    </button>

                    {isSelected && menu.children?.length > 0 && (
                      <div className="space-y-2 animate-slide-in">
                        {menu.children.map((item) => (
                          <button
                            key={item.id}
                            onClick={() =>
                              push({ pathname, query: { ...query, page: item.id } }, undefined, { shallow: true })
                            }
                            className="w-full flex justify-between items-center px-4 py-3 bg-[#1a2c2e] hover:bg-[#1e3a38] rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-2">{item.icon}<span>{item.label}</span></div>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={closeModal}
                className="w-full mt-6 py-3 bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold rounded-xl"
              >
                TERMINAR SESSÃO
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserModalMobile;