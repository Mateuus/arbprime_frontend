import React, { useMemo, useRef, useState } from 'react';
import { X, Loader2, Check, Search, Upload, Trash2, Store, Sparkles } from 'lucide-react';
import { apiGateway, AccountDTO } from '@/gateways/api.gateway';
import { useBookmakers } from '@/hooks/useBookmakers';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { Select } from '@/components/ui/Select';
import HelpLabel from './HelpLabel';
import { useBankrolls, usePartners } from './useAnalytix';
import { BRL, unwrap } from './format';
import { processImage } from './imageUpload';

interface Props {
  account?: AccountDTO | null;
  presetSlug?: string;
  onClose: () => void;
  onSaved: (account: AccountDTO | null) => void;
}

type Mode = 'catalog' | 'custom';

const field = 'mt-1 w-full bg-white/5 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

/**
 * Cadastrar / editar uma casa do usuário. Dois modos:
 *  - "Nossas casas": escolhe do catálogo global (logo/cor já vêm do sistema).
 *  - "Personalizada": casa não catalogada — nome, logo (upload/URL) e cor próprios.
 */
export default function AccountFormModal({ account, presetSlug, onClose, onSaved }: Props) {
  const { bookmakers } = useBookmakers();
  const { bankrolls } = useBankrolls();
  const { partners } = usePartners();
  const isEdit = !!account;
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>(account ? (account.isCustom ? 'custom' : 'catalog') : 'catalog');
  const [selectedSlug, setSelectedSlug] = useState(account && !account.isCustom ? account.slug : (presetSlug || ''));
  const [search, setSearch] = useState('');

  const [customName, setCustomName] = useState(account?.customName || '');
  const [logoUrl, setLogoUrl] = useState(account?.customLogoUrl || '');
  const [color, setColor] = useState(account?.customColor || '#5eead4');

  const [partnerId, setPartnerId] = useState(account?.partnerId || '');
  const [bankrollId, setBankrollId] = useState(account?.bankrollId || '');
  const [label, setLabel] = useState(account?.label || '');
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initialBalance) : '');
  const [username, setUsername] = useState(account?.username || '');
  const [scope, setScope] = useState(account?.scope || '');
  const [notes, setNotes] = useState(account?.notes || '');
  const [limited, setLimited] = useState(account?.limited || false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = bookmakers.filter((b) => b.isActive);
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q));
  }, [bookmakers, search]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('O arquivo não é uma imagem.'); return; }
    try {
      setLogoUrl(await processImage(file));
    } catch {
      setError('Não foi possível processar a imagem.');
    }
  };

  const submit = async () => {
    if (mode === 'custom' && !customName.trim()) { setError('Informe o nome da casa.'); return; }
    if (mode === 'catalog' && !selectedSlug) { setError('Selecione uma casa.'); return; }
    setSaving(true);
    setError('');
    try {
      const balance = parseFloat(initialBalance.replace(',', '.')) || 0;
      const common = {
        label: label.trim(), initialBalance: balance,
        username: username.trim(), scope: scope.trim(), notes: notes.trim(), limited,
      };
      const links = { partnerId: partnerId || null, bankrollId: bankrollId || null };
      let r;
      if (isEdit && account) {
        r = await apiGateway.updateAccount(account.id, account.isCustom
          ? { ...common, ...links, customName: customName.trim(), customLogoUrl: logoUrl, customColor: color }
          : { ...common, ...links });
      } else if (mode === 'custom') {
        r = await apiGateway.createAccount({ isCustom: true, customName: customName.trim(), customLogoUrl: logoUrl || undefined, customColor: color, ...mapCommon(common), ...links });
      } else {
        r = await apiGateway.createAccount({ slug: selectedSlug, ...mapCommon(common), ...links });
      }
      if (r.data?.result === 1) {
        onSaved(unwrap<AccountDTO | null>(r, null));
        onClose();
      } else {
        setError(r.data?.message || 'Não foi possível salvar.');
      }
    } catch {
      setError('Erro ao salvar a casa.');
    } finally {
      setSaving(false);
    }
  };

  // create aceita undefined em opcionais; evita mandar string vazia
  const mapCommon = (c: { label: string; initialBalance: number; username: string; scope: string; notes: string }) => ({
    label: c.label || undefined, initialBalance: c.initialBalance,
    username: c.username || undefined, scope: c.scope || undefined, notes: c.notes || undefined,
  });

  const selectedBk = bookmakers.find((b) => b.slug === selectedSlug);

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-lg bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white pr-8">{isEdit ? 'Editar casa' : 'Cadastrar casa'}</h2>

        {/* Toggle de modo (só na criação) */}
        {!isEdit && (
          <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-white/5 ring-1 ring-white/10 p-1">
            <button onClick={() => setMode('catalog')} className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${mode === 'catalog' ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:bg-white/10'}`}>
              <Store size={15} /> Nossas casas
            </button>
            <button onClick={() => setMode('custom')} className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${mode === 'custom' ? 'bg-teal-500 text-slate-900' : 'text-gray-300 hover:bg-white/10'}`}>
              <Sparkles size={15} /> Personalizada
            </button>
          </div>
        )}

        {/* ===== Modo catálogo ===== */}
        {mode === 'catalog' && (
          isEdit ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2.5">
              <BookmakerLogo name={selectedBk?.name || selectedSlug} slug={selectedSlug} logoUrl={selectedBk?.logoUrl} color={selectedBk?.color} size={28} />
              <span className="text-sm font-medium text-white">{selectedBk?.name || selectedSlug}</span>
            </div>
          ) : (
            <div className="mt-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar casa..." className={`${field} mt-0 pl-9`} />
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {filtered.map((b) => (
                  <button
                    key={b.slug}
                    onClick={() => setSelectedSlug(b.slug)}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ring-1 transition text-left min-w-0 ${selectedSlug === b.slug ? 'bg-teal-500/15 ring-teal-500/50' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}
                  >
                    <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={22} />
                    <span className="text-xs text-gray-200 truncate min-w-0">{b.name}</span>
                    {selectedSlug === b.slug && <Check size={13} className="ml-auto shrink-0 text-teal-300" />}
                  </button>
                ))}
                {filtered.length === 0 && <div className="col-span-full py-6 text-center text-xs text-gray-500">Nenhuma casa encontrada. Use &quot;Personalizada&quot;.</div>}
              </div>
            </div>
          )
        )}

        {/* ===== Modo personalizado ===== */}
        {mode === 'custom' && (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-gray-400">
              <HelpLabel help="Nome da casa personalizada (que não está no nosso catálogo). Você define o logo e a cor.">Nome da casa *</HelpLabel>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ex.: Casa do Zé" className={field} />
            </label>
            <div className="flex items-center gap-3">
              <BookmakerLogo name={customName || '?'} slug={customName} logoUrl={logoUrl || null} color={color} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-gray-200 hover:bg-white/10">
                    <Upload size={13} /> Enviar logo
                  </button>
                  {logoUrl && (
                    <button onClick={() => setLogoUrl('')} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-300 hover:bg-white/10" title="Remover logo"><Trash2 size={14} /></button>
                  )}
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">Cor
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 rounded bg-black/30 border border-white/10 cursor-pointer" />
                  </label>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
                <input value={logoUrl.startsWith('data:') ? '' : logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="ou cole uma URL https://..." className={`${field} mt-2 text-xs`} />
              </div>
            </div>
          </div>
        )}

        {/* ===== Parceiro + Banca ===== */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <HelpLabel className="text-xs text-gray-400 mb-1" help="Dono da conta. 'Eu (operador)' = conta própria; ou escolha um parceiro (conta de terceiro).">Parceiro / dono</HelpLabel>
            <Select value={partnerId} onChange={setPartnerId} buttonClassName="bg-black/20 py-2"
              options={[{ value: '', label: 'Eu (operador)' }, ...partners.map((p) => ({ value: p.id, label: p.name }))]} />
          </div>
          <div>
            <HelpLabel className="text-xs text-gray-400 mb-1" help="A qual banca esta conta pertence. As movimentações dela entram no saldo dessa banca.">Banca</HelpLabel>
            <Select value={bankrollId} onChange={setBankrollId} buttonClassName="bg-black/20 py-2"
              options={[{ value: '', label: 'Banca padrão' }, ...bankrolls.map((b) => ({ value: b.id, label: `${b.name} — ${BRL(b.currentBalance)}` }))]} />
          </div>
        </div>

        {/* ===== Campos comuns ===== */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-400">
            <HelpLabel help="Um nome curto para identificar esta conta (ex.: conta principal, conta do João).">Apelido</HelpLabel>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Conta principal" className={field} />
          </label>
          <label className="text-xs text-gray-400">
            <HelpLabel help="Saldo que já existe nesta conta no momento do cadastro.">Saldo inicial (R$)</HelpLabel>
            <input value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} inputMode="decimal" placeholder="0,00" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="text-xs text-gray-400">
            <HelpLabel help="Login/usuário da conta na casa (opcional e privado).">Usuário/login</HelpLabel>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
          </label>
          <label className="text-xs text-gray-400">
            <HelpLabel help="Marcação opcional para organizar (ex.: residencial, bet365).">Escopo</HelpLabel>
            <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="ex.: residencial" className={field} />
          </label>
        </div>
        <label className="block mt-2 text-xs text-gray-400">
          <HelpLabel help="Anotações livres sobre a conta.">Notas</HelpLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} resize-none`} />
        </label>
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-300 cursor-pointer select-none">
          <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} className="accent-teal-500" />
          Conta limitada/restrita pela casa
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
