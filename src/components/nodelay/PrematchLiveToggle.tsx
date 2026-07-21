import { Radio, CalendarClock } from 'lucide-react';

/**
 * Alternador segmentado Prematch | Ao Vivo no topo do quadro de odds.
 * "Ao Vivo" = o board real que espelha a casa (EventBoard). "Prematch" = board de
 * pré-jogo (por ora com dados de exemplo; futuro: catálogo /events). Acento lime
 * do NoDelay no segmento ativo.
 */

export type BoardMode = 'live' | 'prematch';

export function PrematchLiveToggle({ mode, onChange }: { mode: BoardMode; onChange: (m: BoardMode) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-black/30 p-0.5 ring-1 ring-white/10">
      <Segment on={mode === 'prematch'} onClick={() => onChange('prematch')}>
        <CalendarClock size={13} /> Prematch
      </Segment>
      <Segment on={mode === 'live'} onClick={() => onChange('live')}>
        <Radio size={13} className={mode === 'live' ? 'animate-pulse' : ''} /> Ao Vivo
      </Segment>
    </div>
  );
}

function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
        on ? 'bg-lime-500/20 text-lime-200 ring-1 ring-lime-500/40' : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
