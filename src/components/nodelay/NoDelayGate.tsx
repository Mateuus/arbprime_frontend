import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Rocket, Lock, Loader2 } from 'lucide-react';

/**
 * Portaria do NoDelay: trata "carregando", "não logado" e "sem nível 3" antes de
 * deixar a página aparecer.
 *
 * `denied` vem do 403 do backend (requireLevel), não de um palpite do front:
 * assim quem perde o plano no meio da sessão cai aqui, sem depender do menu.
 */
interface Props {
  authLoading: boolean;
  isAuthenticated: boolean;
  denied: boolean;
  children: ReactNode;
}

export function NoDelayGate({ authLoading, isAuthenticated, denied, children }: Props) {
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
        <Loader2 className="animate-spin" size={18} /> Carregando…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card
        icon={<Rocket className="mx-auto text-lime-300" size={28} />}
        title="NoDelay"
        text="Entre na sua conta para conectar suas casas e apostar sem atraso."
      />
    );
  }

  if (denied) {
    return (
      <Card
        icon={<Lock className="mx-auto text-lime-300" size={28} />}
        title="Exclusivo do Nível 3"
        text="O NoDelay mantém suas contas logadas e prontas para disparar em várias casas ao mesmo tempo. Faça upgrade para liberar."
        action={
          <button
            onClick={() => router.push('/plans')}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-lime-400"
          >
            Ver planos
          </button>
        }
      />
    );
  }

  return <>{children}</>;
}

function Card({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        {icon}
        <h1 className="mt-3 text-lg font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-400">{text}</p>
        {action}
      </div>
    </div>
  );
}
