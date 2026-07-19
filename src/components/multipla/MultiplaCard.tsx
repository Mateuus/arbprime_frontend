import { Trophy, Clock, Calculator, Layers, Bell, BellRing, Ticket } from 'lucide-react';
import { MultiArbData } from '@/interfaces/multipla.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { CommissionBadge } from '@/components/bookmaker/CommissionBadge';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBookmakers } from '@/hooks/useBookmakers';
import {
  fmtDateTime, seenAgo, multiProfitTone, coverLabel,
  legSelectionLabel, gameOfLeg, toSurebetLeg, toSurebetEvent,
} from '@/utils/multipla';

interface Props {
  data: MultiArbData;
  onCalc: (data: MultiArbData) => void;
  notify?: (text: string) => void;
  /** "Seguir" — segue esta múltipla (alertas de mudança). */
  watched?: boolean;
  onToggleWatch?: () => void;
  /** Badge "Novo" + efeito LED de borda (do motor de notificações). */
  isNew?: boolean;
  led?: boolean;
}

/**
 * Card de UMA múltipla (arbitragem de acumulada). Diferente da surebet, o "evento"
 * é um PAR de jogos: mostramos os dois jogos no topo (com a cobertura de cada um)
 * e, abaixo, os BILHETES — cada bilhete é uma acumulada de 2 pernas colocada numa
 * única casa. O conjunto dos bilhetes cobre todos os desfechos → lucro garantido.
 * Todos os números vêm prontos do robô. Acento CYAN da feature.
 */
export function MultiplaCard({ data, onCalc, notify, watched, onToggleWatch, isNew, led }: Props) {
  const { getBookmaker } = useBookmakers();
  const [gameA, gameB] = data.games;

  return (
    <div className="animate-card-in relative rounded-xl border border-white/10 bg-white/[0.03] p-3 shadow-lg shadow-black/20 transition hover:border-cyan-500/30 hover:bg-white/[0.05]">
      {led && <span aria-hidden className="led-border" />}
      {isNew && (
        <span className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-cyan-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900 shadow">Novo</span>
      )}

      {/* Cabeçalho: selo de múltipla + lucro garantido + seguir */}
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-500/5 text-cyan-300 ring-1 ring-cyan-500/30">
            <Layers size={16} />
          </span>
          <div className="leading-tight">
            <div className="text-[12px] font-bold text-white">Múltipla</div>
            <div className="text-[10px] text-gray-400">{data.games.length} jogos · {data.tickets.length} bilhete{data.tickets.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleWatch && (
            <Tooltip label={watched ? 'Seguindo — você recebe alertas' : 'Seguir esta múltipla'}>
              <button
                onClick={onToggleWatch}
                className={`grid h-8 w-8 place-items-center rounded-lg border transition ${watched ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-white/10 bg-white/5 text-gray-400 hover:text-amber-300'}`}
                aria-label={watched ? 'Deixar de seguir' : 'Seguir'}
              >
                {watched ? <BellRing size={14} /> : <Bell size={14} />}
              </button>
            </Tooltip>
          )}
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-gray-500">Lucro garantido</div>
            <span className={`inline-block rounded-md px-2 py-1 text-base font-bold tabular-nums ring-1 ${multiProfitTone(data.profitMargin)}`}>
              {data.profitMargin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Os dois jogos do par */}
      <div className="mt-2.5 space-y-1.5">
        {[gameA, gameB].map((g, i) => (
          <div key={g.groupId} className="rounded-lg border border-white/10 bg-black/20 p-2">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300 ring-1 ring-cyan-500/30">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight text-white">
                  {g.home} <span className="text-[11px] font-normal text-gray-500">×</span> {g.away}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
                  {g.league && <span className="inline-flex min-w-0 items-center gap-1"><Trophy size={10} className="shrink-0 text-cyan-400/60" /> <span className="truncate">{g.league}</span></span>}
                  {fmtDateTime(g.date) && <span className="inline-flex shrink-0 items-center gap-1"><Clock size={10} /> {fmtDateTime(g.date)}</span>}
                </div>
              </div>
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-gray-300 ring-1 ring-white/10">{coverLabel(g.cover)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bilhetes (acumuladas) — cada um numa casa; juntos cobrem todos os desfechos */}
      <div className="mt-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500">
          <Ticket size={11} /> Bilhetes a apostar
        </div>
        <div className="space-y-1.5">
          {data.tickets.map((tk, ti) => {
            const event = toSurebetEvent(data.games[0], data.sport); // fallback; por perna usamos o jogo certo
            return (
              <div key={ti} className="rounded-lg bg-black/20 p-2 ring-1 ring-white/5">
                <div className="flex items-center gap-2">
                  <BookmakerTag slug={tk.bookmaker} size={16} nameClassName="text-[12px]" tooltip />
                  <CommissionBadge pct={getBookmaker(tk.bookmaker)?.commissionPct} className="!px-1 !py-0 !text-[9px]" />
                  <div className="ml-auto flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[8px] uppercase tracking-wider text-gray-500">Odd</div>
                      <div className="text-sm font-bold tabular-nums text-white">{tk.combinedOdd.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] uppercase tracking-wider text-gray-500">Stake</div>
                      <div className="text-sm font-bold tabular-nums text-cyan-200">{tk.stakePct.toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
                {/* As 2 pernas da acumulada (uma de cada jogo) */}
                <div className="mt-1.5 space-y-1">
                  {tk.legs.map((leg, li) => {
                    const g = gameOfLeg(data, leg);
                    const evt = g ? toSurebetEvent(g, data.sport) : event;
                    return (
                      <div key={li} className="flex items-center gap-2 rounded bg-white/[0.03] px-2 py-1">
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/10 text-[9px] font-bold text-gray-300">{(g ? data.games.indexOf(g) : li) + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-gray-200">{legSelectionLabel(leg, g)}</span>
                        <span className="inline-flex shrink-0 items-center rounded bg-white/5 px-1.5 py-1 ring-1 ring-white/10">
                          <OpenInHouse leg={toSurebetLeg(leg, tk.bookmaker)} event={evt} notify={notify} iconSize={13} title="Abrir o jogo na casa" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => onCalc(data)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-cyan-400"
        >
          <Calculator size={13} /> Calculadora
        </button>
        <span className="text-[10px] text-gray-500">visto há {seenAgo(data.create_at)}</span>
      </div>
    </div>
  );
}

export default MultiplaCard;
