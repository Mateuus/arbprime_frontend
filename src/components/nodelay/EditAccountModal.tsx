import { useState } from 'react';
import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { apiGateway } from '@/gateways/api.gateway';
import { errorText } from '@/services/nodelay/connect';
import { X, Loader2, ShieldAlert, Check, AlertTriangle } from 'lucide-react';

/**
 * Modal de EDIÇÃO de uma conta já cadastrada — para quando o usuário troca a senha
 * (ou usuário/rótulo) na casa e precisa atualizar aqui sem apagar + recadastrar.
 *
 * Envia só os campos ALTERADOS: `label` sempre; `username` só se mudou; `password`
 * só se preenchido (em branco = mantém a atual — a senha nunca volta do backend).
 * Trocar usuário/senha invalida a sessão no backend (status → disconnected): o
 * usuário reconecta depois. O `label` sozinho não mexe na sessão.
 */

interface Props {
  account: NoDelayAccount;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const inputCls =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500/50 transition';

export function EditAccountModal({ account, onClose, onSaved }: Props) {
  const [label, setLabel] = useState(account.label ?? '');
  const [username, setUsername] = useState(account.username ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameChanged = username.trim() !== (account.username ?? '').trim();
  const credsChange = usernameChanged || password.length > 0;
  const canSubmit = !!username.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // Só os campos que mudaram: label sempre; username se mudou; password se preenchido.
      const payload: Partial<{ label: string | null; username: string; password: string }> = {
        label: label.trim() || null,
      };
      if (usernameChanged) payload.username = username.trim();
      if (password.length > 0) payload.password = password;

      const r = await apiGateway.updateNoDelayAccount(account.id, payload);
      if (r.data?.result !== 1) {
        setError(r.data?.message || 'Não foi possível salvar as alterações.');
        return;
      }
      await onSaved();
    } catch (e) {
      setError(errorText(e, 'Não foi possível salvar as alterações.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-brand-dark p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Editar conta</h2>
          <button onClick={onClose} className="text-gray-400 transition hover:text-white" aria-label="Fechar"><X size={18} /></button>
        </div>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="block text-xs text-gray-400">
            Rótulo <span className="text-gray-600">(opcional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Conta principal"
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-xs text-gray-400">
            Usuário / e-mail
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              placeholder="seu login na casa"
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-xs text-gray-400">
            Nova senha <span className="text-gray-600">(opcional)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="deixe em branco para manter a atual"
              className={`${inputCls} mt-1`}
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {credsChange && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300 ring-1 ring-amber-500/30">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Trocar usuário ou senha desconecta a conta — reconecte depois.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5">Cancelar</button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
