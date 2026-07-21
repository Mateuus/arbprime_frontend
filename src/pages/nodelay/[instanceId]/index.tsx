import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelay } from '@/hooks/useNoDelay';
import { useInstanceLiveGames } from '@/hooks/useInstanceLiveGames';
import { useAltenarInstanceGames } from '@/hooks/useAltenarInstanceGames';
import { useSuperbetInstanceGames } from '@/hooks/useSuperbetInstanceGames';
import { useNoDelaySessionKeeper } from '@/hooks/useNoDelaySessionKeeper';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance, NoDelayBookmaker, NoDelayAccount } from '@/interfaces/nodelay.interface';
import { connectAccount, disconnectAccount, refreshAllAccounts, errorText, SuperbetMfa } from '@/services/nodelay/connect';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { AccountCard } from '@/components/nodelay/AccountCard';
import { NoDelayLoginModal } from '@/components/nodelay/NoDelayLoginModal';
import { SuperbetMfaModal } from '@/components/nodelay/SuperbetMfaModal';
import { EditAccountModal } from '@/components/nodelay/EditAccountModal';
import { PrematchLiveToggle, BoardMode } from '@/components/nodelay/PrematchLiveToggle';
import { PrematchGamesList } from '@/components/nodelay/PrematchGamesList';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { scoreOf, clockOf } from '@/utils/nodelayLive';
import { formatMoney } from '@/utils/nodelayUi';
import {
  ArrowLeft, Loader2, Plus, Check, Radio, ChevronRight, ChevronDown, Wallet, Users, X, Layers, AlertTriangle, Search, Settings2, RefreshCw,
} from 'lucide-react';

/**
 * Workspace UNIFICADO da instância. A página inteira é o FEED de jogos ao vivo
 * (uma casa só na listagem — as casas rodam o mesmo sistema fssb, então não
 * duplicamos nem mostramos o nome da casa; a odd sai de uma só). A gestão de
 * casas + contas mora num DRAWER lateral, para não ocupar a página.
 *
 * Mantemos o SSE de TODAS as casas prontas vivo (para o disparo pegar a odd de
 * cada casa na hora do placeBet), mas listamos só a casa primária.
 */
export default function NoDelayWorkspacePage() {
  const router = useRouter();
  const instanceId = typeof router.query.instanceId === 'string' ? router.query.instanceId : '';
  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { bookmakers, accounts, denied, reload: reloadNd } = useNoDelay(isAuthenticated);

  const [instance, setInstance] = useState<NoDelayInstance | null>(null);
  const [loadingInst, setLoadingInst] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [loginHouse, setLoginHouse] = useState<NoDelayBookmaker | null>(null);
  const [editAccount, setEditAccount] = useState<NoDelayAccount | null>(null);
  // superbet: conta + métodos de 2º fator quando o connect devolve `mfa`.
  const [mfaAccount, setMfaAccount] = useState<NoDelayAccount | null>(null);
  const [mfaInfo, setMfaInfo] = useState<SuperbetMfa | null>(null);
  const [busyAcc, setBusyAcc] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProg, setRefreshProg] = useState<{ done: number; total: number } | null>(null);

  const loadInstance = useCallback(async () => {
    if (!instanceId) return;
    try {
      const r = await apiGateway.getNoDelayInstance(instanceId);
      if (r.data?.result === 1) setInstance(r.data.data);
    } finally { setLoadingInst(false); }
  }, [instanceId]);

  useEffect(() => {
    if (!isAuthenticated || !instanceId) return;
    void loadInstance();
  }, [isAuthenticated, instanceId, loadInstance]);

  // Casas da instância (só as prontas viram feed/aposta).
  const houseSlugs = useMemo(() => instance?.houseSlugs ?? [], [instance]);
  const instanceHouses = useMemo(
    () => bookmakers.filter((b) => houseSlugs.includes(b.slug)),
    [bookmakers, houseSlugs],
  );
  const readyHouses = useMemo(() => instanceHouses.filter((h) => h.ready), [instanceHouses]);

  // Mantém as sessões vivas + reconecta as que caírem, sozinho.
  useNoDelaySessionKeeper(readyHouses, reloadNd, isAuthenticated && !!instance);

  // Contas das casas da instância, agrupadas por bookmaker.
  const accountsByHouse = useMemo(() => {
    const map = new Map<string, NoDelayAccount[]>();
    for (const a of accounts) {
      if (!houseSlugs.includes(a.bookmakerSlug)) continue;
      (map.get(a.bookmakerSlug) ?? map.set(a.bookmakerSlug, []).get(a.bookmakerSlug)!).push(a);
    }
    return map;
  }, [accounts, houseSlugs]);

  const connectedCount = accounts.filter((a) => houseSlugs.includes(a.bookmakerSlug) && a.status === 'connected').length;

  const saveHouses = async (slugs: string[]) => {
    const r = await apiGateway.updateNoDelayInstance(instanceId, { houseSlugs: slugs });
    if (r.data?.result === 1) setInstance(r.data.data);
  };

  const runAcc = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setBusyAcc(id);
    try { await fn(); await reloadNd(); } catch (e) { alert(errorText(e)); await reloadNd(); } finally { setBusyAcc(null); }
  }, [reloadNd]);

  // Conectar: igual ao runAcc, MAS se o backend pedir 2º fator (superbet), abre o
  // modal de MFA em vez de dar como concluído. Vale p/ qualquer botão "Conectar".
  const handleConnect = useCallback(async (house: NoDelayBookmaker, a: NoDelayAccount) => {
    setBusyAcc(a.id);
    try {
      const out = await connectAccount(house, a);
      if (out.status === 'mfa') { setMfaAccount(out.account); setMfaInfo(out.mfa); }
      await reloadNd();
    } catch (e) {
      alert(errorText(e));
      await reloadNd();
    } finally {
      setBusyAcc(null);
    }
  }, [reloadNd]);

  // "Atualizar": revalida sessão (restore_login) + relê saldo de todas as contas.
  const refreshAccounts = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshProg(null);
    try {
      await refreshAllAccounts(readyHouses, (done, total) => setRefreshProg({ done, total }));
      await reloadNd();
    } catch (e) {
      alert(errorText(e, 'Não foi possível atualizar as contas.'));
    } finally {
      setRefreshing(false);
      setRefreshProg(null);
    }
  }, [refreshing, readyHouses, reloadNd]);

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        <button onClick={() => router.push('/nodelay')} className="mb-3 inline-flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-lime-300">
          <ArrowLeft size={14} /> Instâncias
        </button>

        {loadingInst ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Carregando…</div>
        ) : !instance ? (
          <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-300">Instância não encontrada.</div>
        ) : (
          <>
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-lime-500/10 ring-1 ring-lime-500/20">
                  <Layers className="text-lime-300" size={22} />
                </div>
                <div>
                  <InstanceName instance={instance} onRenamed={(n) => setInstance({ ...instance, name: n })} instanceId={instanceId} />
                  <p className="text-sm text-gray-400">{instanceHouses.length} casa{instanceHouses.length === 1 ? '' : 's'} · {connectedCount} conta{connectedCount === 1 ? '' : 's'} conectada{connectedCount === 1 ? '' : 's'}</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 ring-1 ring-white/10 transition hover:bg-white/10">
                <Users size={16} /> Casas e contas
                {connectedCount > 0 && <span className="rounded-full bg-lime-500/20 px-1.5 py-0.5 text-[10px] font-bold text-lime-300">{connectedCount}</span>}
              </button>
            </header>

            {instanceHouses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <Layers className="mx-auto mb-3 text-gray-600" size={30} />
                <p className="text-sm text-gray-400">Esta instância ainda não tem casas.</p>
                <button onClick={() => setManaging(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400">
                  <Plus size={15} /> Adicionar casas
                </button>
              </div>
            ) : (
              /* Feed ocupa a página inteira (Ao Vivo x Prematch são DUAS listas) */
              <InstanceFeed instanceId={instanceId} houses={readyHouses} houseSlugs={houseSlugs} />
            )}

            {drawerOpen && (
              <HousesDrawer
                houses={instanceHouses}
                accountsByHouse={accountsByHouse}
                busyAcc={busyAcc}
                refreshing={refreshing}
                refreshProgress={refreshProg}
                onRefresh={refreshAccounts}
                onClose={() => setDrawerOpen(false)}
                onManage={() => setManaging(true)}
                onAddAccount={(h) => setLoginHouse(h)}
                onConnect={handleConnect}
                onDisconnect={(a) => runAcc(a.id, () => disconnectAccount(a))}
                onRemove={(a) => { if (window.confirm('Remover a conta?')) runAcc(a.id, () => apiGateway.deleteNoDelayAccount(a.id)); }}
                onEdit={(a) => setEditAccount(a)}
              />
            )}
            {managing && (
              <ManageHousesModal
                allHouses={bookmakers}
                selected={houseSlugs}
                onClose={() => setManaging(false)}
                onSave={async (slugs) => { await saveHouses(slugs); setManaging(false); }}
              />
            )}
            {loginHouse && (
              <NoDelayLoginModal
                house={loginHouse}
                onClose={() => setLoginHouse(null)}
                onDone={async () => { setLoginHouse(null); await reloadNd(); }}
                onMfa={(account, mfa) => { setLoginHouse(null); setMfaAccount(account); setMfaInfo(mfa); }}
              />
            )}
            {mfaAccount && mfaInfo && (
              <SuperbetMfaModal
                account={mfaAccount}
                mfa={mfaInfo}
                onClose={() => { setMfaAccount(null); setMfaInfo(null); }}
                onDone={async () => { setMfaAccount(null); setMfaInfo(null); await reloadNd(); }}
              />
            )}
            {editAccount && (
              <EditAccountModal
                account={editAccount}
                onClose={() => setEditAccount(null)}
                onSaved={async () => { setEditAccount(null); await reloadNd(); }}
              />
            )}
          </>
        )}
      </div>
    </NoDelayGate>
  );
}

/** Nome da instância editável inline. */
function InstanceName({ instance, instanceId, onRenamed }: { instance: NoDelayInstance; instanceId: string; onRenamed: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(instance.name);
  const save = async () => {
    setEditing(false);
    const v = name.trim();
    if (!v || v === instance.name) { setName(instance.name); return; }
    onRenamed(v);
    try { await apiGateway.updateNoDelayInstance(instanceId, { name: v }); } catch { /* ignora */ }
  };
  return editing ? (
    <input
      value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && save()}
      autoFocus className="rounded-md bg-black/30 px-2 py-0.5 text-xl font-bold text-white ring-1 ring-lime-500/40 focus:outline-none"
    />
  ) : (
    <button onClick={() => { setName(instance.name); setEditing(true); }} className="text-left text-xl font-bold text-white hover:text-lime-200" title="Renomear">
      {instance.name}
    </button>
  );
}

/**
 * Drawer lateral (slide) com as CASAS da instância e as contas de cada uma.
 * Tirado da página para o feed ocupar tudo. Aqui o usuário adiciona/gerencia
 * casas e conecta/remove contas.
 */
function HousesDrawer({
  houses, accountsByHouse, busyAcc, refreshing, refreshProgress, onRefresh, onClose, onManage, onAddAccount, onConnect, onDisconnect, onRemove, onEdit,
}: {
  houses: NoDelayBookmaker[];
  accountsByHouse: Map<string, NoDelayAccount[]>;
  busyAcc: string | null;
  refreshing: boolean;
  refreshProgress: { done: number; total: number } | null;
  onRefresh: () => void;
  onClose: () => void;
  onManage: () => void;
  onAddAccount: (h: NoDelayBookmaker) => void;
  onConnect: (house: NoDelayBookmaker, a: NoDelayAccount) => void;
  onDisconnect: (a: NoDelayAccount) => void;
  onRemove: (a: NoDelayAccount) => void;
  onEdit: (a: NoDelayAccount) => void;
}) {
  return (
    <div className="fixed inset-0 z-[9998] flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-brand-dark shadow-2xl sm:w-[440px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-lime-300" />
            <h2 className="text-base font-bold text-white">Casas e contas</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-gray-200 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-60"
              title="Revalidar sessão e saldo de todas as contas"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? (refreshProgress ? `${refreshProgress.done}/${refreshProgress.total}` : 'Atualizando…') : 'Atualizar'}
            </button>
            <button onClick={onClose} className="text-gray-400 transition hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <button onClick={onManage} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 ring-1 ring-white/10 transition hover:bg-white/10">
            <Settings2 size={15} /> Gerenciar casas da instância
          </button>

          {houses.length === 0 ? (
            <p className="px-1 pt-2 text-sm text-gray-500">Nenhuma casa na instância ainda.</p>
          ) : houses.map((house) => (
            <HouseGroup
              key={house.slug}
              house={house}
              accounts={accountsByHouse.get(house.slug) ?? []}
              busyAcc={busyAcc}
              onAddAccount={onAddAccount}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onRemove={onRemove}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Grupo de uma casa no drawer — COLAPSÁVEL (recolhido por padrão). O cabeçalho
 * (logo + nome + caixa total + nº de contas + "+ Conta") fica sempre à vista;
 * clicar expande/recolhe as contas. Compacto p/ caber muitas contas sem rolar.
 */
function HouseGroup({
  house, accounts, busyAcc, onAddAccount, onConnect, onDisconnect, onRemove, onEdit,
}: {
  house: NoDelayBookmaker;
  accounts: NoDelayAccount[];
  busyAcc: string | null;
  onAddAccount: (h: NoDelayBookmaker) => void;
  onConnect: (house: NoDelayBookmaker, a: NoDelayAccount) => void;
  onDisconnect: (a: NoDelayAccount) => void;
  onRemove: (a: NoDelayAccount) => void;
  onEdit: (a: NoDelayAccount) => void;
}) {
  const [open, setOpen] = useState(false);
  const caixa = accounts.filter((a) => a.status === 'connected').reduce((s, a) => s + (a.balance ?? 0), 0);
  const temSaldo = accounts.some((a) => a.balance != null);
  const connectedCount = accounts.filter((a) => a.status === 'connected').length;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown size={15} className={`shrink-0 text-gray-500 transition ${open ? '' : '-rotate-90'}`} />
          <BookmakerLogo name={house.name} slug={house.slug} logoUrl={house.logoUrl} color={house.color} size={22} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{house.name}</div>
            {temSaldo && <div className="text-[11px] text-gray-500"><Wallet size={10} className="mr-1 inline" />{formatMoney(caixa)}</div>}
          </div>
          {/* nº de contas conectadas / total */}
          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-400" title="Contas conectadas / total">
            {connectedCount}/{accounts.length}
          </span>
        </button>
        <button onClick={() => onAddAccount(house)} disabled={!house.ready} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-lime-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-lime-200 ring-1 ring-lime-500/30 transition hover:bg-lime-500/25 disabled:opacity-40" title={house.ready ? 'Conectar conta' : 'Casa não configurada'}>
          <Plus size={13} /> Conta
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 p-2">
          {accounts.length === 0 ? (
            <p className="px-1 py-1 text-[11px] text-gray-600">Nenhuma conta ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {accounts.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  busy={busyAcc === a.id}
                  onConnect={() => onConnect(house, a)}
                  onDisconnect={() => onDisconnect(a)}
                  onRemove={() => onRemove(a)}
                  onEdit={() => onEdit(a)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Modal p/ escolher quais casas (prontas) fazem parte da instância. */
function ManageHousesModal({ allHouses, selected, onClose, onSave }: { allHouses: NoDelayBookmaker[]; selected: string[]; onClose: () => void; onSave: (slugs: string[]) => Promise<void> }) {
  const [set, setSet] = useState<Set<string>>(new Set(selected));
  const [saving, setSaving] = useState(false);
  const ready = allHouses.filter((h) => h.ready);
  const toggle = (slug: string) => setSet((prev) => { const n = new Set(prev); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-brand-dark p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Casas da instância</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-3 text-[11px] text-gray-500">Escolha as casas do padrão swarm+fssbio que fazem parte desta instância.</p>
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {ready.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma casa liberada no NoDelay.</p>
          ) : ready.map((h) => {
            const on = set.has(h.slug);
            return (
              <button key={h.slug} onClick={() => toggle(h.slug)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ring-1 transition ${on ? 'bg-lime-500/10 ring-lime-500/30' : 'bg-white/[0.03] ring-white/5 hover:bg-white/5'}`}>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ring-1 ${on ? 'bg-lime-500 ring-lime-500 text-slate-900' : 'ring-white/20'}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                <BookmakerLogo name={h.name} slug={h.slug} logoUrl={h.logoUrl} color={h.color} size={22} />
                <span className={`flex-1 truncate text-sm ${on ? 'text-white' : 'text-gray-400'}`}>{h.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onSave([...set]); setSaving(false); }} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Emoji por esporte (nome em pt-BR da rogue). Fallback 🏆. */
function sportEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('futebol americano') || n.includes('nfl')) return '🏈';
  if (n.includes('futsal')) return '⚽';
  if (n.includes('futebol') || n.includes('soccer')) return '⚽';
  if (n.includes('basquet') || n.includes('basket')) return '🏀';
  if (n.includes('tênis de mesa') || n.includes('tenis de mesa') || n.includes('ping')) return '🏓';
  if (n.includes('tên') || n.includes('ten')) return '🎾';
  if (n.includes('vôlei') || n.includes('volei') || n.includes('volley')) return '🏐';
  if (n.includes('hóquei') || n.includes('hoquei') || n.includes('hockey')) return '🏒';
  if (n.includes('beisebol') || n.includes('baseball')) return '⚾';
  if (n.includes('handebol') || n.includes('handball')) return '🤾';
  if (n.includes('rugby') || n.includes('rúgbi')) return '🏉';
  if (n.includes('críquete') || n.includes('criquete') || n.includes('cricket')) return '🏏';
  if (n.includes('e-sport') || n.includes('esport') || n.includes('cs') || n.includes('dota') || n.includes('lol')) return '🎮';
  if (n.includes('boxe') || n.includes('mma') || n.includes('luta') || n.includes('ufc')) return '🥊';
  if (n.includes('dardos') || n.includes('darts')) return '🎯';
  if (n.includes('sinuca') || n.includes('bilhar') || n.includes('snooker')) return '🎱';
  if (n.includes('golfe') || n.includes('golf')) return '⛳';
  if (n.includes('badminton')) return '🏸';
  if (n.includes('automob') || n.includes('fórmula') || n.includes('formula') || n.includes('corrida')) return '🏎️';
  return '🏆';
}

/**
 * Aba de esporte estilo bet365: ícone (emoji) em cima, rótulo embaixo, e um
 * sublinhado LIME na aba ativa (não é pílula preenchida). Fica numa barra escura
 * com border-b; o sublinhado da ativa se sobrepõe à linha de base.
 */
function SportTab({ active, icon, label, count, onClick }: { active: boolean; icon: string; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex shrink-0 flex-col items-center gap-0.5 whitespace-nowrap px-3 py-2 transition ${
        active ? 'text-lime-300' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="flex items-center gap-1 text-[11px] font-medium">
        {label}
        <span className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${active ? 'bg-lime-500/25 text-lime-200' : 'bg-white/10 text-gray-500'}`}>{count}</span>
      </span>
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lime-400" />}
    </button>
  );
}

/**
 * Feed da instância = DUAS listas separadas (Ao Vivo x Prematch), trocadas pelo
 * alternador no topo. "Ao Vivo" = o feed real de jogos ao vivo (InstanceLiveFeed).
 * "Prematch" = a lista de pré-jogo (PrematchGamesList).
 * Cada partida abre a SUA página: ao vivo → /{casa}/event/{id}; prematch →
 * /prematch/{casa}/{eventId} (sem toggle nas páginas — a escolha é só aqui).
 *
 * A aba fica PERSISTIDA na URL (?tab=prematch|live): assim voltar de uma página
 * de evento restaura a aba certa (o onBack do prematch volta com ?tab=prematch).
 */
function InstanceFeed({ instanceId, houses, houseSlugs }: { instanceId: string; houses: NoDelayBookmaker[]; houseSlugs: string[] }) {
  const router = useRouter();
  // Modo inicial vem da URL: ?tab=prematch → prematch; ausente/qualquer → live.
  const initialMode: BoardMode = router.query.tab === 'prematch' ? 'prematch' : 'live';
  const [mode, setMode] = useState<BoardMode>(initialMode);

  // Troca de aba: atualiza o estado + reflete na URL (shallow, sem rolar).
  const changeMode = (m: BoardMode) => {
    setMode(m);
    router.replace(
      { pathname: `/nodelay/${instanceId}`, query: { tab: m } },
      undefined,
      { shallow: true, scroll: false },
    );
  };

  return (
    <div>
      <div className="mb-4">
        <PrematchLiveToggle mode={mode} onChange={changeMode} />
      </div>
      {mode === 'live' ? (
        <InstanceLiveFeed instanceId={instanceId} houses={houses} />
      ) : (
        <PrematchGamesList
          houseSlugs={houseSlugs}
          onOpen={(bm, id) => router.push(`/nodelay/${instanceId}/prematch/${bm}/${id}`)}
        />
      )}
    </div>
  );
}

/**
 * Feed de jogos ao vivo — ocupa a página inteira. Lista UMA casa só (a primária):
 * as casas rodam o mesmo sistema, então não duplicamos nem mostramos o nome. Os
 * streams de todas as casas prontas continuam vivos (para o disparo pegar a odd
 * específica de cada casa no placeBet). Abas por ESPORTE separam Futebol/Basquete/…
 */
function InstanceLiveFeed({ instanceId, houses }: { instanceId: string; houses: NoDelayBookmaker[] }) {
  const router = useRouter();
  // Feed UNIFICADO: fssb (SSE) + biahosted/Altenar (polling) + Superbet (polling),
  // todos no mesmo formato.
  const swarm = useInstanceLiveGames(houses);
  const bia = useAltenarInstanceGames(houses);
  const sb = useSuperbetInstanceGames(houses);
  const games = useMemo(() => [...swarm.games, ...bia.games, ...sb.games], [swarm.games, bia.games, sb.games]);
  const loading = swarm.loading || bia.loading || sb.loading;
  const liveCount = swarm.liveCount + bia.liveCount + sb.liveCount;
  const [q, setQ] = useState('');
  const [sport, setSport] = useState('all');

  // Uma casa só na LISTAGEM, mas por DEDUPE de id (não por casa fixa): as casas
  // compartilham o MESMO _id de evento, então mostramos um card por evento pegando
  // a 1ª casa que o tem. Assim, se a casa X ainda não trouxe um jogo mas a Y sim,
  // o jogo aparece do mesmo jeito (não zera o feed). Todas seguem streamando.
  const displayGames = useMemo(() => {
    const byId = new Map<string, (typeof games)[number]>();
    for (const g of games) if (!byId.has(g.id)) byId.set(g.id, g);
    return [...byId.values()];
  }, [games]);

  // Esportes presentes (as abas). Ordenados pela ordem nativa do site.
  const sports = useMemo(() => {
    const by = new Map<string, { id: string; name: string; order: number; count: number }>();
    for (const g of displayGames) {
      const e = by.get(g.sportId) ?? { id: g.sportId, name: g.sportName || 'Outro', order: g.sportOrder, count: 0 };
      e.count++;
      by.set(g.sportId, e);
    }
    return [...by.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [displayGames]);

  // Aba ativa derivada (se o esporte sumir do feed, cai p/ "Todos" sem setState).
  const activeSport = sport !== 'all' && sports.some((s) => s.id === sport) ? sport : 'all';

  const leagues = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = displayGames;
    if (activeSport !== 'all') list = list.filter((g) => g.sportId === activeSport);
    if (term) list = list.filter((g) => [g.home, g.away, g.competitionName, g.sportName].some((v) => (v || '').toLowerCase().includes(term)));
    const by = new Map<string, { name: string; sportOrder: number; games: typeof displayGames }>();
    for (const g of list) {
      const key = `${g.sportId}— ${g.competitionName || 'Outros'}`;
      const label = activeSport === 'all' ? `${g.sportName} · ${g.competitionName || 'Outros'}` : (g.competitionName || 'Outros');
      const b = by.get(key) ?? { name: label, sportOrder: g.sportOrder, games: [] };
      b.games.push(g);
      by.set(key, b);
    }
    return [...by.values()].map((b) => ({ ...b, games: b.games.sort((x, y) => x.home.localeCompare(y.home)) })).sort((a, b) => a.sportOrder - b.sportOrder || a.name.localeCompare(b.name));
  }, [displayGames, q, activeSport]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Radio size={13} className={liveCount > 0 ? 'text-lime-300' : ''} /> Eventos ao vivo
          <span className="text-gray-600">({displayGames.length})</span>
        </h2>
      </div>

      {/* Busca — barra full-width, alvo de toque maior */}
      {displayGames.length > 0 && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar time ou liga…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-500 transition focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/30"
          />
        </div>
      )}

      {/* Abas de esporte estilo bet365 (ícone em cima, sublinhado lime na ativa) */}
      {sports.length > 1 && (
        <div className="mb-4 -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <div className="flex w-max min-w-full gap-1 border-b border-white/10">
            <SportTab active={activeSport === 'all'} icon="🏆" label="Todos" count={displayGames.length} onClick={() => setSport('all')} />
            {sports.map((s) => (
              <SportTab key={s.id} active={activeSport === s.id} icon={sportEmoji(s.name)} label={s.name} count={s.count} onClick={() => setSport(s.id)} />
            ))}
          </div>
        </div>
      )}

      {houses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">
          <AlertTriangle className="mx-auto mb-2 text-amber-400" size={20} /> Nenhuma casa pronta na instância.
        </div>
      ) : loading && displayGames.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400"><Loader2 className="animate-spin" size={16} /> Buscando jogos ao vivo…</div>
      ) : displayGames.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">Nenhum jogo ao vivo agora.</div>
      ) : leagues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-gray-500">Nada encontrado.</div>
      ) : (
        /* Estilo bet365 (irmão do PrematchGamesList): container por liga +
           linhas com escudo, times empilhados, relógio (lime) + placar. Sem odds
           1X2: no ao vivo a odd só carrega DENTRO do evento.
           TODO: mostrar 1X2 na lista exigiria fetch de odds por evento aqui. */
        <div className="space-y-5">
          {leagues.map((b) => (
            <div key={b.name} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              {/* Cabeçalho da liga */}
              <div className="flex items-center gap-1 border-b border-white/10 bg-black/20 px-3 py-2.5">
                <span className="truncate text-sm font-bold text-white">{b.name}</span>
                <span className="text-xs text-gray-600">({b.games.length})</span>
                <ChevronRight size={15} className="text-gray-500" />
              </div>

              <div className="divide-y divide-white/5">
                {b.games.map((g) => {
                  const score = scoreOf(g); const clock = clockOf(g);
                  return (
                    <button
                      key={g.id}
                      onClick={() => router.push(`/nodelay/${instanceId}/${g.houseSlug}/event/${g.id}`)}
                      className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/[0.03]"
                    >
                      {/* Coluna do relógio ao vivo (lime, Radio pulsando) */}
                      <span className="flex w-11 shrink-0 items-center justify-center">
                        {clock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums text-lime-300">
                            <Radio size={8} className="animate-pulse" /> {clock}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-rose-300">
                            <Radio size={8} className="animate-pulse" /> Live
                          </span>
                        )}
                      </span>

                      {/* Times empilhados com escudo (fallback iniciais: live não traz sofascoreId) */}
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex items-center gap-1.5">
                          <TeamLogo name={g.home} size={18} />
                          <span className="min-w-0 truncate text-xs font-medium text-white">{g.home || '—'}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <TeamLogo name={g.away} size={18} />
                          <span className="min-w-0 truncate text-xs font-medium text-white">{g.away || '—'}</span>
                        </span>
                      </span>

                      {/* Placar por time (lime, direita) */}
                      {score && (
                        <span className="shrink-0 space-y-1 text-right tabular-nums">
                          <span className="block text-sm font-bold text-lime-300">{score.home}</span>
                          <span className="block text-sm font-bold text-lime-300">{score.away}</span>
                        </span>
                      )}

                      <ChevronRight size={16} className="shrink-0 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
