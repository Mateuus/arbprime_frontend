import React from 'react';
import { RefreshCw, Zap, Server as ServerIcon } from 'lucide-react';
import { useServer } from '@/hooks/useServer';
import { Select, SelectOption } from '@/components/ui/Select';
import type { ServerPreference } from '@/services/serverManager';

interface ServerSelectorProps {
  /** Compacto: usado no modal de login — renderiza um Select (dropdown). */
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
 * - No login (`compact`) vira um Select/dropdown enxuto.
 * - Na aba "Servidor" do modal de conta, mostra cards com detalhes.
 *
 * Em ambiente local (dev) não há o que escolher, então o componente não renderiza.
 */
const ServerSelector: React.FC<ServerSelectorProps> = ({ compact = false, className = '' }) => {
  const { preference, activeId, latencies, pinging, servers, isLocal, setPreference, refresh } = useServer();

  if (isLocal) return null;

  const activeLabel = servers.find((s) => s.id === activeId)?.label;

  const options: { value: ServerPreference; label: string }[] = [
    { value: 'auto', label: 'Automático' },
    ...servers.map((s) => ({
      value: s.id as ServerPreference,
      label: s.label,
    })),
  ];

  // Conteúdo de uma opção (usado tanto na lista quanto no botão do Select).
  const optionNode = (value: ServerPreference, label: string) => {
    const isAuto = value === 'auto';
    const ms = isAuto ? latencies[activeId] : latencies[value as string];
    return (
      <span className="flex w-full items-center gap-2">
        {isAuto ? <Zap size={14} className="shrink-0 text-green-400" /> : <StatusDot ms={ms} />}
        <span className="font-medium text-white">{label}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {isAuto && activeLabel && <span className="text-gray-500">{activeLabel}</span>}
          <span className={`font-mono ${ms === null ? 'text-red-400' : 'text-gray-300'}`}>{pingLabel(ms)}</span>
        </span>
      </span>
    );
  };

  const selectOptions: SelectOption[] = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    node: optionNode(opt.value, opt.label),
  }));

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

      <Select
        value={preference}
        onChange={(v) => setPreference(v as ServerPreference)}
        options={selectOptions}
        className="w-full"
        buttonClassName={compact ? '!bg-[#263a3a] !border-transparent' : '!bg-brand-dark !border-[#2b534f83]'}
        title="Escolher servidor"
      />

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
