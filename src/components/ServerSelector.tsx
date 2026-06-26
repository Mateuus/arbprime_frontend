import React from 'react';
import { RefreshCw, Zap, Server as ServerIcon } from 'lucide-react';
import { useServer } from '@/hooks/useServer';
import type { ServerPreference } from '@/services/serverManager';

interface ServerSelectorProps {
  /** Compacto: usado no modal de login (menos texto). */
  compact?: boolean;
  className?: string;
}

/** Bolinha de status conforme latência. */
function StatusDot({ ms }: { ms: number | null | undefined }) {
  let color = 'bg-gray-500';
  if (ms != null) {
    if (ms < 150) color = 'bg-green-500';
    else if (ms < 400) color = 'bg-yellow-500';
    else color = 'bg-orange-500';
  } else if (ms === null) {
    color = 'bg-red-500';
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

function pingLabel(ms: number | null | undefined): string {
  if (ms === undefined) return '—';
  if (ms === null) return 'offline';
  return `${ms} ms`;
}

/**
 * Seletor de servidor (Principal / Secundário / Automático) com ping ao vivo.
 * Reutilizado no login e na aba "Servidor" do modal de conta.
 *
 * Em ambiente local (dev) não há o que escolher, então o componente não renderiza.
 */
const ServerSelector: React.FC<ServerSelectorProps> = ({ compact = false, className = '' }) => {
  const { preference, activeId, latencies, pinging, servers, isLocal, setPreference, refresh } = useServer();

  if (isLocal) return null;

  const options: { value: ServerPreference; label: string; sub: string }[] = [
    { value: 'auto', label: 'Automático', sub: 'Melhor ping + failover' },
    ...servers.map((s) => ({
      value: s.id as ServerPreference,
      label: s.label,
      sub: s.apiUrl.replace(/^https?:\/\//, ''),
    })),
  ];

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <ServerIcon size={14} /> Servidor
        </span>
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          title="Medir latência novamente"
        >
          <RefreshCw size={13} className={pinging ? 'animate-spin' : ''} /> {pinging ? 'medindo' : 'testar'}
        </button>
      </div>

      <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-1'} gap-2`}>
        {options.map((opt) => {
          const isAuto = opt.value === 'auto';
          const selected = preference === opt.value;
          // Para 'auto', mostramos o ping do servidor que está ativo no momento.
          const ms = isAuto ? latencies[activeId] : latencies[opt.value as string];
          const isActiveServer = !isAuto && opt.value === activeId;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreference(opt.value)}
              className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors
                ${selected
                  ? 'border-green-400 bg-gradient-to-r from-[#0f2322] to-[#0f23220e]'
                  : 'border-[#2b534f83] bg-brand-dark hover:border-green-700'}`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {isAuto ? <Zap size={14} className="text-green-400" /> : <StatusDot ms={ms} />}
                  {opt.label}
                </span>
                {!isAuto && (
                  <span className={`text-xs font-mono ${ms === null ? 'text-red-400' : 'text-gray-300'}`}>
                    {pingLabel(ms)}
                  </span>
                )}
              </div>
              {!compact && (
                <span className="flex w-full items-center justify-between text-[11px] text-gray-500">
                  <span className="truncate">{opt.sub}</span>
                  {isAuto && isActiveServer === false && (
                    <span className="ml-2 shrink-0 text-gray-400">→ {servers.find((s) => s.id === activeId)?.label}</span>
                  )}
                </span>
              )}
              {compact && isAuto && (
                <span className="text-[11px] text-gray-500">ativo: {servers.find((s) => s.id === activeId)?.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-2 text-[11px] leading-snug text-gray-500">
          No modo <strong className="text-gray-400">Automático</strong> usamos o servidor de menor latência e trocamos
          sozinho se ele cair. Fixando um servidor, ainda fazemos failover e voltamos a ele quando normalizar.
        </p>
      )}
    </div>
  );
};

export default ServerSelector;
