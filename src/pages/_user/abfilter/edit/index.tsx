'use client';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import FloatingInput from '@/components/ui/FloatingInput';
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';
import { CreateOrUpdateFilterDTO } from '@/interfaces';
import AlertModal from "@/components/modals/AlertModal";

interface FilterForm {
  name: string;
  arbMin: string;
  arbMax: string;
  ageMin: string;
  ageMax: string;
  oddsMin: string;
  oddsMax: string;
  roiMin: string;
  roiMax: string;
}

const FilterFormPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const isEdit = id && id !== 'new';
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [showModal, setShowModal] = useState(false);

  const handleCloseModal = () => {
    setShowModal(false);
    setModalMessage('');
  };

  const [isLoading, setIsLoading] = useState<boolean>(!!isEdit);
  const [formData, setFormData] = useState<FilterForm>({
    name: '',
    arbMin: '',
    arbMax: '',
    ageMin: '',
    ageMax: '',
    oddsMin: '',
    oddsMax: '',
    roiMin: '',
    roiMax: '',
  });

  useEffect(() => {
    if (!isEdit) return;

    const loadFilter = async () => {
      try {
        setIsLoading(true);
        const response = await apiGateway.getFilterById(id as string);
        const filter = response.data.data;
        setFormData({
          name: filter.name || '',
          arbMin: String(filter.profitMin ?? ''),
          arbMax: String(filter.profitMax ?? ''),
          ageMin: String(filter.ageMin ?? ''),
          ageMax: String(filter.ageMax ?? ''),
          oddsMin: '', // ajustar se estiver na API
          oddsMax: '',
          roiMin: String(filter.roiMin ?? ''),
          roiMax: String(filter.roiMax ?? '')
        });
      } catch (err) {
        console.error('Erro ao carregar filtro:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFilter();
  }, [id, isEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    setIsLoading(true);
    e.preventDefault();
  
    const payload: CreateOrUpdateFilterDTO = {
      name: formData.name,
      profitMin: parseFloat(formData.arbMin) || 0,
      profitMax: parseFloat(formData.arbMax) || 0,
      ageMin: parseInt(formData.ageMin) || 0,
      ageMax: parseInt(formData.ageMax) || 0,
      roiMin: parseFloat(formData.roiMin) || 0,
      roiMax: parseFloat(formData.roiMax) || 0,
      sortBy: 'profit', // ← agora é reconhecido corretamente como literal
      sortDirection: 'desc',
      outcomes: [2, 3],
      bookmakers: [],
      sports: [],
      tournaments: [],
      requiredBookmakers: [],
      duration: 7
    };
  
    try {
      let response;
      if (isEdit) {
        response = await apiGateway.updateFilter(id as string, payload);
      } else {
        response = await apiGateway.createFilter(payload);
      }

      setModalType('success');
      setModalMessage(response.data.message || 'Operação realizada com sucesso.');
      setShowModal(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setModalType('error');
      setModalMessage(err.response?.data?.message || 'Erro ao salvar filtro.');
      setShowModal(true);
    } finally { 
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.replace(
      {
        pathname: router.pathname,
        query: {
          modal: 'user',
          page: 'abfilter',
        },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-1 space-y-8 text-white">
      <div className="flex items-center gap-2">
        <button onClick={handleCancel} className="px-3 py-3 bg-[#1a2c2e] hover:bg-[#1e3a38] text-white text-sm rounded-lg flex items-center">
          <ChevronLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Editar Filtro' : 'Novo Filtro'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
        <FloatingInput
            label="Filter Name"
            name="name"
            autoComplete="off"
            value={formData.name}
            onChange={handleChange}
          />
        </div>

        {[
          ['Percentual de Lucro', 'arbMin', 'arbMax'],
          ['Idade da Arbitragem', 'ageMin', 'ageMax'],
          ['Odds', 'oddsMin', 'oddsMax'],
          ['ROI (Retorno Sobre Investimento)', 'roiMin', 'roiMax'],
          ].map(([label, min, max]) => (
            <div key={label}>
              <label className="text-sm font-semibold block">{label}</label>
              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label="Min"
                  name={min}
                  autoComplete="off"
                  value={formData[min as keyof FilterForm]}
                  onChange={handleChange}
                />
                <FloatingInput
                  label="Max"
                  name={max}
                  autoComplete="off"
                  value={formData[max as keyof FilterForm]}
                  onChange={handleChange}
                />
              </div>
            </div>
          ))}

          

        <div className="flex justify-end">
          {isLoading ? (
            <div className="w-full flex justify-center">
              <SportsCryptoLoading />
            </div>
          ) : (
          <button type="submit" className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-md text-white">
            Salvar
          </button>
          )}
        </div>
      </form>
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

export default FilterFormPage;