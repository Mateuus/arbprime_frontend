import { useState } from 'react';
import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { statusMeta, formatMoney, timeAgo } from '@/utils/nodelayUi';
import { Loader2, Plug, PlugZap, Trash2, Clock, AlertTriangle, ChevronDown, Pencil } from 'lucide-react';

/**
 * Conta de uma casa — linha COMPACTA por padrão (ponto de status + nome + saldo),
 * que EXPANDE ao clicar para revelar os detalhes (status, "logada há X", erro) e as
 * ações (Conectar/Desconectar, remover). Assim o drawer mostra muitas contas sem
 * rolar. Props/callbacks inalterados p/ os callers.
 */

interface Props {
  account: NoDelayAccount;
  busy?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  /** Abre o modal de edição (rótulo/usuário/senha). */
  onEdit?: () => void;
}

export function AccountCard({ account, busy, onConnect, onDisconnect, onRemove, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const m = statusMeta(account.status);
  const connected = account.status === 'connected';
  const name = account.label || account.username;

  return (
    <div className={`overflow-hidden rounded-lg border bg-white/[0.02] transition ${connected ? 'border-lime-500/25' : 'border-white/10'}`}>
      {/* Linha compacta: ponto de status + nome + saldo + chevron */}
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-white/[0.03]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} title={m.label} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">{name}</span>
        <span className={`shrink-0 text-xs font-semibold tabular-nums ${account.balance != null ? 'text-white' : 'text-gray-600'}`}>
          {formatMoney(account.balance, account.currency)}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-gray-500 transition ${expanded ? '' : '-rotate-90'}`} />
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-2.5 py-2">
          {/* Status + login (subtítulo) + tempo de sessão */}
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ring-1 ${m.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
            </span>
            {account.label && <span className="min-w-0 truncate text-gray-500">{account.username}</span>}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-gray-500">
              <Clock size={11} /> {connected ? timeAgo(account.sessionAt) : '—'}
            </span>
          </div>

          {account.lastError && !connected && (
            <div className="mb-2 flex items-start gap-1.5 text-[11px] text-rose-300/80" title={account.lastError}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{account.lastError}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {connected ? (
              <button
                disabled={busy}
                onClick={onDisconnect}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Desconectar
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={onConnect}
                className="inline-flex items-center gap-1.5 rounded-lg bg-lime-500/15 px-2.5 py-1.5 text-[11px] font-medium text-lime-200 ring-1 ring-lime-500/30 transition hover:bg-lime-500/25 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />} Conectar
              </button>
            )}
            {onEdit && (
              <button
                disabled={busy}
                onClick={onEdit}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                title="Editar conta (rótulo, usuário ou senha)"
              >
                <Pencil size={13} /> Editar
              </button>
            )}
            <button
              disabled={busy}
              onClick={onRemove}
              className={`${onEdit ? '' : 'ml-auto '}rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-rose-300 disabled:opacity-50`}
              title="Remover conta"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
