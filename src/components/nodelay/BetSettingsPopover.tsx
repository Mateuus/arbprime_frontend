import { useState } from 'react';
import { NoDelaySettings } from '@/hooks/useNoDelaySettings';
import { usePopover } from '@/components/ui/usePopover';
import { Settings, Minus, Plus } from 'lucide-react';

/**
 * Config de aposta (popover preso ao botão, padrão usePopover). Stake padrão,
 * aceitar valor parcial quando a casa limita, e aceitar mudança de odd (ligado
 * por padrão — o apostador ao vivo quer a entrada, não perder por 0,01).
 */
export function BetSettingsPopover({
  settings, onUpdate,
}: {
  settings: NoDelaySettings;
  onUpdate: (patch: Partial<NoDelaySettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const { pos, place, menuRef } = usePopover(open, () => setOpen(false), { align: 'right', width: 300 });
  const setStake = (v: number) => onUpdate({ defaultStake: Math.max(0.5, +v.toFixed(2)) });

  return (
    <>
      <button
        onClick={(e) => { if (!open) place(e.currentTarget); setOpen((v) => !v); }}
        className={`grid h-7 w-7 place-items-center rounded-lg ring-1 transition ${
          open ? 'bg-lime-500/15 text-lime-300 ring-lime-500/40' : 'bg-white/5 text-gray-400 ring-white/10 hover:bg-white/10 hover:text-gray-200'
        }`}
        title="Configurações de aposta"
      >
        <Settings size={14} />
      </button>

      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className="z-50 space-y-3 rounded-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Settings size={14} className="text-lime-300" /> Configurações
            </div>

            {/* Stake padrão */}
            <label className="block">
              <span className="text-[11px] text-gray-400">Stake padrão (por conta)</span>
              <div className="mt-1 flex items-center rounded-lg bg-black/30 ring-1 ring-white/10">
                <button onClick={() => setStake(settings.defaultStake - 1)} className="grid h-9 w-9 place-items-center text-gray-400 hover:text-white"><Minus size={14} /></button>
                <input
                  value={settings.defaultStake}
                  onChange={(e) => setStake(parseFloat(e.target.value.replace(',', '.')) || 0)}
                  inputMode="decimal"
                  className="flex-1 bg-transparent text-center text-sm font-bold tabular-nums text-white focus:outline-none"
                />
                <button onClick={() => setStake(settings.defaultStake + 1)} className="grid h-9 w-9 place-items-center text-gray-400 hover:text-white"><Plus size={14} /></button>
              </div>
            </label>

            {/* Ocultar mercados sem odd (o "Modo Delay Trade" mora só na Aposta Rápida) */}
            <Toggle
              label="Ocultar mercados sem odd"
              hint="Some com o '—' por natureza; o suspenso não some, aparece a odd quando destrava."
              on={settings.hidePriceless}
              onToggle={() => onUpdate({ hidePriceless: !settings.hidePriceless })}
            />

            {/* Aceitar mudança de odd */}
            <Toggle
              label="Aceitar mudança de odd"
              hint="Se a odd variar no envio, aposta mesmo assim (recomendado no ao vivo)."
              on={settings.acceptOddsChange}
              onToggle={() => onUpdate({ acceptOddsChange: !settings.acceptOddsChange })}
            />

            {/* Aceitar parcial */}
            <Toggle
              label="Aceitar valor parcial"
              hint="Se a casa não pegar o valor todo, aposta o máximo que ela aceitar."
              on={settings.allowPartial}
              onToggle={() => onUpdate({ allowPartial: !settings.allowPartial })}
            />
          </div>
        </>
      )}
    </>
  );
}

function Toggle({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-gray-200">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-gray-500">{hint}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${on ? 'bg-lime-500' : 'bg-white/15'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${on ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}
