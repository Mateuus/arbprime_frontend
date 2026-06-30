import { Calculator, Zap, Trophy, Clock, HelpCircle, Sigma, ShieldAlert } from 'lucide-react';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import { Tooltip } from '@/components/ui/Tooltip';
import { DuasVidas, DuasVidasData, DuasVidasLeg } from '@/interfaces/duasvidas.interface';
import { formatEventDateTime } from '@/utils/eventTime';
import { apparentTone, evTone, lossTone, valueTone } from '@/utils/duasVidas';

const oddDir = (leg?: DuasVidasLeg): number => {
  const h = leg?.historyPrice;
  if (!Array.isArray(h) || h.length < 2) return 0;
  return h[0].price > h[1].price ? 1 : h[0].price < h[1].price ? -1 : 0;
};

const fmtPct = (n: number | null | undefined, dp = 2) =>
  n == null || !Number.isFinite(n) ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(dp)}%`;

/**
 * Card do Duas Vidas (DV) — surebet CONDICIONAL. Layout 1·X·2: o favorito do jogo e o
 * empate são as DUAS VIDAS de cobertura; a ponta da zebra é uma MÚLTIPLA (zebra × favorito-PA
 * de outro jogo). O gancho (margem aparente) vem SEMPRE colado da verdade (EV real, prob. de
 * perda, odd justa). Acento fuchsiaa.
 */
export function DuasVidasCard({ event, sb, onCalc, onExplain, notify }: {
  event: DuasVidasData;
  sb: DuasVidas;
  onCalc: () => void;
  onExplain?: () => void;
  notify?: (text: string) => void;
}) {
  const byOpt = (opt: string) => sb.surebet.find((l) => (l.option || '').toLowerCase() === opt);
  const parlay = sb.surebet.find((l) => l.isParlay);
  const booster = parlay?.booster;
  const cols: { tag: string; sub: string; leg?: DuasVidasLeg }[] = [
    { tag: '1', sub: 'Casa', leg: byOpt('home') },
    { tag: 'X', sub: 'Empate', leg: byOpt('draw') },
    { tag: '2', sub: 'Fora', leg: byOpt('away') },
  ];
  const dateLabel = formatEventDateTime(event.date);
  const boosterDateLabel = booster ? formatEventDateTime(booster.date) : '';
  const boosterStartsFirst = booster ? new Date(booster.date).getTime() < new Date(event.date).getTime() : false;

  return (
    <div className="animate-card-in rounded-xl border border-white/10 bg-gradient-to-b from-fuchsia-500/[0.05] to-transparent overflow-hidden">
      {/* Cabeçalho: gancho (aparente) + calculadora */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-white/10 bg-fuchsia-500/[0.07]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Zap size={12} className="shrink-0 text-fuchsia-300 fill-fuchsia-300/30" />
          <span className="text-[11px] font-semibold text-fuchsia-200/90 truncate tracking-wide">Duas Vidas</span>
          {onExplain && (
            <Tooltip label="Como funciona o Duas Vidas?" className="shrink-0">
              <button onClick={onExplain} className="text-gray-500 hover:text-fuchsia-300 transition"><HelpCircle size={12} /></button>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip label="Margem APARENTE (trata a múltipla como perna única). É o gancho — veja o EV real abaixo.">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 cursor-help ${apparentTone(sb.apparentMargin)}`}>
              {fmtPct(sb.apparentMargin)} <span className="ml-1 font-normal opacity-70">apar.</span>
            </span>
          </Tooltip>
          <Tooltip label="Calculadora Duas Vidas">
            <button onClick={onCalc} className="grid place-items-center h-6 w-6 rounded-md bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20 ring-1 ring-fuchsia-500/20 transition">
              <Calculator size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Linha da verdade (honestidade): EV real · prob. de perda · odd justa da múltipla */}
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-3 py-1.5 border-b border-white/[0.07] bg-black/20 text-[10px]">
        <Tooltip label="EV real = margem aparente − probabilidade de perda. O honesto: pode ser negativo. (O PA do favorito-2 só joga a favor, então é o pior caso.)">
          <span className="inline-flex items-center gap-1 cursor-help">
            <Sigma size={11} className="text-gray-500" />
            <span className="uppercase tracking-wider text-gray-500">EV real</span>
            <span className={`font-bold tabular-nums ${evTone(sb.trueEV)}`}>{fmtPct(sb.trueEV)}</span>
          </span>
        </Tooltip>
        <Tooltip label="Probabilidade do único galho de perda: a zebra vence mas o favorito-2 falha.">
          <span className="inline-flex items-center gap-1 cursor-help">
            <ShieldAlert size={11} className="text-gray-500" />
            <span className="uppercase tracking-wider text-gray-500">perde</span>
            <span className={`font-bold tabular-nums ${lossTone(sb.pLoss)}`}>{sb.pLoss.toFixed(1)}%</span>
          </span>
        </Tooltip>
        {sb.parlayFairOdd != null && (
          <Tooltip label="Odd JUSTA da múltipla (Pinnacle/consenso). Se a múltipla oferecida for maior que a justa, há valor.">
            <span className="inline-flex items-center gap-1 cursor-help">
              <span className="uppercase tracking-wider text-gray-500">justa</span>
              <span className="font-bold tabular-nums text-gray-200">{sb.parlayFairOdd.toFixed(2)}</span>
              <span className="text-gray-600">·</span>
              <span className="uppercase tracking-wider text-gray-500">valor</span>
              <span className={`font-bold tabular-nums ${valueTone(sb.parlayEdge)}`}>{fmtPct(sb.parlayEdge, 1)}</span>
            </span>
          </Tooltip>
        )}
      </div>

      {/* Evento */}
      <div className="px-3 py-1.5 border-b border-white/[0.07]">
        <div className="truncate text-sm font-bold leading-tight text-white">
          {event.home} <span className="text-xs font-normal text-gray-500">×</span> {event.away}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
          {event.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={10} className="shrink-0 text-fuchsia-400/60" /> <span className="truncate">{event.league}</span></span>}
          {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Clock size={10} /> {dateLabel}</span>}
        </div>
      </div>

      {/* Colunas 1 · X · 2 */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
        {cols.map(({ tag, sub, leg }) => {
          const isPA = !!leg?.pa;
          const isParlay = !!leg?.isParlay;
          const dir = oddDir(leg);
          return (
            <div key={tag} className={`relative flex flex-col gap-1.5 px-2.5 py-2.5 ${isParlay ? 'bg-fuchsia-500/[0.08]' : isPA ? 'bg-amber-500/[0.04]' : ''}`}>
              {isParlay && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />}
              {!isParlay && isPA && <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />}
              <div className="flex items-center justify-between">
                <span className="grid place-items-center h-5 min-w-[20px] px-1 rounded-md bg-white/10 text-[11px] font-bold text-gray-200">{tag}</span>
                {isParlay ? (
                  <Tooltip label="Perna MÚLTIPLA: a zebra turbinada pelo favorito-2 (mesma casa). Só ganha se as DUAS vencerem.">
                    <span className="inline-flex items-center gap-0.5 rounded-full pl-1 pr-1.5 py-0.5 text-[9px] font-bold bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30 cursor-help">
                      <Zap size={8} className="fill-fuchsia-300" /> MÚLTIPLA
                    </span>
                  </Tooltip>
                ) : isPA ? (
                  <Tooltip label="Pagamento Antecipado: a casa paga adiantado se este time abrir 2 gols de vantagem.">
                    <span className="inline-flex items-center gap-0.5 rounded-full pl-1 pr-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 cursor-help">
                      <Zap size={8} className="fill-amber-300" /> PA
                    </span>
                  </Tooltip>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-gray-600">{sub}</span>
                )}
              </div>
              {leg ? (
                <>
                  <div className="inline-flex items-baseline gap-1">
                    <span className={`text-xl font-extrabold tabular-nums leading-none ${isParlay ? 'text-fuchsia-200' : dir > 0 ? 'text-emerald-300' : dir < 0 ? 'text-rose-300' : 'text-teal-200'}`}>
                      {Number(leg.price).toFixed(2)}
                    </span>
                    {!isParlay && dir !== 0 && <span className={`text-[10px] leading-none ${dir > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{dir > 0 ? '▲' : '▼'}</span>}
                  </div>
                  {isParlay && leg.zebraPrice != null && booster && (
                    <div className="text-[9px] tabular-nums text-fuchsia-300/70 leading-tight">
                      {leg.zebraPrice.toFixed(2)} × {booster.price.toFixed(2)}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <BookmakerTag slug={leg.bookmaker} size={14} nameClassName="text-[10px]" className="min-w-0" tooltip />
                    <OpenInHouse leg={leg} event={event} notify={notify} iconSize={12} />
                  </div>
                </>
              ) : (
                <span className="py-3 text-center text-gray-600 text-sm">—</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Segundo jogo (turbina a zebra) */}
      {booster && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-fuchsia-500/[0.04]">
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fuchsia-200 ring-1 ring-fuchsia-500/30">
            <Zap size={9} className="fill-fuchsia-300" /> 2º jogo
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-white">
              {booster.side === 'home' ? booster.home : booster.away}
              <span className="ml-1 text-[9px] font-normal text-gray-500">favorito · {booster.home} × {booster.away}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-gray-400">
              {boosterDateLabel && <span className="inline-flex items-center gap-0.5"><Clock size={8} /> {boosterDateLabel}{boosterStartsFirst && <span className="ml-0.5 rounded bg-sky-500/15 px-1 text-sky-300 ring-1 ring-sky-500/30">antes</span>}</span>}
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 text-amber-300 ring-1 ring-amber-500/30 font-bold"><Zap size={7} className="fill-amber-300" /> PA</span>
              <span>justa <span className="tabular-nums text-gray-200">{booster.fairOdd.toFixed(2)}</span></span>
              <span>valor <span className={`tabular-nums font-bold ${valueTone(booster.edge)}`}>{fmtPct(booster.edge, 1)}</span></span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-bold tabular-nums text-fuchsia-200 leading-none">{booster.price.toFixed(2)}</div>
            <BookmakerTag slug={booster.bookmaker} size={12} nameClassName="text-[9px]" className="justify-end" tooltip />
          </div>
        </div>
      )}

    </div>
  );
}

export default DuasVidasCard;
