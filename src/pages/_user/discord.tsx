import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import apiGateway from '@/gateways/api.gateway';

/**
 * Aba "Discord" do modal de conta.
 *
 * Vincula a conta do site à do Discord (OAuth2). Com o vínculo feito, o bot
 * entra o usuário no servidor e aplica o cargo do plano ativo — e tira quando
 * a assinatura vence. O retorno do OAuth cai aqui de volta via `?discord=...`.
 */

interface DiscordStatus {
  available: boolean;
  linked: boolean;
  inGuild: boolean;
  discordId: string | null;
  discordUsername: string | null;
  linkedAt: string | null;
}

// Mensagens do callback do backend (query `discord`).
const CALLBACK_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  ok: { text: 'Conta do Discord vinculada com sucesso!', ok: true },
  cancelado: { text: 'Você cancelou a autorização no Discord.', ok: false },
  expirado: { text: 'O pedido expirou. Tente vincular novamente.', ok: false },
  ja_vinculado: { text: 'Esta conta do Discord já está vinculada a outro usuário.', ok: false },
  erro: { text: 'Não foi possível concluir o vínculo. Tente de novo.', ok: false },
};

const DiscordSettings = () => {
  const router = useRouter();
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'link' | 'unlink' | 'sync' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiGateway.getDiscordStatus();
      if (data?.result === 1) setStatus(data.data);
    } catch {
      setFeedback({ text: 'Falha ao carregar o status do Discord.', ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Resultado do callback do OAuth: mostra o aviso e limpa a query pra não
  // reaparecer a cada re-render/refresh.
  useEffect(() => {
    const result = router.query.discord as string | undefined;
    if (!result) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(CALLBACK_MESSAGES[result] ?? CALLBACK_MESSAGES.erro);
    const { discord, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
  }, [router]);

  const handleLink = async () => {
    setBusy('link');
    try {
      const { data } = await apiGateway.getDiscordLinkUrl();
      if (data?.result === 1 && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
        return;
      }
      setFeedback({ text: data?.message || 'Integração indisponível no momento.', ok: false });
    } catch {
      setFeedback({ text: 'Não foi possível iniciar o vínculo.', ok: false });
    }
    setBusy(null);
  };

  const handleUnlink = async () => {
    setBusy('unlink');
    try {
      await apiGateway.unlinkDiscord();
      setFeedback({ text: 'Conta desvinculada. Seus cargos foram removidos.', ok: true });
      await load();
    } catch {
      setFeedback({ text: 'Falha ao desvincular.', ok: false });
    }
    setBusy(null);
  };

  const handleSync = async () => {
    setBusy('sync');
    try {
      const { data } = await apiGateway.syncDiscordRoles();
      setFeedback({ text: data?.message || 'Cargos sincronizados.', ok: data?.result === 1 });
      await load();
    } catch {
      setFeedback({ text: 'Falha ao sincronizar os cargos.', ok: false });
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> Carregando…
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className="rounded-lg border border-[#2b534f83] bg-[#0f2322] p-4 text-sm text-gray-300">
        A integração com o Discord ainda não está disponível. Volte em breve.
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.ok
              ? 'border-green-500/40 bg-green-500/10 text-green-300'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.ok ? <Check size={16} className="mt-0.5" /> : <AlertTriangle size={16} className="mt-0.5" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Cartão de estado do vínculo */}
      <div className="flex items-center justify-between rounded-lg border border-[#2b534f83] bg-gradient-to-r from-[#114646] to-[#072b2e] px-4 py-3">
        <div className="flex items-center gap-3">
          <FaDiscord size={22} className="text-[#5865F2]" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide text-gray-400">
              {status.linked ? 'Conectado como' : 'Discord'}
            </span>
            <span className="text-sm font-semibold text-white">
              {status.linked ? status.discordUsername : 'Nenhuma conta vinculada'}
            </span>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            status.linked ? 'bg-green-500/15 text-green-300' : 'bg-gray-500/15 text-gray-400'
          }`}
        >
          {status.linked ? 'Vinculado' : 'Desconectado'}
        </span>
      </div>

      {status.linked && !status.inGuild && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <AlertTriangle size={16} className="mt-0.5" />
          <span>
            Sua conta está vinculada, mas você não está no nosso servidor. Entre no servidor para receber o
            cargo do seu plano.
          </span>
        </div>
      )}

      <p className="text-sm leading-relaxed text-gray-400">
        Ao vincular sua conta, você entra automaticamente no nosso servidor e recebe o cargo do seu plano,
        que libera as salas exclusivas. Se a assinatura vencer, o cargo é removido — e volta assim que você
        renovar.
      </p>

      <div className="flex flex-wrap gap-3">
        {!status.linked ? (
          <button
            onClick={handleLink}
            disabled={busy === 'link'}
            className="flex items-center gap-2 rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4752c4] disabled:opacity-60"
          >
            {busy === 'link' ? <Loader2 size={16} className="animate-spin" /> : <FaDiscord size={16} />}
            Conectar Discord
            <ExternalLink size={14} />
          </button>
        ) : (
          <>
            <button
              onClick={handleSync}
              disabled={busy === 'sync'}
              className="flex items-center gap-2 rounded-xl bg-[#1c3733] px-5 py-3 text-sm font-semibold text-[#b6cfc8] hover:bg-[#24433e] disabled:opacity-60"
            >
              {busy === 'sync' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sincronizar cargos
            </button>
            <button
              onClick={handleUnlink}
              disabled={busy === 'unlink'}
              className="flex items-center gap-2 rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              {busy === 'unlink' ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
              Desvincular
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DiscordSettings;
