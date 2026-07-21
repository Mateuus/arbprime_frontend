import { useMemo } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { NoDelaySettings } from '@/hooks/useNoDelaySettings';
import { useNoDelayFire, HOUSE_MIN } from '@/hooks/useNoDelayFire';
import { selectionLabel, scoreOf, clockOf, fmtOdd } from '@/utils/nodelayLive';
import { formatMoney } from '@/utils/nodelayUi';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { X, Minus, Plus, Check, Lock, Zap } from 'lucide-react';

/**
 * Cupom de Apostas (Betslip) — bottom sheet compartilhado por TODA casa, prematch e
 * ao vivo. Abre ao tocar numa odd quando o "Disparo direto" está DESLIGADO (com ele
 * ligado a aposta sai na hora, sem cupom). NÃO é usado na Aposta Rápida.
 *
 * Mostra a seleção + as "Contas Prontas" (marcadas) com a odd de CADA casa, o stake
 * e o retorno; confirma → dispara client-side em todas as casas de uma vez (motor
 * `useNoDelayFire`, o mesmo da Aposta Rápida). O resultado aparece no BetSlipDrawer
 * (a página é dona do `fire`), então aqui o cupom só monta e confirma.
 */
interface Props {
  pick: { m: LiveMarket; s: LiveSelection };
  detail: LiveGameDetail;
  /** Motor de disparo da página (dono dos slips + drawer de resultado). */
  fire: ReturnType<typeof useNoDelayFire>;
  houseBySlug: Map<string, NoDelayBookmaker>;
  getHousePrice: (slug: string, selId: string) => HousePrice | undefined;
  connected: NoDelayAccount[];
  selectedIds: Set<string>;
  onToggleAccount: (id: string) => void;
  settings: NoDelaySettings;
  onUpdateSettings: (patch: Partial<NoDelaySettings>) => void;
  onClose: () => void;
}

export function BetSlip({
  pick, detail, fire, houseBySlug, getHousePrice, connected, selectedIds, onToggleAccount, settings, onUpdateSettings, onClose,
}: Props) {
  const { m, s } = pick;
  const betting = useMemo(() => connected.filter((a) => selectedIds.has(a.id)), [connected, selectedIds]);

  const score = scoreOf(detail);
  const clock = clockOf(detail);
  const eventName = `${detail.home} x ${detail.away}`;

  // Re-lê a odd VIVA (a de agora, não a congelada do toque): se suspendeu entre o
  // toque e a confirmação, bloqueia o disparo (não aposta morto).
  const liveMkt = detail.markets.find((mm) => mm.id === m.id);
  const liveSel = liveMkt?.selections.find((ss) => ss.id === s.id);
  const dead = !liveSel || !!liveMkt?.suspended || liveSel.disabled || (liveSel.price ?? 0) <= 0;

  const rows = useMemo(() => fire.preview(m, s), [fire, m, s]);
  const byAccount = useMemo(() => new Map(rows.map((r) => [r.account.id, r])), [rows]);
  const totalStake = rows.reduce((acc, r) => acc + (r.blocked ? 0 : r.stake), 0);
  const totalReturn = rows.reduce((acc, r) => acc + r.potential, 0);

  const setStake = (v: number) => onUpdateSettings({ defaultStake: Math.max(HOUSE_MIN, +v.toFixed(2)) });
  const canFire = betting.length > 0 && !dead;

  const confirm = () => { fire.doFire(m, s); onClose(); };

  return (
    <div className="fixed inset-0 z-[9995] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[86vh] w-full flex-col rounded-t-2xl border-t border-white/10 bg-brand-dark shadow-2xl sm:mx-auto sm:max-w-lg animate-[slideUp_.18s_ease-out]"
      >
        {/* Alça + cabeçalho */}
        <div className="shrink-0 px-4 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex items-center gap-2 pb-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-500/15 ring-1 ring-lime-500/30">
              <Zap size={14} className="text-lime-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">Cupom de Apostas</div>
              <div className="flex items-center gap-1.5 truncate text-[11px] text-gray-400">
                <span className="truncate">{eventName}</span>
                {clock && <span className="shrink-0 font-semibold text-lime-300">{clock}</span>}
                {score && <span className="shrink-0 text-gray-300">{score.home}-{score.away}</span>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 transition hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {/* Seleção */}
          <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">{selectionLabel(s.name, s.points)}</div>
                <div className="truncate text-[11px] text-gray-500">{m.name}</div>
              </div>
              <div className="shrink-0 text-lg font-bold tabular-nums text-amber-400">
                {dead ? <span className="inline-flex items-center gap-1 text-rose-300"><Lock size={15} /></span> : fmtOdd(liveSel!.price)}
              </div>
            </div>
            {dead && <p className="mt-1.5 text-[10px] text-rose-300/80">Mercado suspendeu — feche e toque de novo quando reabrir.</p>}
          </div>

          {/* Stake */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-gray-400">Valor por conta</span>
            <div className={`ml-auto flex items-center rounded-lg bg-black/30 ring-1 ring-white/10 ${settings.maxStakeMode ? 'opacity-40' : ''}`}>
              <button onClick={() => setStake(settings.defaultStake - 1)} disabled={settings.maxStakeMode} className="grid h-8 w-8 place-items-center text-gray-400 hover:text-white disabled:cursor-not-allowed"><Minus size={14} /></button>
              <input
                value={settings.defaultStake}
                onChange={(e) => setStake(parseFloat(e.target.value.replace(',', '.')) || 0)}
                inputMode="decimal"
                disabled={settings.maxStakeMode}
                className="w-16 bg-transparent text-center text-sm font-bold tabular-nums text-white focus:outline-none"
              />
              <button onClick={() => setStake(settings.defaultStake + 1)} disabled={settings.maxStakeMode} className="grid h-8 w-8 place-items-center text-gray-400 hover:text-white disabled:cursor-not-allowed"><Plus size={14} /></button>
            </div>
            <button
              onClick={() => onUpdateSettings({ maxStakeMode: !settings.maxStakeMode })}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${settings.maxStakeMode ? 'bg-lime-500 text-slate-900 ring-lime-400' : 'bg-white/5 text-gray-300 ring-white/10 hover:bg-white/10'}`}
              title="Apostar o máximo de cada conta (limitado pelo saldo)"
            >
              MÁX
            </button>
          </div>

          {/* Contas Prontas — casas que vão apostar, com a odd de cada casa */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <span>Contas prontas · odd por casa</span>
              <span>{betting.length}/{connected.length}</span>
            </div>
            {connected.length === 0 ? (
              <p className="rounded-lg bg-black/20 px-3 py-3 text-center text-[11px] text-gray-500">Nenhuma conta conectada.</p>
            ) : (
              <div className="space-y-1.5">
                {connected.map((a) => {
                  const on = selectedIds.has(a.id);
                  const h = houseBySlug.get(a.bookmakerSlug);
                  const row = byAccount.get(a.id);
                  const odd = row?.odd ?? getHousePrice(a.bookmakerSlug, s.id)?.price ?? s.price;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onToggleAccount(a.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ring-1 transition ${
                        on ? 'bg-lime-500/[0.07] ring-lime-500/30' : 'bg-white/[0.02] ring-white/5 hover:bg-white/5'
                      }`}
                    >
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ring-1 ${on ? 'bg-lime-500 ring-lime-500 text-slate-900' : 'ring-white/20'}`}>
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      {h && <BookmakerLogo name={h.name} slug={h.slug} logoUrl={h.logoUrl} color={h.color} size={18} />}
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[12px] font-medium ${on ? 'text-white' : 'text-gray-400'}`}>{a.label || a.username}</div>
                        <div className="truncate text-[10px] text-gray-500">{formatMoney(a.balance, a.currency)}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        {on && row?.blocked ? (
                          <div className="text-[10px] font-medium text-rose-300/80">{row.reason}</div>
                        ) : (
                          <>
                            <div className={`text-sm font-bold tabular-nums ${on ? 'text-amber-400' : 'text-gray-500'}`}>{fmtOdd(odd)}</div>
                            {on && row && <div className="text-[10px] text-gray-500">R$ {row.stake.toFixed(0)} → <span className="text-emerald-300/90">{formatMoney(row.potential)}</span></div>}
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé fixo: total + confirmar */}
        <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">
              <span className="font-semibold text-white">{betting.length}</span> conta{betting.length === 1 ? '' : 's'}
              {settings.maxStakeMode && <span className="font-bold text-lime-300"> · MÁX</span>}
            </span>
            <span className="text-gray-400">
              Total <span className="font-bold text-white">{formatMoney(totalStake)}</span>
              <span className="mx-1">·</span>
              Retorno <span className="font-bold text-emerald-300">{formatMoney(totalReturn)}</span>
            </span>
          </div>
          <button
            disabled={!canFire}
            onClick={confirm}
            className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              settings.realBets ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-lime-500 text-slate-900 hover:bg-lime-400'
            }`}
          >
            {dead ? 'Mercado suspenso' : betting.length === 0 ? 'Marque uma conta' : settings.realBets ? 'Confirmar aposta real' : 'Confirmar (simulação)'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
