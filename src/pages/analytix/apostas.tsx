import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, ListChecks, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGateway, BetDTO, BetLegDTO } from '@/gateways/api.gateway';
import { useBookmakers } from '@/hooks/useBookmakers';
import AnalytixShell from '@/components/analytix/AnalytixShell';
import BankrollSelect from '@/components/analytix/BankrollSelect';
import PeriodSelector from '@/components/analytix/PeriodSelector';
import BetsTable from '@/components/analytix/BetsTable';
import SettleBetModal from '@/components/analytix/SettleBetModal';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';
import EmptyState from '@/components/analytix/EmptyState';
import { Select } from '@/components/ui/Select';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { BookmakerLogo } from '@/components/bookmaker/BookmakerTag';
import { useBankrolls } from '@/components/analytix/useAnalytix';
import { BET_STATUS_OPTIONS, periodRange, PeriodKey, unwrap } from '@/components/analytix/format';

// Lista de páginas com reticências (1 … 4 5 6 … 20).
function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (page > 3) out.push('…');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) out.push(i);
  if (page < totalPages - 2) out.push('…');
  out.push(totalPages);
  return out;
}

function Paginator({ page, totalPages, total, limit, onPage, onLimit }: {
  page: number; totalPages: number; total: number; limit: number;
  onPage: (p: number) => void; onLimit: (l: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn = 'grid place-items-center h-8 min-w-[32px] px-2 rounded-lg text-sm transition disabled:opacity-40';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-gray-400">
        Mostrando <span className="text-gray-200">{from}–{to}</span> de <span className="text-gray-200">{total}</span> aposta{total === 1 ? '' : 's'}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${btn} bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10`} title="Anterior"><ChevronLeft size={16} /></button>
          {pageList(page, totalPages).map((n, i) =>
            n === '…'
              ? <span key={`e${i}`} className="px-1.5 text-gray-600">…</span>
              : <button key={n} onClick={() => onPage(n)} className={`${btn} ${n === page ? 'bg-teal-500 text-slate-900 font-semibold' : 'bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10'}`}>{n}</button>,
          )}
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={`${btn} bg-white/5 ring-1 ring-white/10 text-gray-200 hover:bg-white/10`} title="Próxima"><ChevronRight size={16} /></button>
        </div>
      )}

      <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none">
        <option value={25}>25 / página</option>
        <option value={50}>50 / página</option>
        <option value={100}>100 / página</option>
      </select>
    </div>
  );
}

const blankDraft = (): RecordBetDraft => ({
  betType: 'single', source: 'manual', totalStake: 0,
  legs: [{ bookmakerSlug: '', odd: 2, stake: 0, selection: '', market: '' }],
});

// Draft mínimo p/ abrir o modal em modo EDIÇÃO (o editBet preenche o resto).
const draftFromBet = (b: BetDTO): RecordBetDraft => ({
  betType: b.betType, source: b.source === 'calculator' ? 'calculator' : 'manual', totalStake: b.totalStake,
  eventId: b.eventId, surebetKey: b.surebetKey, home: b.home, away: b.away, sport: b.sport, league: b.league, eventStart: b.eventStart, legs: [],
});

export default function AnalytixApostas() {
  const { bookmakers } = useBookmakers();
  const { bankrolls, selectedId, select } = useBankrolls();
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [status, setStatus] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [page, setPage] = useState(1);

  const [bets, setBets] = useState<BetDTO[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);

  const [settle, setSettle] = useState<{ bet: BetDTO; legId: string } | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [editBet, setEditBet] = useState<BetDTO | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ bet: BetDTO; leg: BetLegDTO } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    const range = periodRange(period);
    try {
      const r = await apiGateway.getBets({
        bankrollId: selectedId || undefined,
        status: status || undefined,
        bookmaker: bookmaker || undefined,
        ...range,
        page,
        limit,
      });
      const data = unwrap<{ items: BetDTO[]; total: number; totalPages: number }>(r, { items: [], total: 0, totalPages: 1 });
      setBets(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [selectedId, status, bookmaker, period, page, limit]);

  useEffect(() => { void load(); }, [load]);

  // Reset de página ao mudar filtros (em handlers — evita setState dentro de efeito).
  const onPeriod = (p: PeriodKey) => { setPeriod(p); setPage(1); };
  const onBankroll = (id: string) => { select(id); setPage(1); };
  const onStatus = (v: string) => { setStatus(v); setPage(1); };
  const onBookmaker = (v: string) => { setBookmaker(v); setPage(1); };
  const clearFilters = () => { setStatus(''); setBookmaker(''); setPeriod('all'); setPage(1); };

  // Exclui UMA perna (aposta individual). Se era a última, o backend apaga a aposta toda.
  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await apiGateway.deleteLeg(confirmDel.bet.id, confirmDel.leg.id);
      setConfirmDel(null);
      notify('Aposta excluída.');
      void load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnalytixShell
      active="apostas"
      title="Apostas"
      subtitle={`${total} aposta${total === 1 ? '' : 's'} registrada${total === 1 ? '' : 's'}`}
      actions={(
        <>
          <BankrollSelect bankrolls={bankrolls} selectedId={selectedId} onChange={onBankroll} />
          <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">
            <Plus size={16} /> Aposta manual
          </button>
        </>
      )}
    >
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Filter size={13} /> Filtros:</span>
        <PeriodSelector value={period} onChange={onPeriod} />
        <Select className="w-36" value={status} onChange={onStatus} buttonClassName="bg-black/20 py-1.5"
          options={BET_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        <Select className="w-44" value={bookmaker} onChange={onBookmaker} buttonClassName="bg-black/20 py-1.5"
          options={[
            { value: '', label: 'Todas as casas' },
            ...bookmakers.map((b) => ({
              value: b.slug,
              label: b.name,
              color: b.color || undefined,
              icon: <BookmakerLogo name={b.name} slug={b.slug} logoUrl={b.logoUrl} color={b.color} size={16} />,
            })),
          ]} />
        {(status || bookmaker || period !== 'all') && (
          <button onClick={clearFilters} className="text-xs text-teal-300 hover:text-teal-200">Limpar</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : bets.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={22} />}
          title={status || bookmaker || period !== 'all' ? 'Nenhuma aposta para esses filtros' : 'Você ainda não registrou apostas'}
          message={status || bookmaker || period !== 'all' ? 'Ajuste os filtros para ver outras apostas.' : 'Lance uma surebet pela calculadora do ArbBets ou adicione uma aposta manual.'}
          action={<button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Aposta manual</button>}
        />
      ) : (
        <>
          <BetsTable
            bets={bets}
            onSettle={(bet, leg) => setSettle({ bet, legId: leg.id })}
            onEdit={setEditBet}
            onDelete={(bet, leg) => setConfirmDel({ bet, leg })}
          />
          {total > 0 && (
            <Paginator
              page={page} totalPages={totalPages} total={total} limit={limit}
              onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }}
            />
          )}
        </>
      )}

      {settle && <SettleBetModal bet={settle.bet} legId={settle.legId} onClose={() => setSettle(null)} onSettled={() => { notify('Aposta liquidada.'); void load(); }} />}
      {showRecord && <RecordBetModal draft={blankDraft()} onClose={() => setShowRecord(false)} onSaved={() => { notify('Aposta lançada.'); void load(); }} />}
      {editBet && <RecordBetModal draft={draftFromBet(editBet)} editBet={editBet} onClose={() => setEditBet(null)} onSaved={() => { notify('Aposta atualizada.'); void load(); }} />}
      {confirmDel && (
        <ConfirmModal
          title="Excluir aposta"
          message="Tem certeza que deseja excluir esta aposta? Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          danger
          loading={deleting}
          onConfirm={doDelete}
          onClose={() => setConfirmDel(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </AnalytixShell>
  );
}
