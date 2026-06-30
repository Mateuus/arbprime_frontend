'use client';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Zap, X, Link2, Trophy, Calendar, Coins } from 'lucide-react';
import { SurebetData, SurebetOdd } from '@/interfaces/arbitragem.interface';
import { getBookmakerEventLink } from '@/utils/functions';
import { openGameInHouse, isExtensionKnownInstalled, detectExtension, houseSupportsAutofill } from '@/utils/arbExtension';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { marketLabel, optionLabel } from '@/utils/surebet';
import { formatEventDateTime } from '@/utils/eventTime';

interface Props {
  leg: SurebetOdd;
  event: SurebetData;
  notify?: (text: string) => void;
  iconSize?: number;
  className?: string;
  title?: string;
}

/**
 * Botão "abrir na casa" da perna. Ao clicar, abre um modal com duas ações:
 *  - "Selecionar odd na casa": abre o jogo e preenche a cédula via extensão
 *    (só para casas integradas + extensão instalada — senão fica desabilitado).
 *  - "Abrir link da casa": abre a página da casa, sem preencher nada.
 * Casa sem nenhuma integração (sem autofill e sem link) → botão desabilitado.
 */
export function OpenInHouse({ leg, event, notify, iconSize = 11, className = '', title = 'Abrir na casa' }: Props) {
  const [open, setOpen] = useState(false);
  const [ext, setExt] = useState(false);

  const href = getBookmakerEventLink(leg.bookmaker, leg.eventId, event.sport, event.date) || leg.link || null;
  const supported = houseSupportsAutofill(leg.bookmaker);
  const disabled = !href && !supported; // nada a fazer com essa casa

  const openModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExt(isExtensionKnownInstalled());
    setOpen(true);
    void detectExtension(500, true).then(setExt); // refina (assíncrono)
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const doAutofill = () => {
    void openGameInHouse(leg, event);
    notify?.('Abrindo o jogo e selecionando a odd na casa…');
    close();
  };
  const doOpenLink = () => {
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
    close();
  };

  const canAutofill = supported && ext;

  // Detalhes da aposta para exibir no modal.
  const market = marketLabel(leg.market);
  const selection = optionLabel(leg.option, event.home, event.away, leg.handicap);
  const rawMarket = leg.rawMarket && leg.rawMarket.trim() && leg.rawMarket.trim().toLowerCase() !== market.toLowerCase() ? leg.rawMarket.trim() : null;
  const rawSelection = leg.rawSelection && leg.rawSelection.trim() && leg.rawSelection.trim().toLowerCase() !== selection.toLowerCase() ? leg.rawSelection.trim() : null;
  const dateLabel = formatEventDateTime(event.date);

  return (
    <>
      <button
        onClick={openModal}
        disabled={disabled}
        className={`shrink-0 text-gray-500 transition hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-500 ${className}`}
        title={disabled ? 'Casa sem integração' : title}
        aria-label={title}
      >
        <ExternalLink size={iconSize} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            className="relative w-full rounded-t-2xl border border-white/10 bg-brand-dark p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <button onClick={close} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar">
              <X size={18} />
            </button>

            {/* Casa */}
            <div className="mb-3 pr-8">
              <span className="inline-flex items-center rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10">
                <BookmakerTag slug={leg.bookmaker} size={18} />
              </span>
            </div>

            {/* Evento */}
            <div className="mb-3">
              <div className="break-words text-base font-bold leading-tight text-white">
                {event.home} <span className="text-sm font-normal text-gray-500">x</span> {event.away}
              </div>
              {(event.league || dateLabel) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                  {event.league && <span className="inline-flex items-center gap-1 min-w-0"><Trophy size={11} className="shrink-0 text-teal-400/60" /> <span className="truncate">{event.league}</span></span>}
                  {dateLabel && <span className="inline-flex items-center gap-1 shrink-0"><Calendar size={11} /> {dateLabel}</span>}
                </div>
              )}
            </div>

            {/* Detalhe da aposta: mercado + seleção + odd + stake */}
            <div className="mb-4 overflow-hidden rounded-xl border border-teal-500/20 bg-teal-500/[0.06]">
              <div className="flex items-stretch">
                <div className="min-w-0 flex-1 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Mercado</div>
                  <div className="break-words text-sm font-semibold text-gray-100">{market}</div>
                  {rawMarket && <div className="mt-0.5 break-words text-[10px] text-gray-500">na casa: <span className="text-gray-400">{rawMarket}</span></div>}
                </div>
                <div className="flex shrink-0 flex-col items-center justify-center border-l border-teal-500/20 bg-teal-500/[0.08] px-4">
                  <div className="text-[10px] uppercase tracking-wider text-teal-400/70">Odd</div>
                  <div className="text-2xl font-bold tabular-nums leading-none text-teal-300">{Number(leg.price).toFixed(2)}</div>
                </div>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-white/10 p-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Seleção</div>
                  <div className="break-words text-sm font-medium text-white">{selection}</div>
                  {rawSelection && <div className="mt-0.5 break-words text-[10px] text-gray-500">na casa: <span className="text-gray-400">{rawSelection}</span></div>}
                </div>
                {leg.size != null && leg.size !== undefined && (
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-gray-500"><Coins size={10} /> Stake</div>
                    <div className="text-sm font-bold tabular-nums text-amber-300">R$ {leg.size}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {/* Selecionar odd (autofill via extensão) */}
              <button
                onClick={doAutofill}
                disabled={!canAutofill}
                className="flex w-full items-start gap-3 rounded-xl bg-teal-500/10 px-3 py-3 text-left ring-1 ring-teal-500/30 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-teal-500/10"
              >
                <Zap size={18} className="mt-0.5 shrink-0 text-teal-300" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-teal-100">Selecionar odd na casa</div>
                  <div className="text-[11px] text-gray-400">
                    {!supported
                      ? 'Casa ainda não integrada para seleção automática.'
                      : !ext
                        ? 'Requer a extensão ArbPrime instalada.'
                        : 'Abre o jogo e adiciona a seleção na cédula automaticamente.'}
                  </div>
                  {supported && !ext && (
                    <a href="/extensao" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-teal-300 hover:underline">
                      Instalar extensão →
                    </a>
                  )}
                </div>
              </button>

              {/* Abrir link (sem preencher) */}
              <button
                onClick={doOpenLink}
                disabled={!href}
                className="flex w-full items-start gap-3 rounded-xl bg-white/5 px-3 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Link2 size={18} className="mt-0.5 shrink-0 text-gray-300" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-100">Abrir link da casa</div>
                  <div className="text-[11px] text-gray-400">Abre a página da casa, sem preencher nada.</div>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default OpenInHouse;
