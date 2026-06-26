import { useMemo } from 'react';
import { Trophy, Clock, Rocket, Info, Percent } from 'lucide-react';
import { ValuebetGroup, ValuebetEmission } from '@/interfaces/valuebet.interface';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { OpenInHouse } from '@/components/arbbets/OpenInHouse';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  edgeTone, tierMeta, confidenceTone, houseVigTone, fmtVigPct, valuebetSelectionLabel, valuebetMarketLabel,
  toSurebetLeg, toSurebetEvent,
} from '@/utils/valuebet';

interface Props {
  group: ValuebetGroup;
  vb: ValuebetEmission;
  onBet: (group: ValuebetGroup, vb: ValuebetEmission) => void;
  notify?: (text: string) => void;
}

// Idade ("visto há…") a partir do create_at (1ª detecção).
function seenAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

/**
 * Card de UM value bet (aposta única). Mostra evento, casa, mercado/seleção,
 * odd em destaque (vs odd justa), badge de edge%, selo de tier/ref, barra de
 * confiança e sugestão de stake (Kelly ¼). Ações: Apostar (deep-link/extensão)
 * e Lançar (registra no Analytix, banca de value bet).
 */
export function ValuebetCard({ group, vb, onBet, notify }: Props) {
  const market = valuebetMarketLabel(vb);
  const selection = valuebetSelectionLabel(vb, group.home, group.away);
  const tier = tierMeta(vb.tier, vb.ref);
  const edgeCls = edgeTone(vb.edgePct);
  const confPct = Math.round((vb.confidence || 0) * 100);
  const stakePct = vb.stakeFraction ? (vb.stakeFraction * 100) : null;

  const leg = useMemo(() => toSurebetLeg(vb), [vb]);
  const event = useMemo(() => toSurebetEvent(group), [group]);

  const dateLabel = (() => {
    if (!group.date) return null;
    const d = new Date(group.date);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  })();

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20">
      {/* Cabeçalho: evento + selo de tier */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight text-white">
            {group.home} <span className="text-xs font-normal text-gray-500">x</span> {group.away}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-gray-400">
            {group.league && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Trophy size={10} className="shrink-0 text-teal-400/60" />
                <span className="truncate">{group.league}</span>
              </span>
            )}
            {dateLabel && <span className="inline-flex shrink-0 items-center gap-1"><Clock size={10} /> {dateLabel}</span>}
            {vb.create_at && <span className="shrink-0 text-gray-500">· visto há {seenAgo(vb.create_at)}</span>}
          </div>
        </div>
        <Tooltip label={vb.tier === 1
          ? 'Tier 1 — núcleo do mercado (1X2, total de gols). Maior confiança na estimativa.'
          : vb.tier === 2
            ? 'Tier 2 — mercados secundários (escanteios, cartões, gols por time). Confiança média.'
            : 'Tier 3 — estimativa mais conservadora. Confiança menor — pondere o risco.'}>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${tier.className}`}>
            {tier.label}
          </span>
        </Tooltip>
      </div>

      {/* Linha principal: casa + mercado/seleção + odd + edge */}
      <div className="mt-2.5 flex items-center gap-3 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <div className="min-w-0 flex-1">
          <BookmakerTag slug={vb.bookmaker} size={16} nameClassName="text-[13px]" />
          <div className="mt-1 truncate text-xs font-medium text-white">{selection}</div>
          <div className="truncate text-[10px] text-gray-500">{market}</div>
        </div>

        {/* Odd vs justa */}
        <div className="shrink-0 text-center">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">Odd</div>
          <div className="text-xl font-bold leading-none tabular-nums text-teal-300">{vb.odd.toFixed(2)}</div>
          <div className="mt-0.5 text-[10px] text-gray-500">justo {vb.fairOdd.toFixed(2)}</div>
        </div>

        {/* Edge % */}
        <div className="shrink-0 text-center">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">Valor</div>
          <span className={`mt-0.5 inline-block rounded-md px-2 py-1 text-sm font-bold tabular-nums ring-1 ${edgeCls}`}>
            +{vb.edgePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Juice / margem da casa (doc 11). Só quando medível (duas pontas da partição). */}
      {vb.houseVig != null && (
        <div className="mt-2 flex items-center gap-2">
          <Tooltip label="Estimativa da margem (juice) que a casa embute neste mercado, calculada a partir das odds das duas pontas — é aproximada, não o número exato que a casa cobra. Mesmo com margem, você tem valor porque ela errou ESTA seleção. Menor = mercado mais honesto.">
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500"><Percent size={10} /> Margem da casa ~</span>
          </Tooltip>
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${houseVigTone(vb.houseVig)}`}>{fmtVigPct(vb.houseVig)}</span>
          {vb.refVig != null && (
            <Tooltip label={`Margem estimada da referência usada para a odd justa — quão "sharp" é a estimativa. A referência costuma ter margem bem menor que as casas soft, por isso é a régua. Também é estimativa, não o valor exato cobrado.`}>
              <span className="text-[10px] text-gray-500">· referência {fmtVigPct(vb.refVig)}</span>
            </Tooltip>
          )}
        </div>
      )}

      {/* Confiança + stake sugerido */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[10px] text-gray-500">Confiança</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full ${confidenceTone(vb.confidence)}`} style={{ width: `${confPct}%` }} />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{confPct}%</span>
        </div>
        {stakePct != null && (
          <Tooltip label={`Sugestão de stake (Kelly ¼): ~${stakePct.toFixed(1)}% da sua banca de value bet.`}>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-400">
              <Info size={10} /> ~{stakePct.toFixed(1)}% banca
            </span>
          </Tooltip>
        )}
      </div>

      {/* Ações */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => onBet(group, vb)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-teal-400"
        >
          <Rocket size={13} /> Lançar aposta
        </button>
        <span className="inline-flex items-center rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10">
          <OpenInHouse leg={leg} event={event} notify={notify} iconSize={14} title="Apostar na casa" />
        </span>
      </div>
    </div>
  );
}

export default ValuebetCard;
