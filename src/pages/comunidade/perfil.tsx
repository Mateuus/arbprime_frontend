import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Check, Loader2, Upload, Trash2, ExternalLink, ShieldCheck, RefreshCcw } from 'lucide-react';
import { apiGateway, MyCommunityProfileDTO, BankrollDTO, VisibilityValue } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import ComunidadeShell from '@/components/comunidade/ComunidadeShell';
import Avatar from '@/components/comunidade/Avatar';
import HelpLabel from '@/components/analytix/HelpLabel';
import { Select } from '@/components/ui/Select';
import { useBankrolls } from '@/components/analytix/useAnalytix';
import { BRL, unwrap } from '@/components/analytix/format';
import { processImage } from '@/components/analytix/imageUpload';

const field = 'mt-1 w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition';
const VIS_OPTS = [
  { value: 'private', label: 'Privada (só eu)' },
  { value: 'public', label: 'Pública (todos)' },
];

export default function ComunidadePerfil() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserContext();
  const { bankrolls, reload: reloadBankrolls } = useBankrolls();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<MyCommunityProfileDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [visibility, setVisibility] = useState<VisibilityValue>('public');
  const [showRealName, setShowRealName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getMyCommunityProfile();
        if (!active) return;
        const p = unwrap<{ profile: MyCommunityProfileDTO | null }>(r, { profile: null }).profile;
        if (p) {
          setProfile(p);
          setHandle(p.handle); setDisplayName(p.displayName || ''); setBio(p.bio || '');
          setAvatar(p.avatar || ''); setVisibility(p.visibility); setShowRealName(p.showRealName);
        }
      } catch { /* sem perfil ainda */ } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [isAuthenticated]);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('O arquivo não é uma imagem.'); return; }
    try { setAvatar(await processImage(file)); } catch { setError('Não foi possível processar a imagem.'); }
  };

  const saveProfile = async () => {
    const h = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(h)) { setError('Handle inválido: 3–32 caracteres (letras minúsculas, números ou _).'); return; }
    setSaving(true); setError('');
    try {
      const r = await apiGateway.saveCommunityProfile({ handle: h, displayName: displayName.trim(), bio: bio.trim(), avatar, visibility, showRealName });
      if (r.data?.result === 1) {
        setProfile(unwrap<MyCommunityProfileDTO>(r, profile as MyCommunityProfileDTO));
        notify('Perfil salvo.');
      } else { setError(r.data?.message || 'Não foi possível salvar.'); }
    } catch { setError('Erro ao salvar perfil.'); } finally { setSaving(false); }
  };

  const setBankrollVis = async (b: BankrollDTO, vis: VisibilityValue) => {
    if (!profile && vis !== 'private') { setError('Salve seu perfil (handle) antes de publicar uma banca.'); return; }
    try {
      const r = await apiGateway.setBankrollVisibility(b.id, { visibility: vis });
      if (r.data?.result === 1) {
        if (vis !== 'private') await apiGateway.recordCommunityConsent({ type: 'public_history', granted: true });
        notify(vis === 'private' ? 'Banca despublicada.' : 'Banca publicada!');
        void reloadBankrolls();
      } else { setError(r.data?.message || 'Não foi possível atualizar.'); }
    } catch { setError('Erro ao atualizar visibilidade.'); }
  };

  const toggleCurrency = async (b: BankrollDTO) => {
    try {
      await apiGateway.setBankrollVisibility(b.id, { visibility: b.visibility, showCurrency: !b.showCurrency });
      notify('Preferência de R$ atualizada.');
      void reloadBankrolls();
    } catch { setError('Erro ao atualizar.'); }
  };

  if (isLoading) {
    return <ComunidadeShell active="perfil" title="Meu perfil"><div className="mt-10 flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Carregando...</div></ComunidadeShell>;
  }
  if (!isAuthenticated) {
    return (
      <ComunidadeShell active="perfil" title="Meu perfil">
        <div className="mx-auto max-w-md mt-12 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h2 className="text-lg font-bold text-white">Entre para criar seu perfil</h2>
          <p className="text-sm text-gray-400 mt-1 mb-5">Publique seu desempenho verificado na comunidade.</p>
          <button onClick={() => router.push({ pathname: '/comunidade/perfil', query: { modal: 'auth', page: 'login' } }, undefined, { shallow: true })} className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold">Fazer login</button>
        </div>
      </ComunidadeShell>
    );
  }

  return (
    <ComunidadeShell
      active="perfil"
      title="Meu perfil"
      subtitle="Identidade pública e bancas publicadas"
      actions={profile && profile.visibility === 'public' ? (
        <button onClick={() => router.push(`/comunidade/u/${profile.handle}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 text-sm hover:bg-white/10">
          <ExternalLink size={15} /> Ver meu perfil público
        </button>
      ) : undefined}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor de perfil */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">Identidade pública</h2>
          <div className="flex items-center gap-3 mb-3">
            <Avatar src={avatar || null} name={displayName || handle} size={56} />
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-gray-200 hover:bg-white/10"><Upload size={13} /> Avatar</button>
              {avatar && <button onClick={() => setAvatar('')} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-300"><Trash2 size={14} /></button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <label className="block text-xs text-gray-400">
            <HelpLabel help="Seu @ único na comunidade (pseudônimo). 3–32 caracteres: letras minúsculas, números ou _.">Handle (@)</HelpLabel>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="ex.: carlos_arb" className={field} />
          </label>
          <label className="block mt-3 text-xs text-gray-400">
            <HelpLabel help="Nome de exibição (pode ser apelido). Seu nome real só aparece se você ativar abaixo.">Nome de exibição</HelpLabel>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} />
          </label>
          <label className="block mt-3 text-xs text-gray-400">
            <HelpLabel help="Uma descrição curta (até 280 caracteres).">Bio</HelpLabel>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={280} className={`${field} resize-none`} />
          </label>
          <div className="mt-3">
            <HelpLabel className="text-xs text-gray-400 mb-1" help="Privado = ninguém vê seu perfil. Público = aparece na busca/descoberta.">Visibilidade do perfil</HelpLabel>
            <Select value={visibility} onChange={(v) => setVisibility(v as VisibilityValue)} buttonClassName="bg-black/20 py-2" options={VIS_OPTS} />
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={showRealName} onChange={(e) => setShowRealName(e.target.checked)} className="accent-teal-500" />
            Exibir meu nome real no perfil
          </label>
          {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}
          <button onClick={saveProfile} disabled={saving} className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar perfil
          </button>
        </section>

        {/* Publicar bancas */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-1">Bancas na comunidade</h2>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            Ao tornar uma banca <b className="text-gray-300">pública</b>, seu desempenho (em <b className="text-gray-300">unidades e %</b>) e o track record verificado ficam visíveis.
            Nunca expomos R$, casas específicas, contas ou dados de parceiros.
          </p>
          {!loaded ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}</div>
          ) : bankrolls.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">Você ainda não tem bancas no Analytix.</div>
          ) : (
            <div className="space-y-2">
              {bankrolls.map((b) => (
                <div key={b.id} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                        {b.name}
                        {b.isPublic && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300"><ShieldCheck size={11} /> pública</span>}
                      </div>
                      <div className="text-[11px] text-gray-500">{b.currency} · {BRL(b.currentBalance)}</div>
                    </div>
                    <Select className="w-40 shrink-0" value={b.visibility} onChange={(v) => setBankrollVis(b, v as VisibilityValue)} buttonClassName="bg-black/20 py-1.5" options={VIS_OPTS} />
                  </div>
                  {b.isPublic && (
                    <label className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={b.showCurrency} onChange={() => toggleCurrency(b)} className="accent-teal-500" />
                      Mostrar valores em R$ no público (por padrão só unidades/%)
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </ComunidadeShell>
  );
}
