import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Check, Plus, TrendingUp, Percent, Target, Wallet, Trophy, Hourglass } from 'lucide-react';
import { apiGateway, AnalytixSummaryDTO, TimeseriesPointDTO, BreakdownRowDTO, BetDTO } from '@/gateways/api.gateway';
import { useBookmakers } from '@/hooks/useBookmakers';
import AnalytixShell from '@/components/analytix/AnalytixShell';
import KpiCard from '@/components/analytix/KpiCard';
import PeriodSelector from '@/components/analytix/PeriodSelector';
import BankrollSelect from '@/components/analytix/BankrollSelect';
import RecentBetsList from '@/components/analytix/RecentBetsList';
import RecordBetModal, { RecordBetDraft } from '@/components/analytix/RecordBetModal';
import EmptyState from '@/components/analytix/EmptyState';
import { useBankrolls } from '@/components/analytix/useAnalytix';
import { BarRow } from '@/components/analytix/ProfitBars';
import { DonutSlice, topSlices } from '@/components/analytix/DonutBreakdown';
import {
  BRL, signedBRL, pct, profitColor, periodRange, periodBucket, PeriodKey, unwrap,
} from '@/components/analytix/format';

const ChartSkeleton = ({ h = 280 }: { h?: number }) => <div style={{ height: h }} className="rounded-xl bg-white/5 animate-pulse" />;
const BankrollAreaChart = dynamic(() => import('@/components/analytix/BankrollAreaChart'), { ssr: false, loading: () => <ChartSkeleton /> });
const ProfitBars = dynamic(() => import('@/components/analytix/ProfitBars'), { ssr: false, loading: () => <ChartSkeleton h={240} /> });
const DonutBreakdown = dynamic(() => import('@/components/analytix/DonutBreakdown'), { ssr: false, loading: () => <ChartSkeleton h={240} /> });

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  if (!m) return key;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${y.slice(2)}`;
};

const blankDraft = (): RecordBetDraft => ({
  betType: 'single', source: 'manual', totalStake: 0,
  legs: [{ bookmakerSlug: '', odd: 2, stake: 0, selection: '', market: '' }],
});

export default function AnalytixDashboard() {
  const router = useRouter();
  const { getBookmaker } = useBookmakers();
  const { bankrolls, selectedId, select } = useBankrolls();
  const [period, setPeriod] = useState<PeriodKey>('30d');

  const [summary, setSummary] = useState<AnalytixSummaryDTO | null>(null);
  const [series, setSeries] = useState<TimeseriesPointDTO[]>([]);
  const [byBk, setByBk] = useState<BreakdownRowDTO[]>([]);
  const [bySport, setBySport] = useState<BreakdownRowDTO[]>([]);
  const [byMonth, setByMonth] = useState<BreakdownRowDTO[]>([]);
  const [recent, setRecent] = useState<BetDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRecord, setShowRecord] = useState(false);
  const [toast, setToast] = useState('');

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    const range = periodRange(period);
    const bk = selectedId || undefined;
    try {
      const [rs, rt, rbk, rsp, rmo, rbets] = await Promise.all([
        apiGateway.getAnalytixSummary({ bankrollId: bk, ...range }),
        apiGateway.getAnalytixTimeseries({ bankrollId: bk, ...range, bucket: periodBucket(period) }),
        apiGateway.getAnalytixBreakdown({ by: 'bookmaker', bankrollId: bk, ...range }),
        apiGateway.getAnalytixBreakdown({ by: 'sport', bankrollId: bk, ...range }),
        apiGateway.getAnalytixBreakdown({ by: 'month', bankrollId: bk, ...range }),
        apiGateway.getBets({ bankrollId: bk, page: 1, limit: 8 }),
      ]);
      setSummary(unwrap<AnalytixSummaryDTO | null>(rs, null));
      setSeries(unwrap<TimeseriesPointDTO[]>(rt, []));
      setByBk(unwrap<BreakdownRowDTO[]>(rbk, []));
      setBySport(unwrap<BreakdownRowDTO[]>(rsp, []));
      setByMonth(unwrap<BreakdownRowDTO[]>(rmo, []));
      setRecent(unwrap<{ items: BetDTO[] }>(rbets, { items: [] }).items || []);
    } finally {
      setLoading(false);
    }
  }, [period, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const sparkCum = series.map((p) => p.cumulativeProfit);
  const sparkBank = series.map((p) => p.bankroll);

  const bkRows: BarRow[] = byBk.slice(0, 8).map((r) => ({ key: r.key, label: getBookmaker(r.key)?.name || r.key, profit: r.profit }));
  const monthRows: BarRow[] = [...byMonth].sort((a, b) => (a.key < b.key ? -1 : 1)).map((r) => ({ key: r.key, label: monthLabel(r.key), profit: r.profit }));
  const sportSlices: DonutSlice[] = topSlices(bySport.map((r) => ({ key: r.key, label: r.key, value: r.turnover })));

  const isEmpty = !loading && summary && summary.betsCount === 0 && recent.length === 0;

  return (
    <AnalytixShell
      active="painel"
      title="Painel Analytix"
      subtitle="Acompanhe seu desempenho, banca e ROI"
      actions={(
        <>
          <PeriodSelector value={period} onChange={setPeriod} />
          <BankrollSelect bankrolls={bankrolls} selectedId={selectedId} onChange={select} />
          <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">
            <Plus size={16} /> Aposta manual
          </button>
        </>
      )}
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Lucro total" loading={loading} icon={<TrendingUp size={16} />}
          value={summary ? signedBRL(summary.totalProfit) : '—'} valueClass={profitColor(summary?.totalProfit)}
          spark={sparkCum} sparkColor={(summary?.totalProfit || 0) >= 0 ? '#34d399' : '#fb7185'} />
        <KpiCard label="ROI" loading={loading} icon={<Percent size={16} />}
          value={summary ? pct(summary.roi, true) : '—'} valueClass={profitColor(summary?.roi)} />
        <KpiCard label="Yield" loading={loading} icon={<Target size={16} />}
          value={summary ? pct(summary.yield, true) : '—'} valueClass={profitColor(summary?.yield)} />
        <KpiCard label="Taxa de acerto" loading={loading} icon={<Trophy size={16} />}
          value={summary ? pct(summary.winRate) : '—'}
          delta={summary ? `${summary.settledCount} liquidadas` : ''} />
        <KpiCard label="Pendente" loading={loading} icon={<Hourglass size={16} />}
          value={summary ? BRL(summary.pendingStake) : '—'}
          delta={summary ? `${summary.openCount} em aberto` : ''} />
        <KpiCard label="Banca atual" loading={loading} icon={<Wallet size={16} />}
          value={summary ? BRL(summary.currentBankroll) : '—'} spark={sparkBank} sparkColor="#5eead4" />
      </div>

      {isEmpty ? (
        <EmptyState
          className="mt-6"
          icon={<TrendingUp size={22} />}
          title="Você ainda não registrou apostas"
          message="Encontre uma surebet no ArbBets e clique em 'Lançar aposta' na calculadora, ou adicione uma aposta manual."
          action={(
            <div className="flex gap-2">
              <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><Plus size={16} /> Aposta manual</button>
              <button onClick={() => router.push('/arbbets')} className="px-4 py-2 rounded-lg bg-white/5 ring-1 ring-white/10 text-gray-200 text-sm hover:bg-white/10">Ir para ArbBets</button>
            </div>
          )}
        />
      ) : (
        <>
          {/* Curva da banca */}
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-gray-200 mb-3">Evolução da banca</h2>
            {loading ? <ChartSkeleton /> : series.length > 1 ? <BankrollAreaChart data={series} /> : <div className="h-[280px] grid place-items-center text-sm text-gray-500">Liquide apostas para ver a evolução.</div>}
          </section>

          {/* Recortes */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-gray-200 mb-3">Lucro por mês</h2>
              {loading ? <ChartSkeleton h={240} /> : monthRows.length ? <ProfitBars rows={monthRows} /> : <div className="h-[240px] grid place-items-center text-sm text-gray-500">Sem dados.</div>}
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-gray-200 mb-3">Lucro por casa</h2>
              {loading ? <ChartSkeleton h={240} /> : bkRows.length ? <ProfitBars rows={bkRows} horizontal /> : <div className="h-[240px] grid place-items-center text-sm text-gray-500">Sem dados.</div>}
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-gray-200 mb-3">Volume por esporte</h2>
              {loading ? <ChartSkeleton h={240} /> : <DonutBreakdown slices={sportSlices} />}
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold text-gray-200 mb-3">Apostas recentes</h2>
              <RecentBetsList bets={recent} />
              <button onClick={() => router.push('/analytix/apostas')} className="mt-3 text-xs text-teal-300 hover:text-teal-200">Ver todas as apostas →</button>
            </section>
          </div>
        </>
      )}

      {showRecord && <RecordBetModal draft={blankDraft()} onClose={() => setShowRecord(false)} onSaved={() => { notify('Aposta lançada.'); void load(); }} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[10001] rounded-xl bg-brand-dark border border-white/10 shadow-2xl px-4 py-2.5 text-sm text-gray-100 flex items-center gap-2">
          <Check size={15} className="text-emerald-300" /> {toast}
        </div>
      )}
    </AnalytixShell>
  );
}
