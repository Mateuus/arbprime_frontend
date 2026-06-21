import { useState, useEffect, useCallback } from 'react';
import { apiGateway, BookmakerDTO, UpsertBookmakerDTO } from '@/gateways/api.gateway';
import { Store, Plus, RefreshCcw, Pencil, Trash2, X, Search, CheckCircle2, XCircle } from 'lucide-react';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { Select } from '@/components/ui/Select';

// Slugs que o arbbetting_master fornece (atalho ao cadastrar).
const KNOWN_SLUGS = [
  'marjosports', 'betano', 'pinnacle', 'superbet', 'brbet', 'mrjack', 'estrelabet',
  'betbra', 'betmgm', 'bet7k', 'pixbet', 'betfair', 'aev', 'palpitecerto',
  'betao', 'seubet', 'stake', 'betpix365', 'vaidebet'
];

interface BookmakerForm {
  slug: string;
  name: string;
  logoUrl: string;
  color: string;
  url: string;
  cloneOf: string;
  sortOrder: string;
}
const emptyForm: BookmakerForm = { slug: '', name: '', logoUrl: '', color: '', url: '', cloneOf: '', sortOrder: '0' };

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const AdminBookmakersPage = () => {
  const [items, setItems] = useState<BookmakerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BookmakerDTO | null>(null);
  const [form, setForm] = useState<BookmakerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getBookmakers();
      if (res.data?.result === 1) setItems(res.data.data || []);
      else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar casas.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar casas.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (b: BookmakerDTO) => {
    setEditing(b);
    setForm({ slug: b.slug, name: b.name, logoUrl: b.logoUrl || '', color: b.color || '', url: b.url || '', cloneOf: b.cloneOf || '', sortOrder: String(b.sortOrder ?? 0) });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      setMsg({ type: 'err', text: 'Slug e nome são obrigatórios.' });
      return;
    }
    setSaving(true);
    try {
      const payload: UpsertBookmakerDTO = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || null,
        color: form.color.trim() || null,
        url: form.url.trim() || null,
        cloneOf: form.cloneOf.trim() || null,
        sortOrder: Number(form.sortOrder) || 0
      };
      if (editing) {
        await apiGateway.updateBookmaker(editing.id, payload);
        setMsg({ type: 'ok', text: 'Casa atualizada.' });
      } else {
        await apiGateway.addBookmaker(payload);
        setMsg({ type: 'ok', text: 'Casa cadastrada.' });
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar casa.') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (b: BookmakerDTO) => {
    try {
      await apiGateway.toggleBookmaker(b.id, !b.isActive);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao alterar status.') });
    }
  };

  const handleDelete = async (b: BookmakerDTO) => {
    if (!window.confirm(`Remover a casa ${b.name} (${b.slug})?`)) return;
    try {
      await apiGateway.deleteBookmaker(b.id);
      setMsg({ type: 'ok', text: 'Casa removida.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover casa.') });
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((b) => [b.slug, b.name].some((v) => (v || '').toLowerCase().includes(q))) : items;
  const activeCount = items.filter((b) => b.isActive).length;

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Store className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Bookmakers</h1>
            <p className="text-sm text-gray-400">Cadastre as casas de aposta (slug, ícone, cor)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition">
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </header>

      {/* Resumo + busca */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por slug ou nome..." className={`${inputClass} pl-9`} />
        </div>
        <div className="text-xs text-gray-400">{activeCount}/{items.length} ativas</div>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Store className="mx-auto text-gray-600 mb-3" size={32} />
            <p className="text-gray-400">{q ? 'Nenhuma casa encontrada.' : 'Nenhuma casa cadastrada ainda.'}</p>
            {!q && (
              <button onClick={openAdd} className="mt-3 inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200">
                <Plus size={15} /> Cadastrar a primeira
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition">
                <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate" style={{ color: b.color || '#ffffff' }}>{b.name}</div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">{b.slug}</div>
                  {b.cloneOf && (
                    <div className="text-[10px] text-violet-300/80 truncate">↳ clone de {items.find((x) => x.slug === b.cloneOf)?.name || b.cloneOf}</div>
                  )}
                </div>
                {b.color && <span className="hidden sm:inline-block h-4 w-4 rounded ring-1 ring-white/10" style={{ background: b.color }} title={b.color} />}
                <div className="shrink-0">
                  {b.isActive
                    ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"><CheckCircle2 size={12} /> Ativa</span>
                    : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/5 text-gray-400 ring-1 ring-white/10"><XCircle size={12} /> Inativa</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(b)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${b.isActive ? 'bg-emerald-500' : 'bg-white/15'}`} title={b.isActive ? 'Desativar' : 'Ativar'}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${b.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <button onClick={() => openEdit(b)} className="p-2 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(b)} className="p-2 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal Adicionar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-5">{editing ? 'Editar casa' : 'Cadastrar casa'}</h2>

            <div className="flex items-center gap-3 mb-4">
              <BookmakerLogo name={form.name} slug={form.slug} logoUrl={form.logoUrl || null} color={form.color || null} size={48} />
              <span className="font-bold" style={{ color: form.color || '#ffffff' }}>{form.name || 'Pré-visualização'}</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-400">
                  Slug <span className="text-gray-600">(arbbetting)</span>
                  <input list="known-slugs" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="pinnacle" />
                  <datalist id="known-slugs">{KNOWN_SLUGS.map((s) => <option key={s} value={s} />)}</datalist>
                </label>
                <label className="text-xs text-gray-400">
                  Nome
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputClass} mt-1`} placeholder="Pinnacle" />
                </label>
              </div>
              <label className="block text-xs text-gray-400">
                Logo (URL)
                <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className={`${inputClass} mt-1`} placeholder="https://.../pinnacle.png" />
              </label>
              <div className={`grid ${editing ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                <label className="text-xs text-gray-400">
                  Cor
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.color || '#5eead4'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-10 rounded bg-black/30 border border-white/10" />
                    <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={`${inputClass} font-mono`} placeholder="#5eead4" />
                  </div>
                </label>
                {/* Ordem só no editar (no cadastro é automática). Trocar a ordem troca com a casa que já a usa. */}
                {editing && (
                  <label className="text-xs text-gray-400">
                    Ordem
                    <input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={`${inputClass} mt-1`} placeholder="0" />
                  </label>
                )}
              </div>
              <label className="block text-xs text-gray-400">
                Site (opcional)
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={`${inputClass} mt-1`} placeholder="https://pinnacle.com" />
              </label>
              {/* Clone de outra casa (opcional) */}
              <div className="block text-xs text-gray-400">
                Clone de <span className="text-gray-600">(opcional — se for clone de outra casa)</span>
                <Select
                  className="mt-1"
                  value={form.cloneOf}
                  onChange={(v) => setForm({ ...form, cloneOf: v })}
                  options={[
                    { value: '', label: 'Não é clone' },
                    ...items
                      .filter((b) => b.slug !== form.slug.trim())
                      .map((b) => ({ value: b.slug, label: b.name, color: b.color || undefined }))
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookmakersPage;
