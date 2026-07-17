import { useEffect, useState } from 'react';
import { NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { resolveRadarUuid, radarUrl } from '@/services/nodelay/radar';
import { Radar, ChevronDown } from 'lucide-react';

/**
 * Radar do jogo (widget "Live Tracker" da TheSports, embutido por iframe).
 *
 * A casa serve o widget sem X-Frame-Options, sem CSP frame-ancestors e sem
 * allowlist de referer, então o embed cross-origin funciona (testado).
 *
 * O `profile` é a assinatura da casa com a TheSports e é POR ESPORTE — vem da
 * config do admin, nunca hardcoded, porque ele rotaciona. Se ele não colar, o
 * widget NÃO dá erro: ele mostra "assinatura vencida", o que pareceria bug
 * NOSSO. Por isso existe o fallback: some o profile e recarrega na versão 2D,
 * que funciona sempre.
 */

interface Props {
  house: NoDelayBookmaker;
  /** eventId da FSB — a chave do mapa de radar (não é o game.id do swarm). */
  fsbEventId: string | null;
  sportId: string;
}

export function MatchRadar({ house, fsbEventId, sportId }: Props) {
  const [uuid, setUuid] = useState<string | null>(null);
  // Sem eventId da FSB não há radar possível — já nasce resolvido.
  const [state, setState] = useState<'loading' | 'ok' | 'none'>(fsbEventId ? 'loading' : 'none');
  const [noProfile, setNoProfile] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!fsbEventId) return;
     
    void (async () => {
      const u = await resolveRadarUuid(house, fsbEventId);
      if (!alive) return;
      setUuid(u);
      setState(u ? 'ok' : 'none');
    })();
    return () => { alive = false; };
  }, [house, fsbEventId]);

  if (state === 'none') return null;

  const src = uuid ? radarUrl(house, sportId, uuid, { withProfile: !noProfile }) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <Radar size={12} className="text-lime-300" /> Radar
        </span>
        <ChevronDown size={14} className={`text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/5">
          {state === 'loading' || !src ? (
            <div className="h-[220px] animate-pulse bg-black/20" />
          ) : (
            <iframe
              key={src}
              src={src}
              title="Radar do jogo"
              className="h-[260px] w-full border-0 sm:h-[300px]"
              allow="autoplay"
              // Sandbox: o widget é de terceiro. Ele precisa de scripts e das
              // próprias XHR (same-origin dele), mas não tem por que navegar a
              // nossa página nem abrir popup.
              sandbox="allow-scripts allow-same-origin"
              onError={() => setNoProfile(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
