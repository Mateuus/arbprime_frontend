import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { NoDelayAccount } from '@/interfaces/nodelay.interface';
import { SuperbetMfa, errorText } from '@/services/nodelay/connect';
import { apiGateway } from '@/gateways/api.gateway';
import { X, Loader2, ShieldCheck, ShieldAlert, MessageSquare, ScanFace, Copy, Check } from 'lucide-react';

/**
 * Modal do 2º fator da Superbet ao conectar uma conta.
 *
 * A casa pode exigir SMS (código de 6 díg) e/ou selfie (Unico) — os dois juntos
 * no caso de reabertura. Ambos são FUNCIONAIS:
 *  - SMS: manda o código pro backend (completeSuperbetMfa).
 *  - Selfie: a Unico é travada por domínio, então NÃO abre em iframe aqui — o
 *    truque é abrir o link `mfa.faceidUrl` NO CELULAR (top-level, sem domain-lock)
 *    via QR/copiar-link; o usuário faz a selfie no telefone e o front faz POLL de
 *    `getSuperbetFaceidStatus` até virar `active`. Aí o completeSuperbetMfa
 *    server-side confirma a selfie e injeta o otp do faceid no re-login → conecta.
 */

interface Props {
  account: NoDelayAccount;
  mfa: SuperbetMfa;
  onClose: () => void;
  /** Chamado quando o MFA foi aceito — o pai recarrega + fecha. */
  onDone: () => void;
}

/** Mascara o telefone deixando só os últimos dígitos à mostra. Ex.: •••••1234. */
function maskPhone(phone: string | null): string {
  if (!phone) return 'seu telefone cadastrado';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  return `••••${digits.slice(-4)}`;
}

const OTP_LEN = 6;

export function SuperbetMfaModal({ account, mfa, onClose, onDone }: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceidActive, setFaceidActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const showSms = mfa.hasSms;
  const showFaceid = mfa.hasFaceid;
  const faceidUrl = mfa.faceidUrl ?? null;
  const bothSteps = showSms && showFaceid;

  const code = digits.join('');
  const smsOk = showSms ? code.length === OTP_LEN : true;
  const faceidOk = showFaceid ? faceidActive : true;
  const canSubmit = smsOk && faceidOk && !busy;

  // POLL da selfie: enquanto o bloco do faceid está visível e ainda não confirmou,
  // pergunta ao backend a cada 3s se a selfie foi feita no celular. Para sozinho ao
  // virar `active` (o effect re-roda e cai no early-return) e no unmount/close.
  useEffect(() => {
    if (!showFaceid || !faceidUrl || faceidActive) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiGateway.getSuperbetFaceidStatus(account.id);
        if (!cancelled && res.data?.result === 1 && res.data?.data?.active) {
          setFaceidActive(true);
        }
      } catch { /* rede instável não é erro — segue tentando */ }
    };
    void check(); // primeira checagem imediata
    const iv = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [showFaceid, faceidUrl, faceidActive, account.id]);

  const setDigitAt = (i: number, v: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };

  const handleChange = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (!only) { setDigitAt(i, ''); return; }
    // Cola de código inteiro: distribui a partir da casa atual.
    if (only.length > 1) {
      setDigits((prev) => {
        const next = [...prev];
        for (let k = 0; k < only.length && i + k < OTP_LEN; k++) next[i + k] = only[k];
        return next;
      });
      const last = Math.min(i + only.length, OTP_LEN - 1);
      inputsRef.current[last]?.focus();
      return;
    }
    setDigitAt(i, only);
    if (i < OTP_LEN - 1) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const copyLink = useCallback(async () => {
    if (!faceidUrl) return;
    try {
      await navigator.clipboard.writeText(faceidUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard bloqueado — o QR ainda resolve */ }
  }, [faceidUrl]);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      // faceid-only: `code` vai vazio; o backend confirma só pela selfie.
      // TODO(faceid-only): se o back exigir algo além do code vazio, ajustar o contrato.
      const res = await apiGateway.completeSuperbetMfa(account.id, code);
      if (res.data?.result === 1) {
        onDone();
        return;
      }
      // Ex.: código errado/expirado, ou "faltou a selfie: abra o link no celular…".
      setError(res.data?.message || 'Não foi possível concluir. Tente novamente.');
    } catch (e) {
      setError(errorText(e, 'Não foi possível concluir a verificação.'));
    } finally {
      setBusy(false);
    }
  };

  const name = account.label || account.username;
  const submitLabel = showFaceid ? 'Concluir' : 'Verificar';

  const otpBoxCls =
    'h-11 w-9 rounded-lg border border-white/10 bg-black/30 text-center text-lg font-semibold text-white ' +
    'focus:outline-none focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500/50 transition disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-brand-dark p-5 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-500/10 ring-1 ring-lime-500/20">
              <ShieldCheck className="text-lime-300" size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-white">Verificação em duas etapas</h2>
              <p className="truncate text-xs text-gray-400">Superbet · {name}</p>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-white transition" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {/* SMS — código de 6 dígitos */}
          {showSms && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-gray-300 ring-1 ring-white/10">
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-lime-300" />
                <span>
                  {bothSteps && <span className="font-semibold text-white">1. </span>}
                  Enviamos um código para <span className="font-semibold text-white">{maskPhone(mfa.phone)}</span>. Digite os 6 dígitos abaixo.
                </span>
              </div>

              <div className="flex justify-center gap-1.5">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    autoFocus={i === 0}
                    maxLength={OTP_LEN}
                    disabled={busy}
                    className={otpBoxCls}
                    aria-label={`Dígito ${i + 1}`}
                  />
                ))}
              </div>

              <p className="text-[11px] text-gray-500">
                Não recebeu? Feche e clique em <span className="text-gray-300">Conectar</span> de novo — reconectar dispara um novo SMS
                (o código vale por poucos minutos).
              </p>
            </div>
          )}

          {/* Selfie (Unico) — QR pro celular + poll */}
          {showFaceid && (
            <div className={showSms ? 'mt-5 border-t border-white/10 pt-4' : ''}>
              <div className="mb-2 flex items-center gap-2">
                <ScanFace size={15} className="text-emerald-300" />
                <h3 className="text-sm font-semibold text-white">
                  {bothSteps && <span className="text-white">2. </span>}Verificação por selfie (Unico)
                </h3>
                {showSms && <span className="text-[11px] text-gray-500">obrigatória</span>}
              </div>

              {faceidUrl ? (
                faceidActive ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-3 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                    <Check size={16} className="shrink-0" /> Selfie confirmada
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-center text-[11px] text-gray-400">
                      Aponte a câmera do seu celular e faça a selfie (Unico).
                    </p>
                    <div className="rounded-xl bg-white p-4">
                      {/* URL curta (id.unico.io/process/<id>) → QR esparso e fácil de ler.
                          marginSize = zona de silêncio (ajuda a câmera); level M = robusto. */}
                      <QRCodeSVG value={faceidUrl} size={208} level="M" marginSize={2} />
                    </div>
                    <p className="text-center text-xs font-semibold text-white">Escaneie com o celular</p>

                    {/* Já está no celular? copia o link direto. */}
                    <div className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-2 py-1.5 text-[11px] text-gray-500 ring-1 ring-white/10" title={faceidUrl}>
                        {faceidUrl}
                      </span>
                      <button
                        type="button"
                        onClick={copyLink}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25"
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar link'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Loader2 size={12} className="animate-spin" /> Aguardando a selfie no celular…
                    </div>
                  </div>
                )
              ) : (
                /* Backend não conseguiu iniciar a selfie → volta pro caminho honesto. */
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-4 text-center">
                  <ScanFace size={24} className="mx-auto mb-2 text-amber-300/80" />
                  <p className="text-sm font-medium text-amber-200">Faça a verificação no app da Superbet</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[11px] leading-relaxed text-gray-400">
                    Não foi possível iniciar a verificação por selfie aqui. Reative/verifique sua conta no
                    app da Superbet; contas <b className="text-gray-200">ativas</b> conectam normalmente por aqui.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-rose-500/30">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {busy ? 'Concluindo…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
