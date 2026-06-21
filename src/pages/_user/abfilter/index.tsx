'use client';
import React, { useEffect, useState } from 'react';
import { Pencil, Copy, Trash2, Plus, Filter } from 'lucide-react';
import { useRouter } from 'next/router';
import { apiGateway } from '@/gateways/api.gateway';
import { CreateOrUpdateFilterDTO } from '@/interfaces';
import AlertModal from '@/components/modals/AlertModal';
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

  const handleCloseModal = () => { setShowModal(false); setModalMessage(''); };

  useEffect(() => {
    const loadFilters = async () => {
      try {
        setIsLoading(true);
        const response = await apiGateway.getUserFilters();
        if (response.data?.result === 1 && Array.isArray(response.data.data)) {
          const loaded = (response.data.data as Filter[]).map((f) => ({
            id: f.id,
            name: f.name,
            createdAt: new Date(f.createdAt).toLocaleString('pt-BR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
          }));
          setFilters(loaded);
        }
      } catch (error) {
        console.error('Erro ao carregar filtros do usuário:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFilters();
  }, []);

  const goToEdit = (id: string) => {
    router.replace({ pathname: router.pathname, query: { ...router.query, page: 'abfilter-edit', id } }, undefined, { shallow: true });
  };

  const handleCopy = async (id: string) => {
    try {
      setIsLoading(true);
      const res = await apiGateway.getFilterById(id);
      const o = res.data.data;
      const payload: CreateOrUpdateFilterDTO = {
        name: `${o.name} (Cópia)`,
        sortBy: o.sortBy, sortDirection: o.sortDirection,
        profitMin: o.profitMin, profitMax: o.profitMax,
        roiMin: o.roiMin, roiMax: o.roiMax,
        ageMin: o.ageMin, ageMax: o.ageMax,
        oddsMin: o.oddsMin, oddsMax: o.oddsMax, stake: o.stake,
        outcomes: o.outcomes, bookmakers: o.bookmakers, sports: o.sports,
        tournaments: o.tournaments, duration: o.duration, requiredBookmakers: o.requiredBookmakers
      };
      const created = await apiGateway.createFilter(payload);
      if (created.data?.data?.id) goToEdit(created.data.data.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setModalType('error');
      setModalMessage(err.response?.data?.message || 'Erro ao copiar o filtro.');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este filtro?')) return;
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

  if (isLoading) return <div className="flex justify-center py-12"><SportsCryptoLoading /></div>;

  return (
    <div className="text-white max-w-4xl mx-auto p-1 sm:p-2">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Filter className="text-teal-300" size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Filtros</h1>
            <p className="text-xs text-gray-400">Configure os filtros das surebets do seu jeito</p>
          </div>
        </div>
        <button
          onClick={() => goToEdit('new')}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition shrink-0"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Adicionar filtro</span><span className="sm:hidden">Novo</span>
        </button>
      </header>

      {filters.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-14 text-center">
          <Filter className="mx-auto text-gray-600 mb-3" size={30} />
          <p className="text-gray-400">Você ainda não tem filtros.</p>
          <button onClick={() => goToEdit('new')} className="mt-3 inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200">
            <Plus size={15} /> Criar o primeiro
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Desktop */}
          <table className="hidden md:table w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-gray-400 bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium text-left w-16">ID</th>
                <th className="px-4 py-3 font-medium text-left">Nome</th>
                <th className="px-4 py-3 font-medium text-left">Criado em</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filters.map((f) => (
                <tr key={f.id} className="border-t border-white/5 hover:bg-white/[0.04] transition">
                  <td className="px-4 py-3 text-gray-500 tabular-nums">{f.id}</td>
                  <td className="px-4 py-3 font-medium text-white">{f.name}</td>
                  <td className="px-4 py-3 text-gray-400">{f.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => goToEdit(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar"><Pencil size={15} /></button>
                      <button onClick={() => handleCopy(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-sky-300 hover:bg-white/10 transition" title="Copiar"><Copy size={15} /></button>
                      <button onClick={() => handleDelete(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <ul className="md:hidden divide-y divide-white/5">
            {filters.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">{f.name}</div>
                  <div className="text-[11px] text-gray-500">#{f.id} · {f.createdAt}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => goToEdit(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition"><Pencil size={16} /></button>
                  <button onClick={() => handleCopy(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-sky-300 hover:bg-white/10 transition"><Copy size={15} /></button>
                  <button onClick={() => handleDelete(f.id)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showModal && (
        <AlertModal type={modalType} title={modalType === 'success' ? 'Sucesso' : 'Erro'} message={modalMessage} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default FilterListPage;
