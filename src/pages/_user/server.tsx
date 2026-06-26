import React from 'react';
import { Activity } from 'lucide-react';
import ServerSelector from '@/components/ServerSelector';
import { useServer } from '@/hooks/useServer';

/**
 * Aba "Servidor" do modal de conta: o usuário escolhe entre Principal,
 * Secundário ou Automático e acompanha a latência de cada um em tempo real.
 */
const ServerSettings = () => {
  const { isLocal, activeId, servers, latencies } = useServer();

  if (isLocal) {
    return (
      <div className="rounded-lg border border-[#2b534f83] bg-[#0f2322] p-4 text-sm text-gray-300">
        Você está em ambiente <strong className="text-white">local (desenvolvimento)</strong>. A seleção de
        servidor só fica disponível em produção.
      </div>
    );
  }

  const activeLabel = servers.find((s) => s.id === activeId)?.label ?? activeId;
  const activeMs = latencies[activeId];

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-[#2b534f83] bg-gradient-to-r from-[#114646] to-[#072b2e] px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-green-400" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide text-gray-400">Conectado em</span>
            <span className="text-sm font-semibold text-white">{activeLabel}</span>
          </div>
        </div>
        <span className={`font-mono text-sm ${activeMs === null ? 'text-red-400' : 'text-green-300'}`}>
          {activeMs === null ? 'offline' : activeMs === undefined ? '—' : `${activeMs} ms`}
        </span>
      </div>

      <ServerSelector />
    </div>
  );
};

export default ServerSettings;
