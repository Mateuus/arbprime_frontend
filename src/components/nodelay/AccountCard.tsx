import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { statusMeta, formatMoney, timeAgo, initials } from '@/utils/nodelayUi';
import { Loader2, Plug, PlugZap, Trash2, Wallet, Clock, AlertTriangle } from 'lucide-react';

/**
 * Card de uma conta conectada: quem é, quanto tem, e há quanto tempo está logada
 * — as três coisas que o apostador olha antes de disparar.
 */

interface Props {
  account: NoDelayAccount;
  busy?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}

export function AccountCard({ account, busy, onConnect, onDisconnect, onRemove }: Props) {
  const m = statusMeta(account.status);
  const connected = account.status === 'connected';
  const name = account.label || account.username;

  return (
    <div
      className={`rounded-xl border bg-white/[0.03] p-4 transition ${
        connected ? 'border-lime-500/30 shadow-[0_0_0_1px_rgba(132,204,22,0.06)]' : 'border-white/10'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar: a casa não expõe foto, então usamos as iniciais do login. */}
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ${
            connected ? 'bg-lime-500/15 text-lime-300 ring-lime-500/30' : 'bg-white/5 text-gray-400 ring-white/10'
          }`}
        >
          {initials(name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{name}</div>
          {account.label && <div className="truncate text-[11px] text-gray-500">{account.username}</div>}
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${m.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
        </span>
      </div>

      {/* Saldo + tempo de sessão */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/20 px-3 py-2 ring-1 ring-white/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
            <Wallet size={11} /> Saldo
          </div>
          <div className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${account.balance != null ? 'text-white' : 'text-gray-600'}`}>
            {formatMoney(account.balance, account.currency)}
          </div>
        </div>
        <div className="rounded-lg bg-black/20 px-3 py-2 ring-1 ring-white/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500">
            <Clock size={11} /> Logada
          </div>
          <div className={`mt-0.5 truncate text-sm font-semibold ${connected ? 'text-white' : 'text-gray-600'}`}>
            {connected ? timeAgo(account.sessionAt) : '—'}
          </div>
        </div>
      </div>

      {account.lastError && !connected && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-300/80" title={account.lastError}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{account.lastError}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {connected ? (
          <button
            disabled={busy}
            onClick={onDisconnect}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Desconectar
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={onConnect}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500/15 px-3 py-1.5 text-xs font-medium text-lime-200 ring-1 ring-lime-500/30 transition hover:bg-lime-500/25 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Conectar
          </button>
        )}
        <button
          disabled={busy}
          onClick={onRemove}
          className="ml-auto rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-rose-300 disabled:opacity-50"
          title="Remover conta"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
