import { useState } from 'react';
import { NoDelayBookmaker, NoDelayAccount } from '@/interfaces/nodelay.interface';
import { addAndConnectAccount, errorText, SuperbetMfa } from '@/services/nodelay/connect';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { X, Loader2, ShieldAlert, Lock, Rocket } from 'lucide-react';

/**
 * Modal de login de uma conta na casa.
 *
 * O FORMULÁRIO é escolhido pela `platform` da casa — hoje só 'swarm' (7games e
 * família), que pede usuário+senha. Quando entrar uma casa que precise de outra
 * coisa (código, CPF, captcha), some um caso aqui em vez de um modal novo.
 */

interface Props {
  house: NoDelayBookmaker;
  onClose: () => void;
  onDone: () => void;
  /** superbet: a conta foi criada mas a casa pediu 2º fator — abre o modal de MFA. */
  onMfa?: (account: NoDelayAccount, mfa: SuperbetMfa) => void;
}

const inputCls =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500/50 transition';

export function NoDelayLoginModal({ house, onClose, onDone, onMfa }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!username.trim() && !!password && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { account, mfa } = await addAndConnectAccount(house, { username: username.trim(), password, label: label.trim() || undefined });
      // superbet pediu 2º fator: a conta já está no cofre — passa a bola pro modal de MFA.
      if (mfa && onMfa) { onMfa(account, mfa); return; }
      onDone();
    } catch (e) {
      setError(errorText(e, 'Não foi possível conectar a conta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-brand-dark p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BookmakerLogo name={house.name} slug={house.slug} logoUrl={house.logoUrl} color={house.color} size={40} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-white">Conectar conta</h2>
              <p className="truncate text-xs text-gray-400">{house.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-white transition" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <label className="block text-xs text-gray-400">
            Usuário / e-mail
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              autoFocus
              placeholder="seu login na casa"
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-xs text-gray-400">
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className={`${inputCls} mt-1`}
            />
          </label>

          <label className="block text-xs text-gray-400">
            Apelido <span className="text-gray-600">(opcional)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Conta principal"
              className={`${inputCls} mt-1`}
            />
            <span className="mt-1 block text-[11px] text-gray-500">Ajuda a diferenciar quando você tiver várias contas na mesma casa.</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-gray-400 ring-1 ring-white/10">
            <Lock size={13} className="mt-0.5 shrink-0 text-lime-300" />
            <span>
              {house.platform === 'biahosted' || house.platform === 'superbet' || house.platform === 'bet365' ? (
                <>O login roda <span className="text-gray-200">nos nossos servidores</span> (a casa exige isso). A senha fica guardada criptografada no cofre para reconectar depois sem você redigitar.</>
              ) : (
                <>O login acontece <span className="text-gray-200">direto do seu navegador para a casa</span> — sem passar pelos nossos servidores. A senha fica guardada criptografada para reconectar depois sem você redigitar.</>
              )}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
