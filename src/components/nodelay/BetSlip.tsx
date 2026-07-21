import { useMemo, useState } from 'react';
import { LiveGameDetail, LiveMarket, LiveSelection } from '@/services/nodelay/rogueModel';
import { NoDelayAccount, NoDelayBookmaker } from '@/interfaces/nodelay.interface';
import { HousePrice } from '@/hooks/useInstanceLiveEvent';
import { NoDelaySettings, acceptOddsChangeFor } from '@/hooks/useNoDelaySettings';
import { useNoDelayFire, HOUSE_MIN } from '@/hooks/useNoDelayFire';
import { BetSlipCard } from '@/components/nodelay/BetSlipCard';
import { selectionLabel, scoreOf, clockOf, fmtOdd } from '@/utils/nodelayLive';
import { formatMoney } from '@/utils/nodelayUi';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { X, Minus, Plus, Check, Lock, Zap, Info } from 'lucide-react';

/**
 * Cupom de Apostas (Betslip) — bottom sheet compartilhado por TODA casa, prematch e
 * ao vivo. Abre ao tocar numa odd no quadro. NÃO é usado na Aposta Rápida.
 *
 * As casas viram ABAS (paginação por casa): cada aba mostra a odd DAQUELA casa, o
 * "Aceitar mudança de odd" própria e as contas dela. O disparo (client-side, motor
 * useNoDelayFire) sai em TODAS as contas marcadas de todas as casas de uma vez; o
 * resultado aparece no BetSlipDrawer (a página é dona do `fire`).
 *
 * Stake é FIXO (o `fire` roda com forceFixedStake): sem MÁX e sem cortar pelo teto
 * do fornecedor de odd — o limite REAL é o da casa (avisado abaixo do campo).
 */
interface Props {
  pick: { m: LiveMarket; s: LiveSelection };
  detail: LiveGameDetail;
  fire: ReturnType<typeof useNoDelayFire>;
  houseBySlug: Map<string, NoDelayBookmaker>;
  getHousePrice: (slug: string, selId: string) => HousePrice | undefined;
  connected: NoDelayAccount[];
  selectedIds: Set<string>;
  onToggleAccount: (id: string) => void;
  settings: NoDelaySettings;
  onUpdateSettings: (patch: Partial<NoDelaySettings>) => void;
  onClose: () => void;
  /** Prematch: sem dados apostáveis ainda → cupom em modo PREVIEW (confirmar desligado). */
  previewOnly?: boolean;
  /** Pré-jogo: pula a re-checagem de mercado "vivo" (o detail do prematch não tem
   * markets) — a odd é a do catálogo; o gate por casa fica no fire. */
  prematch?: boolean;
}

export function BetSlip({
  pick, detail, fire, houseBySlug, getHousePrice, connected, selectedIds, onToggleAccount, settings, onUpdateSettings, onClose, previewOnly, prematch,
}: Props) {
  const { m, s } = pick;
  const betting = useMemo(() => connected.filter((a) => selectedIds.has(a.id)), [connected, selectedIds]);

  const score = scoreOf(detail);
  const clock = clockOf(detail);
  const eventName = `${detail.home} x ${detail.away}`;

  // Re-lê a odd VIVA: se suspendeu entre o toque e a confirmação, bloqueia.
  const liveMkt = detail.markets.find((mm) => mm.id === m.id);
  const liveSel = liveMkt?.selections.find((ss) => ss.id === s.id);
  // Pré-jogo/preview: sem re-checagem de mercado vivo (não há markets no detail).
  const dead = !previewOnly && !prematch && (!liveSel || !!liveMkt?.suspended || liveSel.disabled || (liveSel.price ?? 0) <= 0);
  const headOdd = liveSel?.price ?? s.price;

  const rows = useMemo(() => fire.preview(m, s), [fire, m, s]);
  const byAccount = useMemo(() => new Map(rows.map((r) => [r.account.id, r])), [rows]);
  const totalStake = rows.reduce((acc, r) => acc + (r.blocked ? 0 : r.stake), 0);
  const totalReturn = rows.reduce((acc, r) => acc + r.potential, 0);

  // Casas (abas) = agrupa as contas por casa.
  const houses = useMemo(() => {
    const by = new Map<string, { slug: string; house?: NoDelayBookmaker; accounts: NoDelayAccount[] }>();
    for (const a of connected) {
      const g = by.get(a.bookmakerSlug) ?? { slug: a.bookmakerSlug, house: houseBySlug.get(a.bookmakerSlug), accounts: [] };
      g.accounts.push(a);
      by.set(a.bookmakerSlug, g);
    }
    return [...by.values()];
  }, [connected, houseBySlug]);

  const [activeSlug, setActiveSlug] = useState('');
  const active = houses.find((h) => h.slug === activeSlug) ?? houses[0];

  // Menor aposta permitida = o menor mínimo entre as casas do cupom (Superbet 0,50).
  const slipMin = useMemo(() => houses.reduce((mn, h) => Math.min(mn, h.house?.minStake ?? HOUSE_MIN), HOUSE_MIN), [houses]);
  const setStake = (v: number) => onUpdateSettings({ defaultStake: Math.max(slipMin, +v.toFixed(2)) });
  const canFire = !previewOnly && betting.length > 0 && !dead;
  // Fechar SEMPRE limpa os bilhetes (próxima abertura começa limpa).
  const close = () => { fire.reset(); onClose(); };
  // Confirmar dispara e MANTÉM o cupom aberto: os bilhetes (tempo/carregando/status
  // por casa) aparecem AQUI DENTRO, não num drawer separado.
  const confirm = () => { if (canFire) fire.doFire(m, s); };
  const fired = fire.slips !== null;

  const houseAcceptChange = active ? acceptOddsChangeFor(settings, active.slug) : settings.acceptOddsChange;
  const toggleHouseAcceptChange = () => {
    if (!active) return;
    onUpdateSettings({ oddsChangeByHouse: { ...settings.oddsChangeByHouse, [active.slug]: !houseAcceptChange } });
  };

  return (
    <div className="fixed inset-0 z-[9995] flex flex-col justify-end" onClick={close}>
      <div className="absolute inset-0 bg-black/60" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-2xl border-t border-white/10 bg-brand-dark shadow-2xl sm:mx-auto sm:max-w-lg animate-[slideUp_.18s_ease-out]"
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
            <button onClick={close} className="text-gray-400 transition hover:text-white"><X size={18} /></button>
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
                {dead ? <span className="inline-flex items-center gap-1 text-rose-300"><Lock size={15} /></span> : fmtOdd(headOdd)}
              </div>
            </div>
            {dead && <p className="mt-1.5 text-[10px] text-rose-300/80">Mercado suspendeu — feche e toque de novo quando reabrir.</p>}
            {previewOnly && <p className="mt-1.5 text-[10px] text-amber-300/80">Prévia — a aposta em pré-jogo entra quando os coletores trouxerem os dados apostáveis.</p>}
          </div>

          {fired ? (
            /* Bilhetes DENTRO do cupom: tempo/carregando/status por casa */
            <div className="mt-3 space-y-2">
              {fire.slips!.map((sl) => <BetSlipCard key={sl.key} slip={sl} />)}
            </div>
          ) : (
          <>
          {/* Stake (fixo, sem MÁX) + aviso de limite */}
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Valor por conta</span>
              <div className="ml-auto flex items-center rounded-lg bg-black/30 ring-1 ring-white/10">
                <button onClick={() => setStake(settings.defaultStake - 1)} className="grid h-8 w-8 place-items-center text-gray-400 hover:text-white"><Minus size={14} /></button>
                <input
                  value={settings.defaultStake}
                  onChange={(e) => setStake(parseFloat(e.target.value.replace(',', '.')) || 0)}
                  inputMode="decimal"
                  className="w-20 bg-transparent text-center text-sm font-bold tabular-nums text-white focus:outline-none"
                />
                <button onClick={() => setStake(settings.defaultStake + 1)} className="grid h-8 w-8 place-items-center text-gray-400 hover:text-white"><Plus size={14} /></button>
              </div>
            </div>
            <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-gray-500">
              <Info size={11} className="mt-px shrink-0" />
              O limite é definido pela CASA — pode ser maior ou menor que o mostrado na odd.
            </p>
          </div>

          {/* Abas por casa (paginação) */}
          {houses.length === 0 ? (
            <p className="mt-3 rounded-lg bg-black/20 px-3 py-3 text-center text-[11px] text-gray-500">Nenhuma conta conectada.</p>
          ) : (
            <div className="mt-3">
              <div className="-mx-1 overflow-x-auto">
                <div className="flex w-max gap-1 px-1 pb-1">
                  {houses.map((h) => {
                    const on = h.slug === active?.slug;
                    const odd = getHousePrice(h.slug, s.id)?.price ?? s.price;
                    const marked = h.accounts.filter((a) => selectedIds.has(a.id)).length;
                    return (
                      <button
                        key={h.slug}
                        onClick={() => setActiveSlug(h.slug)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 transition ${
                          on ? 'bg-lime-500/15 ring-lime-500/40' : 'bg-white/[0.03] ring-white/10 hover:bg-white/5'
                        }`}
                      >
                        {h.house && <BookmakerLogo name={h.house.name} slug={h.house.slug} logoUrl={h.house.logoUrl} color={h.house.color} size={16} />}
                        <span className={`text-[11px] font-semibold ${on ? 'text-white' : 'text-gray-300'}`}>{h.house?.name || h.slug}</span>
                        <span className="text-[11px] font-bold tabular-nums text-amber-400">{fmtOdd(odd)}</span>
                        {marked > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-lime-500 px-1 text-[9px] font-bold text-slate-900">{marked}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {active && (
                <div className="mt-2 rounded-xl bg-black/20 p-2.5 ring-1 ring-white/5">
                  {/* Aceitar mudança de odd — POR CASA */}
                  <label className="flex cursor-pointer items-center justify-between gap-2 pb-2">
                    <span className="text-[11px] text-gray-300">Aceitar mudança de odd <span className="text-gray-500">· {active.house?.name || active.slug}</span></span>
                    <button
                      type="button"
                      onClick={toggleHouseAcceptChange}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${houseAcceptChange ? 'bg-lime-500' : 'bg-white/15'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${houseAcceptChange ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </label>

                  {/* Contas desta casa */}
                  <div className="space-y-1.5 border-t border-white/5 pt-2">
                    {active.accounts.map((a) => {
                      const on = selectedIds.has(a.id);
                      const row = byAccount.get(a.id);
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
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-[12px] font-medium ${on ? 'text-white' : 'text-gray-400'}`}>{a.label || a.username}</div>
                            <div className="truncate text-[10px] text-gray-500">{formatMoney(a.balance, a.currency)}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            {on && row?.blocked ? (
                              <div className="text-[10px] font-medium text-rose-300/80">{row.reason}</div>
                            ) : on && row ? (
                              <div className="text-[10px] text-gray-500">R$ {row.stake.toFixed(0)} → <span className="text-emerald-300/90">{formatMoney(row.potential)}</span></div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* Rodapé fixo: total + confirmar (ou Fechar/Nova aposta após disparar) */}
        <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3">
          {fired ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={fire.reset} className="rounded-xl bg-white/10 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15">
                Nova aposta
              </button>
              <button onClick={close} className="rounded-xl bg-lime-500 py-3 text-sm font-bold text-slate-900 transition hover:bg-lime-400">
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="text-gray-400"><span className="font-semibold text-white">{betting.length}</span> conta{betting.length === 1 ? '' : 's'}</span>
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
                {previewOnly ? 'Aposta em breve (pré-jogo)' : dead ? 'Mercado suspenso' : betting.length === 0 ? 'Marque uma conta' : settings.realBets ? 'Confirmar aposta real' : 'Confirmar (simulação)'}
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
