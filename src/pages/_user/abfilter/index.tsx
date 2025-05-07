'use client';
import React, { useEffect, useState } from 'react';
import { Pencil, Copy, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { apiGateway } from '@/gateways/api.gateway';
import { CreateOrUpdateFilterDTO } from '@/interfaces';
import AlertModal from "@/components/modals/AlertModal";
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';

interface Filter {
  id: string;
  name: string;
  createdAt: string;
}


const FilterListPage = () => {
  const [filters, setFilters] = useState<Filter[]>([]);
  const router = useRouter();

  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [showModal, setShowModal] = useState(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleCloseModal = () => {
    setShowModal(false);
    setModalMessage('');
  };

  useEffect(() => {
    const loadFilters = async () => {
      try {
        setIsLoading(true);
        const response = await apiGateway.getUserFilters();
        if (response.data?.result === 1 && Array.isArray(response.data.data)) {
          const loadedFilters = (response.data.data as Filter[]).map((f) => ({
            id: f.id,
            name: f.name,
            createdAt: new Date(f.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
          }));
          setFilters(loadedFilters);
        }
      } catch (error) {
        console.error('Erro ao carregar filtros do usuário:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilters();
  }, []);

  const handleCopy = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await apiGateway.getFilterById(id);
      const original = res.data.data;
  
      const payload: CreateOrUpdateFilterDTO = {
        name: `${original.name} (Cópia)`,
        sortBy: original.sortBy,
        sortDirection: original.sortDirection,
        profitMin: original.profitMin,
        profitMax: original.profitMax,
        roiMin: original.roiMin,
        roiMax: original.roiMax,
        ageMin: original.ageMin,
        ageMax: original.ageMax,
        outcomes: original.outcomes,
        bookmakers: original.bookmakers,
        sports: original.sports,
        tournaments: original.tournaments,
        duration: original.duration,
        requiredBookmakers: original.requiredBookmakers
      };
  
      const created = await apiGateway.createFilter(payload);
  
      if (created.data?.data?.id) {
        const newId = created.data.data.id;
        router.replace(
          {
            pathname: router.pathname,
            query: { ...router.query, page: 'abfilter-edit', id: newId },
          },
          undefined,
          { shallow: true }
        );
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setModalType('error');
      setModalMessage(err.response?.data?.message || 'Erro ao deletar o filtro.');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Tem certeza que deseja deletar este filtro?');
  
    if (!confirm) return;
  
    try {
      setIsLoading(true);
      await apiGateway.deleteFilter(id);
      setFilters((prev) => prev.filter((f) => f.id !== id));
      setModalType('success');
      setModalMessage('Filtro deletado com sucesso.');
      setShowModal(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setModalType('error');
      setModalMessage(err.response?.data?.message || 'Erro ao deletar filtro.');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const goToEdit = (id: string) => {
    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, page: 'abfilter-edit', id },
      },
      undefined,
      { shallow: true }
    );
  };

  if (isLoading) return <SportsCryptoLoading />;

  return (
    <div className="space-y-6 px-4 py-6 text-white max-w-6xl mx-auto">
      <div className="justify-items-end">
        <button onClick={() => goToEdit('new')} className="px-6 py-3 bg-[#1c3733] text-[#b6cfc8] hover:bg-[#24433e] text-sm font-semibold rounded-xl">
          Adicionar Filtro
        </button>
      </div>

      {/* Tabela para Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-[#1c2a2a] text-left uppercase text-xs font-bold">
              <th className="py-2 px-4">ID</th>
              <th className="py-2 px-4">Nome</th>
              <th className="py-2 px-4">Data</th>
              <th className="py-2 px-4 text-center">Editar</th>
              <th className="py-2 px-4 text-center">Copiar</th>
              <th className="py-2 px-4 text-center">Deletar</th>
            </tr>
          </thead>
          <tbody>
            {filters.map((filter) => (
              <tr key={filter.id} className="border-b border-gray-600">
                <td className="py-2 px-4">{filter.id}</td>
                <td className="py-2 px-4">{filter.name}</td>
                <td className="py-2 px-4">{filter.createdAt}</td>
                <td className="py-2 px-4 text-center">
                  <Pencil size={16} className="text-green-300 cursor-pointer" onClick={() => goToEdit(filter.id)} />
                </td>
                <td className="py-2 px-4 text-center">
                  <Copy size={16} className="text-white cursor-pointer" onClick={() => handleCopy(filter.id)} />
                </td>
                <td className="py-2 px-4 text-center">
                  <X size={16} className="text-red-400 cursor-pointer" onClick={() => handleDelete(filter.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {filters.map((filter) => (
          <div key={filter.id} className="border border-gray-700 rounded-lg p-4 bg-[#1c2a2e] space-y-2">
            <div><span className="font-semibold text-gray-300">ID:</span> {filter.id}</div>
            <div><span className="font-semibold text-gray-300">Nome:</span> {filter.name}</div>
            <div><span className="font-semibold text-gray-300">Data:</span> {filter.createdAt}</div>
            <div className="flex justify-end gap-4 pt-2">
              <Pencil size={18} className="text-green-300 cursor-pointer" onClick={() => goToEdit(filter.id)} />
              <Copy size={16} className="text-white cursor-pointer" onClick={() => handleCopy(filter.id)} />
              <X size={18} className="text-red-400 cursor-pointer" onClick={() => handleDelete(filter.id)} />
            </div>
          </div>
        ))}
      </div>

      {showModal && (
          <AlertModal
            type={modalType}
            title={modalType === 'success' ? 'Sucesso' : 'Erro'}
            message={modalMessage}
            onClose={handleCloseModal}
          />
       )}
    </div>
  );
};

export default FilterListPage;