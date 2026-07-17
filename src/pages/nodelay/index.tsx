import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUserContext } from '@/context/UserContext';
import { useNoDelayInstances } from '@/hooks/useNoDelayInstances';
import { useNoDelay } from '@/hooks/useNoDelay';
import { apiGateway } from '@/gateways/api.gateway';
import { NoDelayInstance } from '@/interfaces/nodelay.interface';
import { NoDelayGate } from '@/components/nodelay/NoDelayGate';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { formatMoney } from '@/utils/nodelayUi';
import { Rocket, Plus, Loader2, ChevronRight, Trash2, Layers, Users, Wallet } from 'lucide-react';

const errMsg = (e: unknown, fb: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

/**
 * Home do NoDelay = as INSTÂNCIAS do usuário (workspaces). Cada instância agrupa
 * casas do padrão swarm+fssbio; dentro dela o usuário conecta contas e dispara.
 */
export default function NoDelayInstancesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();
  const { instances, loading, denied, error, reload } = useNoDelayInstances(isAuthenticated);
  const { bookmakers, accounts } = useNoDelay(isAuthenticated);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const r = await apiGateway.createNoDelayInstance({ name: 'Nova instância', houseSlugs: [] });
      if (r.data?.result === 1) router.push(`/nodelay/${(r.data.data as NoDelayInstance).id}`);
    } catch (e) { alert(errMsg(e, 'Erro ao criar.')); } finally { setCreating(false); }
  };

  const remove = async (inst: NoDelayInstance) => {
    if (!window.confirm(`Remover a instância "${inst.name}"? As contas conectadas continuam salvas.`)) return;
    setBusy(inst.id);
    try { await apiGateway.deleteNoDelayInstance(inst.id); await reload(); }
    catch (e) { alert(errMsg(e, 'Erro ao remover.')); } finally { setBusy(null); }
  };

  return (
    <NoDelayGate authLoading={authLoading} isAuthenticated={isAuthenticated} denied={denied}>
      <div className="w-full px-3 sm:px-6 py-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-lime-500/30 to-lime-500/5 ring-1 ring-lime-500/30">
              <Rocket className="text-lime-300" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">NoDelay</h1>
                <span className="rounded-full bg-lime-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300 ring-1 ring-lime-500/30">Nível 2</span>
              </div>
              <p className="text-sm text-gray-400">Suas instâncias — cada uma agrupa casas e contas prontas para disparar.</p>
            </div>
          </div>
          <button onClick={create} disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-lime-400 disabled:opacity-50">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Nova instância
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200 ring-1 ring-rose-500/30">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Carregando…</div>
        ) : instances.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Layers className="mx-auto mb-3 text-gray-600" size={30} />
            <p className="text-sm text-gray-400">Nenhuma instância ainda.</p>
            <button onClick={create} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400">
              <Plus size={15} /> Criar a primeira
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {instances.map((inst) => {
              const houses = bookmakers.filter((b) => inst.houseSlugs.includes(b.slug));
              const instAccounts = accounts.filter((a) => inst.houseSlugs.includes(a.bookmakerSlug));
              const connectedCount = instAccounts.filter((a) => a.status === 'connected').length;
              const caixa = instAccounts.filter((a) => a.status === 'connected').reduce((s, a) => s + (a.balance ?? 0), 0);
              const temSaldo = instAccounts.some((a) => a.status === 'connected' && a.balance != null);
              return (
                <div key={inst.id} className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-lime-500/30">
                  <button onClick={() => router.push(`/nodelay/${inst.id}`)} className="flex w-full items-center gap-3 text-left">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-lime-500/10 ring-1 ring-lime-500/20">
                      <Layers size={18} className="text-lime-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{inst.name}</div>
                      {houses.length > 0 ? (
                        <div className="mt-1 flex items-center gap-1">
                          {houses.slice(0, 5).map((h) => (
                            <BookmakerLogo key={h.slug} name={h.name} slug={h.slug} logoUrl={h.logoUrl} color={h.color} size={18} />
                          ))}
                          {houses.length > 5 && <span className="text-[10px] text-gray-500">+{houses.length - 5}</span>}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500">Sem casas ainda</div>
                      )}
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} />
                        <span className={connectedCount > 0 ? 'font-semibold text-lime-300' : ''}>{connectedCount}</span> conectada{connectedCount === 1 ? '' : 's'}
                      </span>
                      {temSaldo && (
                        <span className="inline-flex items-center gap-1"><Wallet size={11} /> {formatMoney(caixa)}</span>
                      )}
                    </div>
                    <button onClick={() => remove(inst)} disabled={busy === inst.id} className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-rose-300 disabled:opacity-50" title="Remover instância">
                      {busy === inst.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NoDelayGate>
  );
}
