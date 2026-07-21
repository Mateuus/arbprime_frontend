import { useState } from 'react';
import { BetSlipApi, SlipMode, SlipSelection, SLIP_MAX, SLIP_MAX_STAKE } from '@/hooks/useBetSlip';
import { formatMoney } from '@/utils/nodelayUi';
import { fmtOdd } from '@/utils/nodelayLive';
import { TeamLogo } from '@/components/nodelay/TeamLogo';
import {
  Receipt, ChevronDown, Trash2, Share2, Calculator, X, Goal, Radio,
} from 'lucide-react';

/**
 * CUPOM DE APOSTAS ("betslip") estilo bet365 — COMPARTILHADO por todas as casas de
 * uma instância NoDelay. Uma aposta simples/múltipla (prematch OU ao vivo).
 *
 * NÃO é a "Aposta Rápida" (aquela dispara a mesma entrada em N contas — ver
 * BetSlipDrawer). Aqui é UM apostador montando UMA aposta antes de confirmar.
 *
 * Cores: âmbar/ouro na odd (assinatura bet365), lime = acento interativo do NoDelay
 * (aba ativa, botão principal), esmeralda no cabeçalho/faixa "verde" da casa.
 *
 * Responsivo: painel fixo à direita no desktop (lg+), bottom-sheet no mobile com um
 * gatilho flutuante "Cupom (N)". O componente gerencia o próprio open/close.
 *
 * O disparo real ainda NÃO existe (prematch/live é futuro) → "Fazer aposta" é MOCK:
 * mostra um aviso e MANTÉM o cupom. Ver `// TODO(place)`.
 */

interface Props {
  slip: BetSlipApi;
  /** Rótulo da casa/instância no rodapé (ex.: "bet365" / "Betano"). */
  houseLabel?: string;
}

export function BetSlip({ slip, houseLabel }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <>
      {/* Gatilho flutuante — some quando o painel está aberto. No desktop também
          serve p/ reabrir o painel se o usuário fechar. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[9998] inline-flex items-center gap-2 rounded-full bg-lime-500 px-4 py-3 text-sm font-bold text-black shadow-[0_8px_30px_rgba(132,204,22,0.35)] transition hover:bg-lime-400"
        >
          <Receipt size={17} />
          Cupom
          {slip.count > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black/25 px-1 text-xs font-bold tabular-nums">
              {slip.count}
            </span>
          )}
        </button>
      )}

      {open && (
        <>
          {/* Backdrop só no mobile (no desktop o painel fica dockado, sem escurecer). */}
          <div
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          {/* Painel: bottom-sheet no mobile, coluna fixa à direita no desktop. */}
          <div className="fixed inset-x-0 bottom-0 z-[9999] flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-white/10 bg-brand-dark shadow-[0_-8px_40px_rgba(0,0,0,0.6)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-t-0">
            <SlipHeader slip={slip} onClose={() => setOpen(false)} />
            <SlipBody slip={slip} houseLabel={houseLabel} />
          </div>
        </>
      )}
    </>
  );
}

/** Faixa verde do cabeçalho: "Cupom de Apostas  N/30" + chevron de fechar. */
function SlipHeader({ slip, onClose }: { slip: BetSlipApi; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-t-2xl bg-emerald-600 px-3 py-2.5 text-white lg:rounded-none">
      <Receipt size={16} />
      <span className="text-sm font-bold">Cupom de Apostas</span>
      <span className="rounded-md bg-black/20 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
        {slip.count}/{SLIP_MAX}
      </span>
      <button onClick={onClose} className="ml-auto rounded-lg p-1 transition hover:bg-black/20" title="Fechar cupom">
        <ChevronDown size={18} className="lg:hidden" />
        <X size={16} className="hidden lg:block" />
      </button>
    </div>
  );
}

function SlipBody({ slip, houseLabel }: { slip: BetSlipApi; houseLabel?: string }) {
  const empty = slip.count === 0;

  return (
    <>
      {/* Linha de ações: limpar / compartilhar / valores */}
      <div className="flex items-center gap-1 border-b border-white/10 bg-black/20 px-2 py-1.5">
        <ActionBtn icon={<Trash2 size={13} />} label="Limpar" onClick={slip.clear} disabled={empty} />
        <ActionBtn icon={<Share2 size={13} />} label="Compartilhar" disabled />
        <ActionBtn icon={<Calculator size={13} />} label="Valores" disabled />
      </div>

      {/* Abas Simples | Múltipla | Sistema */}
      <div className="flex gap-1 border-b border-white/10 bg-black/10 px-2 py-2">
        <ModeTab id="simples" label="Simples" slip={slip} />
        <ModeTab id="multipla" label={`Múltipla${slip.count > 1 ? ` (${slip.count})` : ''}`} slip={slip} />
        <ModeTab id="sistema" label="Sistema" slip={slip} />
      </div>

      {/* Lista de seleções */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <EmptyState />
        ) : slip.mode === 'multipla' ? (
          <MultiplaList slip={slip} />
        ) : slip.mode === 'sistema' ? (
          <SistemaStub slip={slip} />
        ) : (
          <div className="divide-y divide-white/5">
            {slip.selections.map((s) => (
              <SimplesRow key={s.id} sel={s} slip={slip} />
            ))}
          </div>
        )}
      </div>

      {!empty && <SlipFooter slip={slip} houseLabel={houseLabel} />}
    </>
  );
}

function ActionBtn({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-300 transition enabled:hover:bg-white/10 disabled:opacity-40"
    >
      {icon} {label}
    </button>
  );
}

function ModeTab({ id, label, slip }: { id: SlipMode; label: string; slip: BetSlipApi }) {
  const on = slip.mode === id;
  return (
    <button
      onClick={() => slip.setMode(id)}
      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
        on ? 'bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/40' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
        <Receipt size={26} className="text-gray-600" />
      </span>
      <p className="text-sm font-semibold text-gray-300">Nenhuma aposta encontrada</p>
      <p className="max-w-[16rem] text-xs text-gray-500">
        Toque numa odd no quadro do jogo para adicionar sua seleção ao cupom.
      </p>
    </div>
  );
}

/** Cabeçalho comum de uma seleção (times + mercado + pick + odd + lixeira). */
function SelectionHead({ sel, slip, showOdd = true }: { sel: SlipSelection; slip: BetSlipApi; showOdd?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-white/5 text-gray-400">
        <Goal size={13} />
      </span>
      <div className="min-w-0 flex-1">
        {/* Evento */}
        <div className="flex items-center gap-1.5">
          {sel.homeSofaId != null && <TeamLogo name={sel.eventLabel} sofascoreId={sel.homeSofaId} size={14} />}
          <span className="min-w-0 truncate text-[11px] text-gray-400">{sel.eventLabel}</span>
        </div>
        {/* Mercado + tag PA verde itálica */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[11px] text-gray-500">{sel.marketName}</span>
          {sel.paTag && <span className="text-[10px] font-semibold italic text-emerald-400">{sel.paTag}</span>}
        </div>
        {/* Pick (negrito) + horário/Ao Vivo */}
        <div className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-bold text-white">{sel.selectionName}</span>
          {sel.live ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-rose-300">
              <Radio size={10} /> Ao Vivo
            </span>
          ) : sel.kickoffLabel ? (
            <span className="shrink-0 text-[10px] tabular-nums text-gray-500">{sel.kickoffLabel}</span>
          ) : null}
        </div>
      </div>
      {/* Odd em âmbar + remover */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {showOdd && <span className="text-sm font-bold tabular-nums text-amber-400">{fmtOdd(sel.odd)}</span>}
        <button
          onClick={() => slip.remove(sel.id)}
          className="rounded p-0.5 text-gray-600 transition hover:text-rose-400"
          title="Remover seleção"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/** Chips rápidos de stake: +10 / +50 / +200 / MÁX. */
function StakeChips({ onBump, onMax }: { onBump: (v: number) => void; onMax: () => void }) {
  return (
    <div className="mt-1.5 flex gap-1">
      {[10, 50, 200].map((v) => (
        <button
          key={v}
          onClick={() => onBump(v)}
          className="flex-1 rounded-md bg-white/5 py-1 text-[11px] font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          +{v}
        </button>
      ))}
      <button
        onClick={onMax}
        className="flex-1 rounded-md bg-lime-500/10 py-1 text-[11px] font-bold text-lime-300 ring-1 ring-lime-500/30 transition hover:bg-lime-500/20"
      >
        MÁX
      </button>
    </div>
  );
}

/** Input de stake "R$ 0,00". Mantém string local p/ digitação livre. */
function StakeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/10 focus-within:ring-lime-500/40">
      <span className="mr-1 text-xs font-semibold text-gray-500">R$</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value || ''}
        placeholder="0,00"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full min-w-0 bg-transparent text-right text-sm font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
      />
    </div>
  );
}

/** Modo SIMPLES: cada seleção com sua stake + retorno próprio. */
function SimplesRow({ sel, slip }: { sel: SlipSelection; slip: BetSlipApi }) {
  const stake = slip.stakeOf(sel.id);
  const ret = slip.returnOf(sel.id);
  return (
    <div className="px-3 py-2.5">
      <SelectionHead sel={sel} slip={slip} />
      <div className="mt-2">
        <StakeInput value={stake} onChange={(v) => slip.setStake(sel.id, v)} />
        <StakeChips onBump={(v) => slip.bumpStake(sel.id, v)} onMax={() => slip.setStake(sel.id, SLIP_MAX_STAKE)} />
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Retorno potencial</span>
          <span className="font-bold tabular-nums text-emerald-300">{formatMoney(ret)}</span>
        </div>
      </div>
    </div>
  );
}

/** Modo MÚLTIPLA: seleções listadas (só odd), UMA stake, odd combinada = produto. */
function MultiplaList({ slip }: { slip: BetSlipApi }) {
  return (
    <div>
      <div className="divide-y divide-white/5">
        {slip.selections.map((s) => (
          <div key={s.id} className="px-3 py-2.5">
            <SelectionHead sel={s} slip={slip} />
          </div>
        ))}
      </div>
      {/* Bloco da múltipla: odd combinada + stake única */}
      <div className="border-t border-white/10 bg-black/20 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Múltipla · {slip.count} seleções</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-400 ring-1 ring-amber-500/25">
            {fmtOdd(slip.multiOdds)}
          </span>
        </div>
        <StakeInput value={slip.multiStake} onChange={slip.setMultiStake} />
        <StakeChips onBump={(v) => slip.setMultiStake(slip.multiStake + v)} onMax={() => slip.setMultiStake(SLIP_MAX_STAKE)} />
      </div>
    </div>
  );
}

/** Modo SISTEMA: stub por ora (combinações parciais é futuro). */
function SistemaStub({ slip }: { slip: BetSlipApi }) {
  return (
    <div>
      <div className="divide-y divide-white/5">
        {slip.selections.map((s) => (
          <div key={s.id} className="px-3 py-2.5">
            <SelectionHead sel={s} slip={slip} />
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 bg-black/20 px-3 py-4 text-center">
        <p className="text-xs font-semibold text-gray-300">Aposta de Sistema</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Combinações parciais (ex.: 2/3) em breve. Use Simples ou Múltipla por enquanto.
        </p>
      </div>
    </div>
  );
}

/** Rodapé: total apostado + botão "Fazer aposta" com o retorno potencial. */
function SlipFooter({ slip, houseLabel }: { slip: BetSlipApi; houseLabel?: string }) {
  const { totalStake, totalReturn } = slip.totals;
  const canPlace = totalStake > 0 && (slip.mode !== 'sistema');

  const onPlace = () => {
    // TODO(place): AQUI vai a colocação real na casa (prematch/live). Hoje é mock:
    //   const ticket = { house, mode, selections, stakes... };
    //   await placeSlip(instanceId, ticket)  // futuro serviço, análogo ao placeBet.ts
    // Por ora só avisamos e MANTEMOS o cupom (o usuário não perde a montagem).
    const label = slip.mode === 'multipla'
      ? `Múltipla ${fmtOdd(slip.multiOdds)} · ${formatMoney(totalStake)}`
      : `${slip.count} simples · ${formatMoney(totalStake)}`;
    // eslint-disable-next-line no-alert
    window.alert(`Aposta registrada (mock) — placement real em breve.\n\n${label}`);
  };

  return (
    <div className="border-t border-white/10 bg-brand-dark px-3 py-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-gray-400">Total apostado</span>
        <span className="font-bold tabular-nums text-white">{formatMoney(totalStake)}</span>
      </div>
      <button
        onClick={onPlace}
        disabled={!canPlace}
        className="flex w-full items-center justify-between rounded-xl bg-lime-500 px-4 py-3 font-bold text-black transition enabled:hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500"
      >
        <span className="text-sm">Fazer aposta</span>
        <span className="flex flex-col items-end leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Retornos potenciais</span>
          <span className="text-sm tabular-nums">{formatMoney(totalReturn)}</span>
        </span>
      </button>
      <p className="mt-1.5 text-center text-[10px] text-gray-600">
        {houseLabel ? `${houseLabel} · ` : ''}colocação real em breve (mock)
      </p>
    </div>
  );
}
