import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGateway, BookmakerDTO, UpsertBookmakerDTO } from '@/gateways/api.gateway';
import { Store, Plus, RefreshCcw, Pencil, Trash2, X, Search, CheckCircle2, XCircle, ChevronRight, ChevronLeft, ImagePlus, Rocket } from 'lucide-react';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
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
  commissionPct: string;
  // NoDelay: liga a casa na aposta rápida + como o browser conecta nela.
  noDelayEnabled: boolean;
  noDelayPlatform: string;
  noDelayWssUrl: string;
  noDelayRogueUrl: string;
  noDelayOrigin: string;
  noDelaySiteId: string;
  noDelaySource: string;
  noDelayLanguage: string;
  // biahosted (Altenar)
  noDelayBffUrl: string;
  noDelayLoginDomain: string;
  noDelayOddsUrl: string;
  noDelayIntegration: string;
  noDelayBetUrl: string;
}
const emptyForm: BookmakerForm = {
  slug: '', name: '', logoUrl: '', color: '', url: '', cloneOf: '', sortOrder: '0', commissionPct: '',
  noDelayEnabled: false, noDelayPlatform: '', noDelayWssUrl: '', noDelayRogueUrl: '', noDelayOrigin: '', noDelaySiteId: '', noDelaySource: '', noDelayLanguage: '',
  noDelayBffUrl: '', noDelayLoginDomain: '', noDelayOddsUrl: '', noDelayIntegration: '', noDelayBetUrl: ''
};

// Famílias de login suportadas pelo NoDelay. Casas da mesma família falam o
// mesmo protocolo e só mudam o endpoint — por isso é uma lista, não campo livre.
const NODELAY_PLATFORMS = [
  { value: '', label: 'Nenhuma' },
  { value: 'swarm', label: 'WebSocket (swarm) — 7games, betão, 7k, apostatudo' },
  { value: 'biahosted', label: 'Altenar (biahosted) — estrelabet' }
];

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
    const nd = b.noDelayConfig || {};
    setForm({
      slug: b.slug, name: b.name, logoUrl: b.logoUrl || '', color: b.color || '', url: b.url || '', cloneOf: b.cloneOf || '',
      sortOrder: String(b.sortOrder ?? 0), commissionPct: b.commissionPct != null ? String(b.commissionPct) : '',
      noDelayEnabled: !!b.noDelayEnabled,
      noDelayPlatform: b.noDelayPlatform || '',
      noDelayWssUrl: nd.wssUrl || '',
      noDelayRogueUrl: nd.rogueUrl || '',
      noDelayOrigin: nd.origin || '',
      noDelaySiteId: nd.siteId || '',
      noDelaySource: nd.source != null ? String(nd.source) : '',
      noDelayLanguage: nd.language || '',
      noDelayBffUrl: nd.bffUrl || '',
      noDelayLoginDomain: nd.loginDomain || '',
      noDelayOddsUrl: nd.oddsUrl || '',
      noDelayIntegration: nd.integration || '',
      noDelayBetUrl: nd.betUrl || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      setMsg({ type: 'err', text: 'Slug e nome são obrigatórios.' });
      return;
    }
    setSaving(true);
    try {
      const comm = parseFloat(form.commissionPct.replace(',', '.'));
      const src = parseInt(form.noDelaySource, 10);
      const payload: UpsertBookmakerDTO = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || null,
        color: form.color.trim() || null,
        url: form.url.trim() || null,
        cloneOf: form.cloneOf.trim() || null,
        commissionPct: Number.isFinite(comm) ? comm : null,
        noDelayEnabled: form.noDelayEnabled,
        noDelayPlatform: form.noDelayPlatform || null,
        noDelayConfig: form.noDelayPlatform
          ? {
              wssUrl: form.noDelayWssUrl.trim() || null,
              rogueUrl: form.noDelayRogueUrl.trim() || null,
              origin: form.noDelayOrigin.trim() || null,
              siteId: form.noDelaySiteId.trim() || null,
              source: Number.isFinite(src) ? src : null,
              language: form.noDelayLanguage.trim() || null,
              bffUrl: form.noDelayBffUrl.trim() || null,
              loginDomain: form.noDelayLoginDomain.trim() || null,
              oddsUrl: form.noDelayOddsUrl.trim() || null,
              integration: form.noDelayIntegration.trim() || null,
              betUrl: form.noDelayBetUrl.trim() || null
            }
          : null,
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

  // Sobe a cadeia de clone até o ANCESTRAL top-level (a "mãe" raiz). É isto que
  // evita o clone-de-clone (neto) sumir: sem isto, um clone cuja mãe é OUTRO clone
  // ficava aninhado numa folha e nunca era renderizado (invisível e sem como
  // editar). Guarda contra ciclo. Mãe fora da lista → o próprio slug é a raiz.
  const rootOf = (slug: string): string => {
    let cur = slug;
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const parent = bySlug.get(cur)?.cloneOf;
      if (!parent || !bySlug.has(parent) || seen.has(cur)) break;
      seen.add(cur);
      cur = parent;
    }
    return cur;
  };

  // Agrupa: cada "mãe" top-level com TODOS os seus clones (qualquer profundidade)
  // achatados sob ela. Clone órfão (mãe não cadastrada) vira top-level p/ não sumir.
  const clonesByParent = new Map<string, BookmakerDTO[]>();
  const parents: BookmakerDTO[] = [];
  for (const b of items) {
    const isClone = !!(b.cloneOf && bySlug.has(b.cloneOf));
    const root = isClone ? rootOf(b.slug) : b.slug;
    if (isClone && root !== b.slug) {
      const arr = clonesByParent.get(root) || [];
      arr.push(b);
      clonesByParent.set(root, arr);
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
          {b.noDelayEnabled && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-500/15 px-1.5 py-0.5 text-[10px] font-medium text-lime-300 ring-1 ring-lime-500/30" title="Liberada no NoDelay">
              <Rocket size={9} /> NoDelay
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-gray-500 font-mono truncate">{b.slug}</span>
          <CommissionBadge pct={b.commissionPct} />
        </div>
        {/* "↳ clone de X": p/ clone órfão (mãe não cadastrada, top-level) OU clone-de-clone
            (neto achatado sob a raiz) — mostra a mãe REAL. Clone direto não precisa. */}
        {b.cloneOf && (!isClone || !!bySlug.get(b.cloneOf)?.cloneOf) && (
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
          {/* Altura travada + só o miolo rola: com a seção do NoDelay o form
              passou da tela e o "Salvar" ficava inalcançável. */}
          <div onPaste={handleLogoPaste} className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl relative shadow-2xl flex flex-col max-h-[90dvh]">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 z-10 text-gray-400 hover:text-rose-400"><X size={20} /></button>

            {/* Cabeçalho fixo */}
            <div className="shrink-0 px-6 pt-6 pb-4">
              <h2 className="text-lg font-bold text-white mb-4">{editing ? 'Editar casa' : 'Cadastrar casa'}</h2>
              <div className="flex items-center gap-3">
                <BookmakerLogo name={form.name} slug={form.slug} logoUrl={form.logoUrl || null} color={form.color || null} size={48} />
                <span className="font-bold" style={{ color: form.color || '#ffffff' }}>{form.name || 'Pré-visualização'}</span>
              </div>
            </div>

            {/* Miolo rolável */}
            <div className="flex-1 overflow-y-auto px-6 pb-1">
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
              {/* Comissão da casa (exchange) — entra automática na calculadora */}
              <label className="block text-xs text-gray-400">
                Comissão (%) <span className="text-gray-600">(exchange — ex.: Betfair)</span>
                <input value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} inputMode="decimal" className={`${inputClass} mt-1`} placeholder="ex.: 6.5" />
                <span className="mt-1 block text-[11px] text-gray-500">Preenche a comissão automaticamente na calculadora (incide sobre o lucro). Deixe vazio para casas comuns.</span>
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

              {/* ---- NoDelay ---- */}
              <div className="rounded-xl border border-lime-500/20 bg-lime-500/[0.04] p-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-lime-200">
                      <Rocket size={14} /> NoDelay
                    </span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      Libera esta casa na aposta rápida (nível 3). O login roda no navegador do usuário.
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, noDelayEnabled: !form.noDelayEnabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${form.noDelayEnabled ? 'bg-lime-500' : 'bg-white/15'}`}
                    title={form.noDelayEnabled ? 'Desativar NoDelay' : 'Ativar NoDelay'}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.noDelayEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </label>

                {form.noDelayEnabled && (
                  <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                    <div className="block text-xs text-gray-400">
                      Plataforma de login
                      <Select
                        className="mt-1"
                        value={form.noDelayPlatform}
                        onChange={(v) => setForm({ ...form, noDelayPlatform: v })}
                        options={NODELAY_PLATFORMS}
                      />
                    </div>

                    {form.noDelayPlatform === 'swarm' && (
                      <>
                        <label className="block text-xs text-gray-400">
                          Endereço do WebSocket <span className="text-gray-600">(conta/login)</span>
                          <input value={form.noDelayWssUrl} onChange={(e) => setForm({ ...form, noDelayWssUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="wss://swarm.7games.bet.br/" />
                        </label>
                        <label className="block text-xs text-gray-400">
                          Host da rogue/FSB <span className="text-gray-600">(odds + place)</span>
                          <input value={form.noDelayRogueUrl} onChange={(e) => setForm({ ...form, noDelayRogueUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://prod20563.fssb.io" />
                          <span className="mt-1 block text-[11px] text-gray-500">É POR CASA (7games=prod20563, betão=prod20562). E o <b>Origin</b> abaixo = operador (ex.: https://betao.bet.br) — dele sai o token.</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs text-gray-400">
                            site_id <span className="text-gray-600">(obrigatório)</span>
                            <input value={form.noDelaySiteId} onChange={(e) => setForm({ ...form, noDelaySiteId: e.target.value })} inputMode="numeric" className={`${inputClass} mt-1 font-mono`} placeholder="ex.: 18751367" />
                          </label>
                          <label className="text-xs text-gray-400">
                            source <span className="text-gray-600">(padrão 42)</span>
                            <input value={form.noDelaySource} onChange={(e) => setForm({ ...form, noDelaySource: e.target.value })} inputMode="numeric" className={`${inputClass} mt-1 font-mono`} placeholder="42" />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs text-gray-400">
                            Idioma <span className="text-gray-600">(padrão pt-br)</span>
                            <input value={form.noDelayLanguage} onChange={(e) => setForm({ ...form, noDelayLanguage: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="pt-br" />
                          </label>
                          <label className="text-xs text-gray-400">
                            Origin <span className="text-gray-600">(informativo)</span>
                            <input value={form.noDelayOrigin} onChange={(e) => setForm({ ...form, noDelayOrigin: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://7games.bet.br" />
                          </label>
                        </div>
                      </>
                    )}

                    {form.noDelayPlatform === 'biahosted' && (
                      <>
                        <label className="block text-xs text-gray-400">
                          BFF de login <span className="text-gray-600">(POR CASA — o login varia)</span>
                          <input value={form.noDelayBffUrl} onChange={(e) => setForm({ ...form, noDelayBffUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://bff-estrelabet.estrelabet.bet.br" />
                          <span className="mt-1 block text-[11px] text-gray-500">POST <code>{'{bff}/login'}</code> com Origin abaixo → devolve o token (JWT ~1h). Cada casa biahosted loga diferente.</span>
                        </label>
                        <label className="block text-xs text-gray-400">
                          Host de odds Altenar <span className="text-gray-600">(odds)</span>
                          <input value={form.noDelayOddsUrl} onChange={(e) => setForm({ ...form, noDelayOddsUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://sb2frontend-altenar2.biahosted.com" />
                          <span className="mt-1 block text-[11px] text-gray-500">Comum às casas biahosted; consome com Origin + token do login.</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs text-gray-400">
                            integration <span className="text-gray-600">(place — por casa)</span>
                            <input value={form.noDelayIntegration} onChange={(e) => setForm({ ...form, noDelayIntegration: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="estrelabet" />
                          </label>
                          <label className="text-xs text-gray-400">
                            Gateway de apostas <span className="text-gray-600">(vazio = auto)</span>
                            <input value={form.noDelayBetUrl} onChange={(e) => setForm({ ...form, noDelayBetUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://sb2betgateway-altenar2.biahosted.com" />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs text-gray-400">
                            domain <span className="text-gray-600">(corpo do login)</span>
                            <input value={form.noDelayLoginDomain} onChange={(e) => setForm({ ...form, noDelayLoginDomain: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="www.estrelabet.bet.br" />
                          </label>
                          <label className="text-xs text-gray-400">
                            Origin <span className="text-gray-600">(obrigatório)</span>
                            <input value={form.noDelayOrigin} onChange={(e) => setForm({ ...form, noDelayOrigin: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://www.estrelabet.bet.br" />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Rodapé fixo — o Salvar nunca sai da tela */}
            <div className="shrink-0 flex justify-end gap-2 border-t border-white/10 px-6 py-4">
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
