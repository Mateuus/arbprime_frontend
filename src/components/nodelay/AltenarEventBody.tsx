import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { useAltenarLiveEvent } from '@/hooks/useAltenarLiveEvent';
import { LiveScoreboard } from '@/components/nodelay/LiveScoreboard';
import { MarketBoard } from '@/components/nodelay/MarketBoard';
import { ArrowLeft, Loader2, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

/**
 * Corpo do evento AO VIVO de uma casa biahosted (Altenar) — placar + odds por
 * categoria, por polling REST. Reusado pela página standalone e pelo branch
 * biahosted da página de evento da instância. Só VISUALIZAÇÃO por enquanto (o
 * disparo entra depois; o placeBet do Altenar já está pronto no backend).
 */
export function AltenarEventBody({
  house, eventId, onBack, backLabel,
}: {
  house: NoDelayBookmaker | undefined;
  eventId: string;
  onBack: () => void;
  backLabel: string;
}) {
  const isBia = house?.platform === 'biahosted' && !!house?.oddsUrl;
  const { detail, loading, error, changed, live } = useAltenarLiveEvent(isBia ? house : undefined, eventId);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-lime-300">
          <ArrowLeft size={14} /> {backLabel}
        </button>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
            live ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30' : 'bg-white/5 text-gray-400 ring-white/10'
          }`}
          title={live ? 'Recebendo odds (polling)' : 'Sem conexão'}
        >
          {live ? <Wifi size={9} /> : <WifiOff size={9} />} {live ? 'ao vivo' : 'offline'}
        </span>
      </div>

      {!isBia ? (
        <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <AlertTriangle className="mx-auto text-amber-400" size={26} />
          <p className="mt-3 text-sm text-gray-300">Casa sem Host de odds Altenar configurado.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
          <Loader2 className="animate-spin" size={18} /> Carregando o jogo…
        </div>
      ) : error || !detail ? (
        <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <AlertTriangle className="mx-auto text-amber-400" size={26} />
          <p className="mt-3 text-sm text-gray-300">{error || 'Jogo indisponível.'}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          <LiveScoreboard game={detail} />
          <MarketBoard detail={detail} changed={changed} />
        </div>
      )}
    </>
  );
}
