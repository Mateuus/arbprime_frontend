import { useState } from 'react';
import { NoDelayBookmaker, NoDelayCheckResult } from '@/interfaces/nodelay.interface';
import { refreshAllAccounts, errorText } from '@/services/nodelay/connect';
import { usePopover } from '@/components/ui/usePopover';
import { formatMoney } from '@/utils/nodelayUi';
import { RefreshCcw, Loader2, CheckCircle2, AlertTriangle, XCircle, Settings, ChevronDown } from 'lucide-react';

/**
 * Configurações do NoDelay — popover preso ao botão (mesmo padrão do Filtros do
 * /arbbets, via usePopover: fixed + clamp na viewport, então não estoura no
 * mobile). Não é modal central de propósito.
 *
 * Ação única hoje: "Atualizar", que varre TODAS as contas de TODAS as casas e
 * responde o que o painel sozinho não responde — as contas continuam logadas? O
 * card mostra o último estado conhecido, mas a casa derruba a sessão sem avisar.
 */

interface Props {
  houses: NoDelayBookmaker[];
  /** Recarrega os cards da página com o que a verificação gravou. */
  onRefreshed: () => void;
}

export function NoDelaySettingsPopover({ houses, onRefreshed }: Props) {
  const [open, setOpen] = useState(false);
  const { pos, place, menuRef } = usePopover(open, () => setOpen(false), { align: 'right', width: 340 });

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<NoDelayCheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
    try {
      const r = await refreshAllAccounts(houses, (done, total) => setProgress({ done, total }));
      setResults(r);
      onRefreshed();
    } catch (e) {
      setError(errorText(e, 'Não foi possível atualizar as contas.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const alive = results?.filter((r) => r.state === 'alive').length ?? 0;
  const expired = results?.filter((r) => r.state === 'expired').length ?? 0;
  const failed = results?.filter((r) => r.state === 'error').length ?? 0;

  return (
    <>
      <button
        onClick={(e) => { if (!open) place(e.currentTarget); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
          open ? 'border-lime-500/40 bg-lime-500/15 text-lime-200' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
        }`}
        title="Configurações"
      >
        <Settings size={15} />
        <span className="hidden sm:inline">Configurações</span>
        <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && (
        <>
          {/* Clique fora fecha. Não fecha durante a verificação: o usuário
              perderia o resultado que ele pediu no meio do caminho. */}
          <div className="fixed inset-0 z-40" onClick={() => { if (!busy) setOpen(false); }} />
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className="z-50 max-h-[80vh] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <Settings size={13} className="text-lime-300" />
              <span className="text-sm font-semibold text-white">Configurações</span>
            </div>

            {/* Atualizar */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">Atualizar contas</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                    Verifica todas as contas, de todas as casas, e mostra quais continuam logadas — atualizando o saldo de quebra.
                  </p>
                </div>
                <button
                  onClick={run}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lime-500 px-2.5 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-lime-400 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                  {busy ? '…' : 'Atualizar'}
                </button>
              </div>

              {busy && progress && progress.total > 0 && (
                <div className="mt-2.5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime-400 transition-all"
                      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] tabular-nums text-gray-500">
                    {progress.done} de {progress.total} contas
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-300 ring-1 ring-rose-500/30">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            {results && (
              results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[11px] text-gray-500">
                  Nenhuma conta conectada para verificar.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 ring-1 ring-emerald-500/30">
                      {alive} logada{alive === 1 ? '' : 's'}
                    </span>
                    {expired > 0 && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-300 ring-1 ring-amber-500/30">
                        {expired} caiu{expired === 1 ? '' : 'ram'}
                      </span>
                    )}
                    {failed > 0 && (
                      <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-rose-300 ring-1 ring-rose-500/30">
                        {failed} sem resposta
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
                    {results.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 bg-white/[0.02] px-2.5 py-2">
                        {r.state === 'alive' ? (
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                        ) : r.state === 'expired' ? (
                          <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                        ) : (
                          <XCircle size={13} className="shrink-0 text-rose-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] text-white">{r.name}</div>
                          <div className="truncate text-[9px] uppercase tracking-wide text-gray-600">{r.bookmakerSlug}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          {r.state === 'alive' ? (
                            <span className="text-[11px] font-semibold tabular-nums text-white">
                              {formatMoney(r.balance ?? null, r.currency)}
                            </span>
                          ) : (
                            <span className={`text-[10px] ${r.state === 'expired' ? 'text-amber-300' : 'text-rose-300'}`}>
                              {r.message}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {expired > 0 && (
                    <p className="text-[10px] leading-snug text-gray-500">
                      As contas que caíram voltam com o botão <span className="text-lime-300">Conectar</span> no card.
                    </p>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}
    </>
  );
}
