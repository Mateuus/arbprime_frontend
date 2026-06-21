'use client';
import { ChevronLeft, Check, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState, ReactNode } from 'react';
import { apiGateway } from '@/gateways/api.gateway';
import FloatingInput from '@/components/ui/FloatingInput';
import SportsCryptoLoading from '@/components/loaders/SportsCryptoLoading';
import { CreateOrUpdateFilterDTO } from '@/interfaces';
import AlertModal from '@/components/modals/AlertModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';

// Label com ícone [?] e tooltip explicativo.
const FieldLabel = ({ children, help }: { children: ReactNode; help: ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <span className="text-sm font-semibold">{children}</span>
    <Tooltip label={help}>
      <HelpCircle size={13} className="text-gray-500 hover:text-teal-300 cursor-help" />
    </Tooltip>
  </span>
);

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
  stake: string;
}

// Padrão inicial ao criar um novo filtro (o usuário edita).
const DEFAULT_FORM: FilterForm = {
  name: '', arbMin: '1', arbMax: '', ageMin: '', ageMax: '',
  oddsMin: '1.5', oddsMax: '', roiMin: '', roiMax: '', stake: '1000'
};

const FilterFormPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const isEdit = id && id !== 'new';

  const { bookmakers: registry } = useBookmakers();

  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [showModal, setShowModal] = useState(false);
  const handleCloseModal = () => { setShowModal(false); setModalMessage(''); };

  const [isLoading, setIsLoading] = useState<boolean>(!!isEdit);
  const [formData, setFormData] = useState<FilterForm>(DEFAULT_FORM);
  const [selected, setSelected] = useState<string[]>([]);
  // Marca que já inicializamos as casas (para não re-selecionar todas após o usuário mexer).
  const [housesInit, setHousesInit] = useState(false);

  // Edição: carrega o filtro.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
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
          oddsMin: filter.oddsMin != null ? String(filter.oddsMin) : '',
          oddsMax: filter.oddsMax != null ? String(filter.oddsMax) : '',
          roiMin: String(filter.roiMin ?? ''),
          roiMax: String(filter.roiMax ?? ''),
          stake: filter.stake != null ? String(filter.stake) : ''
        });
        setSelected(Array.isArray(filter.bookmakers) ? filter.bookmakers : []);
        setHousesInit(true);
      } catch (err) {
        console.error('Erro ao carregar filtro:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, isEdit]);

  // Novo filtro: pré-seleciona todas as casas do registro (padrão inicial).
  useEffect(() => {
    if (isEdit || housesInit || registry.length === 0) return;
    setSelected(registry.map((b) => b.slug));
    setHousesInit(true);
  }, [registry, isEdit, housesInit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleHouse = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  const allSelected = registry.length > 0 && selected.length === registry.length;
  const toggleAll = () => setSelected(allSelected ? [] : registry.map((b) => b.slug));

  // Aceita número (inclusive negativo) ou vazio.
  const numOrNull = (v: string): number | null => {
    const t = (v ?? '').trim();
    if (t === '') return null;
    const n = parseFloat(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const payload: CreateOrUpdateFilterDTO = {
      name: formData.name,
      profitMin: numOrNull(formData.arbMin) ?? 0,
      profitMax: numOrNull(formData.arbMax) ?? 0,
      ageMin: numOrNull(formData.ageMin) ?? 0,
      ageMax: numOrNull(formData.ageMax) ?? 0,
      oddsMin: numOrNull(formData.oddsMin) ?? 0,   // pode ser negativa
      oddsMax: numOrNull(formData.oddsMax) ?? 0,
      stake: numOrNull(formData.stake) ?? 0,
      roiMin: numOrNull(formData.roiMin) ?? 0,
      roiMax: numOrNull(formData.roiMax) ?? 0,
      sortBy: 'profit',
      sortDirection: 'desc',
      outcomes: [2, 3],
      bookmakers: selected,
      sports: [],
      tournaments: [],
      requiredBookmakers: [],
      duration: 7
    };

    try {
      const response = isEdit
        ? await apiGateway.updateFilter(id as string, payload)
        : await apiGateway.createFilter(payload);
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
    router.replace({ pathname: router.pathname, query: { modal: 'user', page: 'abfilter' } }, undefined, { shallow: true });
  };

  // Faixas numéricas com texto de ajuda (tooltip).
  const ranges: { label: string; min: keyof FilterForm; max: keyof FilterForm; hint?: string; help: ReactNode }[] = [
    {
      label: 'Percentual de Lucro (%)', min: 'arbMin', max: 'arbMax',
      help: (
        <span>Faixa de lucro % das surebets exibidas.<br />
          A <b>mínima pode ser NEGATIVA</b>: ex. <b>-2</b> mostra também as “quase-surebets” (até 2% de prejuízo),
          úteis porque a odd pode se mover e virar positiva. Deixe Max vazio para “sem teto”.
        </span>
      )
    },
    {
      label: 'Idade da Arbitragem (segundos)', min: 'ageMin', max: 'ageMax', hint: 'Tempo que a arbitragem fica disponível',
      help: <span>Há quanto tempo a surebet está ativa (em segundos). Min mostra só as mais “maduras”; Max esconde as muito antigas.</span>
    },
    {
      label: 'Odds', min: 'oddsMin', max: 'oddsMax', hint: 'A mínima pode ser negativa',
      help: <span>Faixa das odds das pernas. A <b>mínima pode ser negativa</b> (odds de lay/americanas). Use para evitar odds muito baixas/altas.</span>
    },
    {
      label: 'ROI (Retorno Sobre Investimento)', min: 'roiMin', max: 'roiMax',
      help: <span>Retorno sobre o valor investido. Parecido com o lucro %, porém sobre o capital efetivamente alocado.</span>
    }
  ];

  const inputBg = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

  return (
    <div className="max-w-3xl mx-auto p-1 sm:p-2 text-white">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={handleCancel} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold">{isEdit ? 'Editar filtro' : 'Novo filtro'}</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><SportsCryptoLoading /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <FloatingInput label="Nome do filtro" name="name" autoComplete="off" value={formData.name} onChange={handleChange} />

          {/* Stake */}
          <div>
            <div className="mb-1"><FieldLabel help="Valor base de aposta usado nos cálculos de stake/lucro deste filtro.">Valor da aposta (stake, R$)</FieldLabel></div>
            <input name="stake" value={formData.stake} onChange={handleChange} inputMode="decimal" placeholder="1000" className={inputBg} />
          </div>

          {/* Faixas */}
          {ranges.map(({ label, min, max, hint, help }) => (
            <div key={label}>
              <FieldLabel help={help}>{label}</FieldLabel>
              {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <input name={min} value={formData[min]} onChange={handleChange} inputMode="decimal" placeholder={min === 'arbMin' ? 'Min (ex.: -2)' : 'Min'} className={inputBg} />
                <input name={max} value={formData[max]} onChange={handleChange} inputMode="decimal" placeholder="Max" className={inputBg} />
              </div>
            </div>
          ))}

          {/* Casas de aposta (do registro) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel help="Só serão consideradas surebets cujas pernas estão nas casas selecionadas. As casas vêm do cadastro (Configurações → Bookmakers).">
                Casas de aposta <span className="text-gray-500 font-normal">({selected.length}/{registry.length})</span>
              </FieldLabel>
              <button type="button" onClick={toggleAll} className="text-xs text-teal-300 hover:text-teal-200">
                {allSelected ? 'Limpar' : 'Selecionar todas'}
              </button>
            </div>
            {registry.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhuma casa cadastrada. Cadastre em Configurações → Bookmakers.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {registry.map((b) => {
                  const on = selected.includes(b.slug);
                  return (
                    <button
                      type="button"
                      key={b.slug}
                      onClick={() => toggleHouse(b.slug)}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ring-1 transition text-left ${on ? 'bg-teal-500/15 ring-teal-500/40' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
                    >
                      <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={18} />
                      <span className="text-sm truncate flex-1" style={{ color: b.color || undefined }}>{b.name}</span>
                      {on && <Check size={14} className="text-teal-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-teal-500 hover:bg-teal-400 px-6 py-2 rounded-lg text-slate-900 font-semibold">Salvar</button>
          </div>
        </form>
      )}

      {showModal && (
        <AlertModal type={modalType} title={modalType === 'success' ? 'Sucesso' : 'Erro'} message={modalMessage} onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default FilterFormPage;
