import { useMemo, useState } from 'react';
import { Trophy, Clock, Target, Layers, Calculator, ChevronDown, Tag, Scale, LineChart } from 'lucide-react';
import { Middle, MiddleData, MiddleLeg } from '@/interfaces/middle.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import { Tooltip } from '@/components/ui/Tooltip';
import { MiddleGapLine } from '@/components/middles/MiddleGapLine';
import { MiddleOddModal } from '@/components/middles/MiddleOddModal';
import { SideBadge } from '@/components/middles/SideBadge';
import SurebetActionsMenu from '@/components/arbbets/SurebetActionsMenu';
import { useBookmakers } from '@/hooks/useBookmakers';
import { HideType } from '@/hooks/useHiddenSet';
import { commissionAdjustedMetrics } from '@/utils/middleMath';
import {
  evTone, evKind, pGapTone, fmtSigned, fmtDateTime, seenAgo, gapLabel, gapValueLabel,
  lineTypeLabel, middleMarketLabel, legSelectionLabel, isHandicap, middleKindLabel,
  mioloText, supremacyText, toSurebetLeg, toSurebetEvent, toSurebet,
} from '@/utils/middle';

interface Props {
  event: MiddleData;
  m: Middle;
  onCalc: (event: MiddleData, m: Middle) => void;
  notify?: (text: string) => void;
  /** Esconde o cabeçalho do evento (usado dentro do modal "Por evento", que já
   *  mostra o jogo no topo) — fica só mercado/tipo + EV. */
  hideEvent?: boolean;
  /** Ocultar (preferência pessoal) — do useHiddenSet. Sem isto, o menu kebab
   *  (reclamar/ocultar/admin) não aparece. */
  onHide?: (type: HideType, itemKey: string, label?: string, eventStartAt?: string | null) => void;
  isHidden?: (type: HideType, itemKey: string) => boolean;
}

/**
 * Card de UM middle (aposta de intervalo) — o herói da tela. Adapta-se ao tipo:
 * TOTAIS (Over/Under de gols) ou HANDICAP asiático (Casa/Fora, miolo = saldo).
 * Header com evento + mercado + EV; reta numérica do MIOLO (o diferencial);
 * badges (pGap, λ, pProfit, asiático, supremacia); barra lucro×risco; as duas
 * pernas (casa, seleção, odd, stake%) e a calculadora. Números vêm prontos do robô.
 */
export function MiddleCard({ event, m, onCalc, notify, hideEvent = false, onHide, isHidden }: Props) {
  const [showTech, setShowTech] = useState(false);
  const [oddLeg, setOddLeg] = useState<MiddleLeg | null>(null);
  const { getBookmaker } = useBookmakers();
  const sbForMenu = useMemo(() => toSurebet(m), [m]);
  const market = middleMarketLabel(m);
  const dateLabel = fmtDateTime(event.date);
  const handicap = isHandicap(m);
  const kindLabel = middleKindLabel(m);
  const miolo = mioloText(m, event.home, event.away);
  const supremacy = supremacyText(m, event.home, event.away);

  const surebetEvent = useMemo(() => toSurebetEvent(event), [event]);

  // Métricas ajustadas pela COMISSÃO das casas (exchange). Sem comissão, são as
  // do robô. A assinatura (comissões por perna) é a dependência do memo.
  const commSig = m.legs.map((l) => getBookmaker(l.bookmaker)?.commissionPct ?? 0).join(',');
  const adj = useMemo(
    () => commissionAdjustedMetrics(m, (slug) => getBookmaker(slug)?.commissionPct ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, commSig],
  );
  const evK = evKind(adj.ev);

  // Barra lucro×risco: normaliza pela maior magnitude p/ a maior ponta encher seu lado.
  const maxMag = Math.max(Math.abs(adj.profitIfHit), Math.abs(adj.lossIfMiss), 1);
  const lossW = Math.min(100, (Math.abs(adj.lossIfMiss) / maxMag) * 100);
  const profW = Math.min(100, (Math.abs(adj.profitIfHit) / maxMag) * 100);

  return (
    <div className="animate-card-in rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/[0.05]">
      {/* Cabeçalho: evento (opcional) + mercado/tipo + EV */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {!hideEvent && (
            <>
              <div className="truncate text-sm font-bold leading-tight text-white">
                {event.home} <span className="text-xs font-normal text-gray-500">×</span> {event.away}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                {event.league && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Trophy size={10} className="shrink-0 text-indigo-400/60" />
                    <span className="truncate">{event.league}</span>
                  </span>
                )}
                {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Clock size={10} /> {dateLabel}</span>}
                {m.id && <span className="shrink-0 text-gray-500">· visto há {seenAgo(event.create_at)}</span>}
              </div>
            </>
          )}
          {/* Mercado + tipo (Totais/Handicap) */}
          <div className={`flex items-center gap-2 ${hideEvent ? '' : 'mt-1.5'}`}>
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-gray-300">
              <Tag size={11} className="shrink-0 text-indigo-400/60" />
              <span className="truncate">{market}</span>
            </span>
            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400 ring-1 ring-white/10">{kindLabel}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">EV</div>
          <Tooltip label={<><strong className="text-white">EV</strong> — valor esperado em <strong className="text-white">% da banca</strong> (média ponderada por Poisson de todos os desfechos). <strong className="text-amber-300">~0 = free middle</strong>: não custa nada na média.{adj.adjusted && <> Já <strong className="text-amber-300">líquido da comissão</strong> da casa (exchange).</>}</>}>
            <span className={`inline-block rounded-md px-2 py-1 text-base font-bold tabular-nums ring-1 ${evTone(adj.ev)}`}>
              {fmtSigned(adj.ev)}%
            </span>
          </Tooltip>
          {evK === 'free' && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">Free middle</div>}
        </div>
      </div>

      {/* Reta do MIOLO — o diferencial */}
      <div className="mt-2.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
        <MiddleGapLine m={m} home={event.home} away={event.away} />
        <div className="mt-1.5 text-center text-[10px] text-gray-400">
          Ganha as <strong className="text-white">duas pernas</strong>: <strong className="text-emerald-300">{miolo}</strong>
        </div>
      </div>

      {/* Badges de métrica */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Tooltip label={<><strong className="text-white">pGap</strong> — probabilidade de cair no <strong className="text-emerald-300">miolo</strong> (as duas pernas ganham). Vem de um modelo de <strong className="text-white">Poisson</strong> dos gols.</>}>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ${pGapTone(m.pGap)}`}>
            <Target size={12} /> {m.pGap.toFixed(0)}% de acerto
          </span>
        </Tooltip>
        <Tooltip label={
          <>
            <strong className="text-white">λ (lambda) = {m.lambda.toFixed(2)}</strong> — o modelo espera, na média, cerca de <strong className="text-emerald-300">{m.lambda.toFixed(2)} gols</strong> no total deste jogo.
            {handicap && m.lambdaHome != null && m.lambdaAway != null && (
              <> Repartidos em ~<strong className="text-white">{m.lambdaHome.toFixed(2)}</strong> do mandante e ~<strong className="text-white">{m.lambdaAway.toFixed(2)}</strong> do visitante.</>
            )}{' '}
            Sai das próprias odds <em>de-vigadas</em> (modelo de Poisson) e é a <strong className="text-white">base</strong> pra estimar a chance de cair no miolo (e o EV). Mais gols esperados → o miolo tende a linhas mais altas.
          </>
        }>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-gray-300 ring-1 ring-white/10">λ {m.lambda.toFixed(2)}</span>
        </Tooltip>
        <Tooltip label={<>Chance de <strong className="text-white">resultado líquido positivo</strong> — inclui meias-vitórias e pushes lucrativos, não só o miolo cheio.</>}>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-gray-300 ring-1 ring-white/10">{adj.pProfit.toFixed(0)}% lucro líq.</span>
        </Tooltip>
        {handicap && supremacy && m.supremacy != null && (
          <Tooltip label={<><strong className="text-white">Supremacia</strong>: {supremacy}. É a <strong className="text-white">margem esperada</strong> do jogo (de-vigada do handicap), base da distribuição usada no cálculo do miolo.</>}>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-gray-300 ring-1 ring-white/10"><Scale size={11} /> sup {fmtSigned(m.supremacy, 2)}</span>
          </Tooltip>
        )}
        {!m.gapFull && (
          <Tooltip label={<><strong className="text-amber-300">Miolo asiático</strong>: em linhas de quarto (ex. 2.75 / 3.25 ou −0.75 / +2.25) o miolo paga <strong className="text-white">meia-vitória</strong> (metade ganha, metade é devolvida). Risco menor — e prêmio menor.</>}>
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30"><Layers size={11} /> Asiático · meia-perda</span>
          </Tooltip>
        )}
      </div>

      {/* Barra lucro × risco */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="font-semibold tabular-nums text-rose-300">{fmtSigned(adj.lossIfMiss, 1)}% se erra</span>
          <span className="font-semibold tabular-nums text-emerald-300">{fmtSigned(adj.profitIfHit, 1)}% se acerta</span>
        </div>
        <div className="flex h-2.5 items-stretch">
          <div className="relative h-full flex-1 overflow-hidden rounded-l-full bg-rose-500/10">
            <div className="absolute right-0 top-0 h-full rounded-l-full bg-rose-500/70" style={{ width: `${lossW}%` }} />
          </div>
          <div className="z-10 -mx-px h-full w-0.5 bg-white/40" />
          <div className="relative h-full flex-1 overflow-hidden rounded-r-full bg-emerald-500/10">
            <div className="absolute left-0 top-0 h-full rounded-r-full bg-emerald-500/70" style={{ width: `${profW}%` }} />
          </div>
        </div>
        {adj.adjusted && <div className="mt-1 text-right text-[9px] text-amber-300/80">já líquido da comissão da casa</div>}
      </div>

      {/* Pernas */}
      <div className="mt-2.5 space-y-1.5">
        {m.legs.map((leg, i) => {
          return (
            <div key={i} className="flex items-center gap-2.5 rounded-lg bg-black/20 p-2 ring-1 ring-white/5">
              <SideBadge side={leg.side} selection={legSelectionLabel(leg, event.home, event.away)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <BookmakerTag slug={leg.bookmaker} size={15} nameClassName="text-[12px]" tooltip />
                  <CommissionBadge pct={getBookmaker(leg.bookmaker)?.commissionPct} className="!px-1 !py-0 !text-[9px]" />
                </div>
                <div className="truncate text-[11px] text-gray-400">{legSelectionLabel(leg, event.home, event.away)}</div>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-[9px] uppercase tracking-wider text-gray-500">Odd</div>
                <div className="text-sm font-bold tabular-nums text-white">{leg.price.toFixed(2)}</div>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-[9px] uppercase tracking-wider text-gray-500">Stake</div>
                <div className="text-sm font-bold tabular-nums text-indigo-200">{leg.stakePct.toFixed(0)}%</div>
              </div>
              <button
                type="button"
                onClick={() => setOddLeg(leg)}
                title="Histórico da odd e outras casas"
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-white/5 text-gray-500 ring-1 ring-white/10 transition hover:text-indigo-300"
              >
                <LineChart size={14} />
              </button>
              <span className="inline-flex shrink-0 items-center rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10">
                <OpenInHouse leg={toSurebetLeg(leg)} event={surebetEvent} notify={notify} iconSize={14} title="Apostar na casa" />
              </span>
              {onHide && isHidden && (
                <SurebetActionsMenu event={surebetEvent} sb={sbForMenu} leg={toSurebetLeg(leg)} onHide={onHide} isHidden={isHidden} notify={notify} />
              )}
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => onCalc(event, m)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
        >
          <Calculator size={13} /> Calculadora
        </button>
        <button
          onClick={() => setShowTech((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-gray-400 ring-1 ring-white/10 transition hover:text-gray-200"
        >
          Detalhes <ChevronDown size={12} className={`transition ${showTech ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Detalhe técnico (expandable) */}
      {showTech && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-black/20 p-2.5 text-[11px] text-gray-400 ring-1 ring-white/5">
          <div className="flex justify-between gap-2"><span>{handicap ? 'Miolo (saldo)' : 'Miolo (gols)'}</span><span className="font-semibold text-emerald-300">{handicap ? m.gap.map((v) => gapValueLabel(v, true)).join(', ') : gapLabel(m.gap)}</span></div>
          <div className="flex justify-between gap-2"><span>Tipo de linha</span><span className="text-gray-200">{lineTypeLabel(m.lineType)}</span></div>
          <div className="flex justify-between gap-2"><span>Miolo cheio</span><span className="text-gray-200">{m.gapFull ? 'Sim' : 'Não (asiático)'}</span></div>
          <div className="flex justify-between gap-2"><span>Coeficiente</span><span className="tabular-nums text-gray-200">{m.coefficient.toFixed(4)}</span></div>
          <div className="flex justify-between gap-2"><span>λ (gols esp.)</span><span className="tabular-nums text-gray-200">{m.lambda.toFixed(3)}</span></div>
          <div className="flex justify-between gap-2"><span>P(lucro líq.)</span><span className="tabular-nums text-gray-200">{adj.pProfit.toFixed(2)}%</span></div>
          {handicap && m.lambdaHome != null && <div className="flex justify-between gap-2"><span>λ mandante</span><span className="tabular-nums text-gray-200">{m.lambdaHome.toFixed(3)}</span></div>}
          {handicap && m.lambdaAway != null && <div className="flex justify-between gap-2"><span>λ visitante</span><span className="tabular-nums text-gray-200">{m.lambdaAway.toFixed(3)}</span></div>}
          {handicap && m.supremacy != null && <div className="flex justify-between gap-2"><span>Supremacia</span><span className="tabular-nums text-gray-200">{fmtSigned(m.supremacy, 3)}</span></div>}
        </div>
      )}

      {oddLeg && <MiddleOddModal event={event} leg={oddLeg} onClose={() => setOddLeg(null)} />}
    </div>
  );
}

export default MiddleCard;
