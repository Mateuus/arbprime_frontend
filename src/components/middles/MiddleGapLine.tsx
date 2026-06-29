import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Middle } from '@/interfaces/middle.interface';
import { fmtLine, fmtSignedLine, gapValueLabel, splitLegs } from '@/utils/middle';

/**
 * Reta numérica do MIDDLE — o diferencial visual. As setas apontam PARA DENTRO,
 * reforçando "caia no meio que você ganha os dois lados". gapFull=false
 * (asiático/quarto) → glow âmbar + sufixo ½ (meia-vitória).
 *
 *  • Totais (Over/Under):   Over 2.5  ▸——[ 3 ]——◂  Under 3.5   (miolo = gols totais)
 *  • Handicap (time-a-time): Casa -1.5 ▸——[ +2 ]——◂ Fora +2.5  (miolo = saldo casa−fora)
 */
export function MiddleGapLine({ m, home, away }: { m: Middle; home?: string; away?: string }) {
  const { left, right, handicap } = splitLegs(m);
  const full = m.gapFull;
  const gap = [...(m.gap || [])].sort((a, b) => a - b);
  const shown = gap.slice(0, 4);
  const extra = gap.length - shown.length;

  // Fronteiras: totais = Over/Under (linha sem sinal); handicap = Casa/Fora (linha com sinal).
  const leftTop = handicap ? 'Casa' : 'Over';
  const rightTop = handicap ? 'Fora' : 'Under';
  const leftLine = handicap ? fmtSignedLine(left.line) : fmtLine(left.line);
  const rightLine = handicap ? fmtSignedLine(right.line) : fmtLine(right.line);

  const chipCls = full
    ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/50 shadow-[0_0_14px_rgba(16,185,129,0.55)]'
    : 'bg-amber-500/20 text-amber-100 ring-amber-400/50 shadow-[0_0_14px_rgba(245,158,11,0.5)]';

  const chipTitle = (g: number) => {
    const what = handicap ? `saldo ${gapValueLabel(g, true)} (casa − fora)` : `${g} gols no total`;
    return full ? `${what}: ganha as duas pernas (cheio)` : `${what}: meia-vitória nas duas pernas (asiático)`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Fronteira esquerda (Over / Casa) — você precisa de MAIS que isso */}
      <div className="shrink-0 text-center">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/80">{leftTop}</div>
        <div className="text-sm font-bold leading-none tabular-nums text-emerald-200">{leftLine}</div>
      </div>
      <ChevronRight size={14} className="shrink-0 text-emerald-400/60" />

      {/* Trilho com o miolo brilhando no centro */}
      <div className="relative flex h-9 flex-1 items-center">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_6px,transparent_6px_12px)]" />
        <div className="relative mx-auto flex items-center gap-1">
          {shown.length === 0 ? (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400 ring-1 ring-white/10">sem miolo</span>
          ) : (
            shown.map((g) => (
              <span
                key={g}
                className={`relative grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold tabular-nums ring-1 ${chipCls}`}
                title={chipTitle(g)}
              >
                {gapValueLabel(g, handicap)}
                {!full && <sup className="ml-0.5 text-[8px] opacity-80">½</sup>}
              </span>
            ))
          )}
          {extra > 0 && <span className="text-[10px] font-semibold text-gray-400">+{extra}</span>}
        </div>
      </div>

      {/* Fronteira direita (Under / Fora) — você precisa de MENOS que isso */}
      <ChevronLeft size={14} className="shrink-0 text-rose-400/60" />
      <div className="shrink-0 text-center">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">{rightTop}</div>
        <div className="text-sm font-bold leading-none tabular-nums text-rose-200">{rightLine}</div>
      </div>
    </div>
  );
}

export default MiddleGapLine;
