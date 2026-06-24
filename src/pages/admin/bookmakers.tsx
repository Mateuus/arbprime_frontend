import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGateway, BookmakerDTO, UpsertBookmakerDTO } from '@/gateways/api.gateway';
import { Store, Plus, RefreshCcw, Pencil, Trash2, X, Search, CheckCircle2, XCircle, ChevronRight, ChevronLeft, ImagePlus } from 'lucide-react';
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

  // Paginação + sublistas de clones
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // 0 = Todas
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Upload/colagem do logo no modal
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

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

  // Redimensiona a imagem no navegador e devolve um data URL leve (webp c/ fallback png).
  const processImage = (file: File | Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = document.createElement('img');
        img.onerror = () => reject(new Error('decode'));
        img.onload = () => {
          const MAX = 128;
          let width = img.width;
          let height = img.height;
          if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
          else if (height >= width && height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const webp = canvas.toDataURL('image/webp', 0.9);
          resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleLogoFile = async (file?: File | Blob | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg({ type: 'err', text: 'O arquivo não é uma imagem.' }); return; }
    try {
      const dataUrl = await processImage(file);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch {
      setMsg({ type: 'err', text: 'Não foi possível processar a imagem.' });
    }
  };

  // Cola (Ctrl+V) de um printscreen: usa só itens de imagem, deixa texto seguir p/ os inputs.
  const handleLogoPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) { e.preventDefault(); handleLogoFile(file); return; }
      }
    }
  };

  const q = query.trim().toLowerCase();
  const matchesQuery = (b: BookmakerDTO) => !q || [b.slug, b.name].some((v) => (v || '').toLowerCase().includes(q));
  const activeCount = items.filter((b) => b.isActive).length;

  // Mapa slug -> casa (para resolver clones cuja "mãe" existe na lista).
  const bySlug = new Map(items.map((b) => [b.slug, b]));

  // Agrupa as casas: cada "mãe" (top-level) com seus clones aninhados.
  // Clone órfão (cloneOf aponta p/ slug inexistente) vira top-level p/ não sumir.
  const clonesByParent = new Map<string, BookmakerDTO[]>();
  const parents: BookmakerDTO[] = [];
  for (const b of items) {
    const parentSlug = b.cloneOf && bySlug.has(b.cloneOf) ? b.cloneOf : null;
    if (parentSlug) {
      const arr = clonesByParent.get(parentSlug) || [];
      arr.push(b);
      clonesByParent.set(parentSlug, arr);
    } else {
      parents.push(b);
    }
  }

  // Grupos visíveis na busca: mãe casa OU algum clone casa.
  const groups = parents
    .map((parent) => ({ parent, clones: clonesByParent.get(parent.slug) || [] }))
    .filter(({ parent, clones }) => matchesQuery(parent) || clones.some(matchesQuery));

  // Paginação (sobre as casas-mãe; clones aninhados não contam como linha).
  const totalGroups = groups.length;
  const perPage = pageSize === 0 ? (totalGroups || 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalGroups / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageGroups = groups.slice((safePage - 1) * perPage, safePage * perPage);
  const rangeStart = totalGroups === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = Math.min(safePage * perPage, totalGroups);

  const toggleExpand = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  // Conteúdo compartilhado da linha (logo + nome + status + ações).
  const renderMain = (b: BookmakerDTO, isClone: boolean, cloneCount?: number) => (
    <>
      <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={isClone ? 30 : 36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold truncate ${isClone ? 'text-sm' : ''}`} style={{ color: b.color || '#ffffff' }}>{b.name}</span>
          {!!cloneCount && (
            <span className="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
              {cloneCount} {cloneCount === 1 ? 'clone' : 'clones'}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 font-mono truncate">{b.slug}</div>
        {/* Linha do clone já fica aninhada na mãe; "clone de X" só p/ clone órfão (mãe não cadastrada). */}
        {!isClone && b.cloneOf && (
          <div className="text-[10px] text-violet-300/80 truncate">↳ clone de {b.cloneOf}</div>
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
    </>
  );

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
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar por slug ou nome..." className={`${inputClass} pl-9`} />
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
        ) : totalGroups === 0 ? (
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
            {pageGroups.map(({ parent, clones }) => {
              const hasClones = clones.length > 0;
              const open = hasClones && (!!q || expanded.has(parent.slug));
              // Na busca, se a mãe não casa, mostra só os clones que casam.
              const visibleClones = (!q || matchesQuery(parent)) ? clones : clones.filter(matchesQuery);
              return (
                <li key={parent.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition">
                    {hasClones ? (
                      <button onClick={() => toggleExpand(parent.slug)} className="grid place-items-center h-6 w-6 shrink-0 rounded text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title={open ? 'Recolher' : 'Expandir'}>
                        <ChevronRight size={16} className={`transition ${open ? 'rotate-90' : ''}`} />
                      </button>
                    ) : (
                      <span className="w-6 shrink-0" />
                    )}
                    {renderMain(parent, false, clones.length)}
                  </div>
                  {hasClones && open && (
                    <ul className="bg-black/20 border-t border-white/5">
                      {visibleClones.map((c) => (
                        <li key={c.id} className="ml-6 flex items-center gap-3 border-l-2 border-violet-500/30 py-2.5 pl-6 pr-4 hover:bg-white/[0.04] transition">
                          {renderMain(c, true)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalGroups > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Mostrar</span>
            <Select
              className="w-24"
              value={String(pageSize)}
              onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
              options={[
                { value: '10', label: '10' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '0', label: 'Todas' }
              ]}
            />
            <span>por página</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="tabular-nums">{rangeStart}–{rangeEnd} de {totalGroups}</span>
            <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className="grid place-items-center h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition" title="Anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="tabular-nums">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} className="grid place-items-center h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition" title="Próxima">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Adicionar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div onPaste={handleLogoPaste} className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl">
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
              {/* Logo: upload / arrastar / colar (Ctrl+V) ou URL */}
              <div className="block text-xs text-gray-400">
                Logo
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleLogoFile(e.dataTransfer.files?.[0]); }}
                  className={`mt-1 flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 cursor-pointer transition ${dragOver ? 'border-teal-500/60 bg-teal-500/10' : 'border-white/15 bg-black/20 hover:border-white/25'}`}
                >
                  {form.logoUrl
                    ? <BookmakerLogo name={form.name} slug={form.slug} logoUrl={form.logoUrl} color={form.color || null} size={40} />
                    : <span className="grid place-items-center h-10 w-10 shrink-0 rounded bg-white/5 text-gray-500"><ImagePlus size={18} /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="text-gray-300">Clique, arraste ou cole (Ctrl+V) uma imagem</div>
                    <div className="text-[11px] text-gray-500">{form.logoUrl.startsWith('data:') ? 'Imagem enviada — redimensionada automaticamente' : 'PNG, JPG ou WebP'}</div>
                  </div>
                  {form.logoUrl && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, logoUrl: '' })); }} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10" title="Remover logo">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handleLogoFile(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <label className="block text-xs text-gray-400">
                ou cole uma URL
                <input value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className={`${inputClass} mt-1`} placeholder="https://.../pinnacle.png" />
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
