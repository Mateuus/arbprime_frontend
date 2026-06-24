import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGateway, MarketNameDTO, BookmakerDTO } from '@/gateways/api.gateway';
import { MARKET_NAMES } from '@/utils/marketCatalog';
import { marketLabel } from '@/utils/surebet';
import { Select, SelectOption } from '@/components/ui/Select';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import {
  Tags, Plus, RefreshCcw, Pencil, Trash2, X, Search, Store, Globe,
  ChevronDown, ChevronRight, Loader2, Layers, Check
} from 'lucide-react';

// Catálogo canônico (slug -> nome PT), 1 entrada por slug, para o seletor de mercado.
const MARKET_OPTIONS = (() => {
  const seen = new Map<string, string>();
  for (const [key, name] of Object.entries(MARKET_NAMES)) {
    const slug = key.split(':')[0];
    if (!seen.has(slug)) seen.set(slug, name);
  }
  return Array.from(seen, ([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label));
})();

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const SourcePill = ({ source }: { source: string }) => {
  const map: Record<string, { tone: string; label: string }> = {
    manual: { tone: 'bg-teal-500/15 text-teal-300 ring-teal-500/30', label: 'manual' },
    feed: { tone: 'bg-violet-500/15 text-violet-300 ring-violet-500/30', label: 'feed' },
    seed: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'seed' }
  };
  const s = map[source] || map.seed;
  return <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${s.tone}`}>{s.label}</span>;
};

interface AddForm { marketId: string; houses: string[]; displayName: string; lockMarket: boolean }
const emptyAdd: AddForm = { marketId: '', houses: [], displayName: '', lockMarket: false };

// Seletor de mercado COM BUSCA (são ~150 mercados — achar na mão é ruim).
const MarketPicker = ({ value, onChange }: { value: string; onChange: (slug: string) => void }) => {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = ql
    ? MARKET_OPTIONS.filter((m) => m.label.toLowerCase().includes(ql) || m.slug.toLowerCase().includes(ql))
    : MARKET_OPTIONS;
  return (
    <div>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar mercado por nome ou slug..."
          className={`${inputClass} pl-8`}
        />
      </div>
      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
        {list.length === 0 ? (
          <div className="px-3 py-3 text-xs text-gray-500">Nenhum mercado encontrado.</div>
        ) : (
          list.slice(0, 200).map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => onChange(m.slug)}
              className={`flex items-center justify-between gap-2 w-full text-left px-3 py-1.5 text-sm transition ${
                m.slug === value ? 'bg-teal-500/15 text-teal-200' : 'text-gray-200 hover:bg-white/10'
              }`}
            >
              <span className="truncate">{m.label}</span>
              <span className="text-[10px] text-gray-500 font-mono shrink-0">{m.slug}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// Multi-seleção de casas (pills com BookmakerTag) — associa o mesmo nome a 2+ casas.
const HouseMultiSelect = ({
  bookmakers, value, onChange
}: { bookmakers: BookmakerDTO[]; value: string[]; onChange: (v: string[]) => void }) => {
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] ring-1 transition ${on ? 'bg-teal-500/20 ring-teal-500/50' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
        <button type="button" onClick={() => toggle('')} className={pill(value.includes(''))}>
          <Globe size={13} className="text-violet-300" /> <span className="text-gray-200">Global</span>
          {value.includes('') && <Check size={12} className="text-teal-300" />}
        </button>
        {bookmakers.map((b) => {
          const on = value.includes(b.slug);
          return (
            <button key={b.id} type="button" onClick={() => toggle(b.slug)} className={pill(on)}>
              <BookmakerTag slug={b.slug} size={14} nameClassName="text-[11px]" />
              {on && <Check size={12} className="text-teal-300 shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {value.length === 0
          ? 'Selecione uma ou mais casas (ou Global).'
          : `${value.length} casa(s) — o mesmo nome será salvo em todas.`}
      </p>
    </div>
  );
};

const AdminMarketsPage = () => {
  const [rows, setRows] = useState<MarketNameDTO[]>([]);
  const [bookmakers, setBookmakers] = useState<BookmakerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAdd);
  const [saving, setSaving] = useState(false);

  const [editRow, setEditRow] = useState<MarketNameDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editBookmaker, setEditBookmaker] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, bRes] = await Promise.all([apiGateway.getMarketNames(), apiGateway.getBookmakers()]);
      if (mRes.data?.result === 1) setRows(mRes.data.data || []);
      else setMsg({ type: 'err', text: mRes.data?.message || 'Erro ao carregar nomes de mercado.' });
      if (bRes.data?.result === 1) setBookmakers((bRes.data.data || []).filter((b: BookmakerDTO) => b.isActive));
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar nomes de mercado.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const bookmakerName = (slug: string) => (slug === '' ? 'Global' : bookmakers.find((b) => b.slug === slug)?.name || slug);

  // Opções da casa p/ o Select (edição): Global + cada casa com BookmakerTag.
  const houseOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Global (todas as casas)', node: <span className="inline-flex items-center gap-1.5 text-violet-300"><Globe size={15} /> Global (todas as casas)</span> },
      ...bookmakers.map((b) => ({ value: b.slug, label: b.name, node: <BookmakerTag slug={b.slug} size={16} nameClassName="text-sm" /> }))
    ],
    [bookmakers]
  );

  // Filtro client-side (nome traduzido, slug, displayName ou casa).
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) =>
        [marketLabel(r.marketId), r.marketId, r.displayName, r.bookmaker, bookmakerName(r.bookmaker)]
          .some((v) => (v || '').toLowerCase().includes(q))
      )
    : rows;

  // Agrupa por mercado canônico (marketId), ordenado pelo nome traduzido.
  const groups = useMemo(() => {
    const map = new Map<string, MarketNameDTO[]>();
    for (const r of filtered) {
      if (!map.has(r.marketId)) map.set(r.marketId, []);
      map.get(r.marketId)!.push(r);
    }
    return Array.from(map, ([marketId, list]) => ({
      marketId,
      rows: list.sort((a, b) => (a.bookmaker === '' ? -1 : b.bookmaker === '' ? 1 : a.bookmaker.localeCompare(b.bookmaker)))
    })).sort((a, b) => marketLabel(a.marketId).localeCompare(marketLabel(b.marketId)));
  }, [filtered]);

  const toggle = (marketId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId); else next.add(marketId);
      return next;
    });

  const openAdd = (marketId?: string) => {
    setAddForm({ ...emptyAdd, marketId: marketId || '', lockMarket: !!marketId });
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!addForm.marketId.trim()) { setMsg({ type: 'err', text: 'Selecione o mercado.' }); return; }
    if (addForm.houses.length === 0) { setMsg({ type: 'err', text: 'Selecione ao menos uma casa.' }); return; }
    if (!addForm.displayName.trim()) { setMsg({ type: 'err', text: 'Informe o nome exibido.' }); return; }
    setSaving(true);
    try {
      const res = await apiGateway.bulkUpsertMarketNames({
        marketId: addForm.marketId.trim(),
        displayName: addForm.displayName.trim(),
        bookmakers: addForm.houses
      });
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Nome salvo.' });
      setAddOpen(false);
      setExpanded((prev) => new Set(prev).add(addForm.marketId.trim()));
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar nome de mercado.') });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: MarketNameDTO) => {
    setEditRow(r);
    setEditName(r.displayName);
    setEditBookmaker(r.bookmaker);
  };

  const handleEdit = async () => {
    if (!editRow) return;
    if (!editName.trim()) { setMsg({ type: 'err', text: 'Informe o nome exibido.' }); return; }
    setEditSaving(true);
    try {
      const res = await apiGateway.updateMarketName(editRow.id, { displayName: editName.trim(), bookmaker: editBookmaker });
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Nome atualizado.' });
      setEditRow(null);
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao atualizar nome de mercado.') });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (r: MarketNameDTO) => {
    if (!window.confirm(`Remover o nome "${r.displayName}" de ${bookmakerName(r.bookmaker)} para ${marketLabel(r.marketId)}?`)) return;
    try {
      await apiGateway.deleteMarketName(r.id);
      setMsg({ type: 'ok', text: 'Nome removido.' });
      await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao remover nome de mercado.') });
    }
  };

  const totalEntries = rows.length;
  const totalMarkets = new Set(rows.map((r) => r.marketId)).size;

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <Tags className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mercados</h1>
            <p className="text-sm text-gray-400">Nome de cada mercado como a casa mostra no site (ajuda o usuário a achar lá)</p>
          </div>
        </div>
        <button
          onClick={() => load()}
          className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
          title="Atualizar"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Toolbar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por mercado, casa ou nome exibido..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <span className="text-xs text-gray-400 hidden sm:flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Layers size={13} /> {totalMarkets} mercados</span>
          <span className="inline-flex items-center gap-1"><Store size={13} /> {totalEntries} nomes</span>
        </span>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold transition"
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {/* Mensagem */}
      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Lista agrupada por mercado */}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center text-gray-400">Carregando...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-12 text-center">
          <Tags className="mx-auto text-gray-600 mb-3" size={32} />
          <p className="text-gray-400">{q ? 'Nenhum mercado encontrado para a busca.' : 'Nenhum nome de mercado cadastrado ainda.'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const open = expanded.has(g.marketId);
            const global = g.rows.find((r) => r.bookmaker === '');
            return (
              <div key={g.marketId} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => toggle(g.marketId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition text-left"
                >
                  {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{marketLabel(g.marketId)}</div>
                    <div className="text-[11px] text-gray-500 font-mono truncate">{g.marketId}</div>
                  </div>
                  {global && <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[220px]">{global.displayName}</span>}
                  <span className="text-[11px] text-gray-400 shrink-0 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 ring-1 ring-white/10">
                    <Store size={11} /> {g.rows.length}
                  </span>
                </button>

                {/* Linhas (casa -> nome exibido) */}
                {open && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {g.rows.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-40 shrink-0 flex items-center gap-1.5">
                          {r.bookmaker === ''
                            ? <span className="inline-flex items-center gap-1 text-xs text-violet-300"><Globe size={12} /> Global</span>
                            : <span className="text-xs text-gray-200 truncate">{bookmakerName(r.bookmaker)}</span>}
                        </div>
                        <div className="flex-1 min-w-0 text-sm text-white truncate">{r.displayName}</div>
                        <SourcePill source={r.source} />
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-teal-300 hover:bg-white/10 transition" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10 transition" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-2.5">
                      <button onClick={() => openAdd(g.marketId)} className="inline-flex items-center gap-1.5 text-sm text-teal-300 hover:text-teal-200">
                        <Plus size={14} /> Adicionar nome para uma casa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Adicionar */}
      {addOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setAddOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1">Nome de mercado por casa</h2>
            <p className="text-xs text-gray-400 mb-5">Como a casa apresenta o mercado no site. Use <span className="text-violet-300">Global</span> para um padrão que vale p/ qualquer casa.</p>

            <div className="space-y-4">
              <div className="text-xs text-gray-400">
                Mercado
                {addForm.lockMarket ? (
                  <div className={`${inputClass} mt-1 flex items-center justify-between`}>
                    <span>{marketLabel(addForm.marketId)}</span>
                    <span className="text-[11px] text-gray-500 font-mono">{addForm.marketId}</span>
                  </div>
                ) : (
                  <>
                    {addForm.marketId && (
                      <div className="mt-1 mb-1.5 inline-flex items-center gap-2 rounded-lg bg-teal-500/10 ring-1 ring-teal-500/30 px-2.5 py-1 text-sm text-teal-200">
                        {marketLabel(addForm.marketId)} <span className="text-[10px] text-teal-300/60 font-mono">{addForm.marketId}</span>
                      </div>
                    )}
                    <div className="mt-1"><MarketPicker value={addForm.marketId} onChange={(marketId) => setAddForm({ ...addForm, marketId })} /></div>
                  </>
                )}
              </div>

              <div className="text-xs text-gray-400">
                Casas
                <div className="mt-1"><HouseMultiSelect bookmakers={bookmakers} value={addForm.houses} onChange={(houses) => setAddForm({ ...addForm, houses })} /></div>
              </div>

              <label className="block text-xs text-gray-400">
                Nome exibido na casa
                <input value={addForm.displayName} onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })} className={`${inputClass} mt-1`} placeholder="Ex.: Empate Anula Aposta" />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAddOpen(false)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editRow && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-6 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditRow(null)} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
            <h2 className="text-lg font-bold text-white mb-1">Editar nome de mercado</h2>
            <p className="text-xs text-gray-400 mb-5">{marketLabel(editRow.marketId)} <span className="font-mono text-gray-500">({editRow.marketId})</span></p>

            <div className="space-y-4">
              <div className="text-xs text-gray-400">
                Casa
                <div className="mt-1"><Select value={editBookmaker} onChange={setEditBookmaker} options={houseOptions} /></div>
              </div>
              <label className="block text-xs text-gray-400">
                Nome exibido na casa
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditRow(null)} className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5">Cancelar</button>
              <button onClick={handleEdit} disabled={editSaving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />} {editSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketsPage;
