import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Trophy, Crown, ShieldCheck } from 'lucide-react';
import { apiGateway, LeaderboardEntryDTO } from '@/gateways/api.gateway';
import ComunidadeShell from '@/components/comunidade/ComunidadeShell';
import Avatar from '@/components/comunidade/Avatar';
import FollowButton from '@/components/comunidade/FollowButton';
import EmptyState from '@/components/analytix/EmptyState';
import { Select } from '@/components/ui/Select';
import { pct, profitColor, unwrap } from '@/components/analytix/format';

const WINDOWS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' },
];
const METRICS = [
  { value: 'yield', label: 'Yield' },
  { value: 'roi', label: 'ROI' },
  { value: 'profit', label: 'Lucro (u)' },
  { value: 'winrate', label: 'Acerto' },
];

const fmtU = (u: number) => `${u >= 0 ? '+' : ''}${u.toFixed(2)}u`;

export default function ComunidadeRanking() {
  const router = useRouter();
  const [windowKey, setWindowKey] = useState('30d');
  const [metric, setMetric] = useState('yield');
  const [sport, setSport] = useState('');
  const [items, setItems] = useState<LeaderboardEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const sportOptions = [{ value: '', label: 'Todos esportes' }, { value: 'futebol', label: 'Futebol' }, { value: 'basquete', label: 'Basquete' }, { value: 'tenis', label: 'Tênis' }];

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getLeaderboard({ window: windowKey, metric, sport: sport || undefined });
        if (active) setItems(unwrap<{ items: LeaderboardEntryDTO[] }>(r, { items: [] }).items || []);
      } catch { if (active) setItems([]); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [windowKey, metric, sport]);

  const metricValue = (e: LeaderboardEntryDTO) => {
    if (metric === 'roi') return pct(e.roi, true);
    if (metric === 'profit') return fmtU(e.profitUnits);
    if (metric === 'winrate') return pct(e.winRate);
    return pct(e.yield, true);
  };
  const metricColor = (e: LeaderboardEntryDTO) => {
    if (metric === 'winrate') return 'text-white';
    const v = metric === 'roi' ? e.roi : metric === 'profit' ? e.profitUnits : e.yield;
    return profitColor(v);
  };

  return (
    <ComunidadeShell
      active="ranking"
      title="Ranking"
      subtitle="Apostadores mais consistentes (track record verificado)"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select className="w-32" value={windowKey} onChange={setWindowKey} buttonClassName="bg-black/20 py-1.5" options={WINDOWS} />
        <Select className="w-32" value={metric} onChange={setMetric} buttonClassName="bg-black/20 py-1.5" options={METRICS} />
        <Select className="w-40" value={sport} onChange={setSport} buttonClassName="bg-black/20 py-1.5" options={sportOptions} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Trophy size={22} />} title="Ranking ainda vazio" message="Ainda não há apostadores com amostra suficiente neste período. Publique sua banca e seja um dos primeiros." />
      ) : (
        <div className="space-y-1.5">
          {items.map((e) => (
            <div key={e.handle} className={`flex items-center gap-3 rounded-xl p-2.5 ring-1 ${e.isSelf ? 'bg-teal-500/10 ring-teal-500/40' : 'bg-white/5 ring-white/10'}`}>
              <span className={`w-7 text-center font-bold tabular-nums ${e.rank <= 3 ? 'text-amber-300' : 'text-gray-500'}`}>
                {e.rank === 1 ? <Crown size={16} className="inline" /> : e.rank}
              </span>
              <button onClick={() => router.push(`/comunidade/u/${e.handle}`)} className="flex items-center gap-2 min-w-0 flex-1 group text-left">
                <Avatar src={e.avatar} name={e.displayName} size={34} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-white truncate group-hover:text-teal-300">
                    {e.displayName} {e.isVerifiedTipster && <ShieldCheck size={12} className="text-teal-300 shrink-0" />}
                  </span>
                  <span className="block text-[11px] text-gray-500">@{e.handle} · {e.betsCount} apostas{e.lowSample && ' · amostra baixa'}</span>
                </span>
              </button>
              <div className="text-right shrink-0">
                <div className={`text-base font-bold tabular-nums ${metricColor(e)}`}>{metricValue(e)}</div>
                <div className="text-[10px] text-gray-500">odd méd {e.avgOdd.toFixed(2)}</div>
              </div>
              <div className="shrink-0 hidden sm:block"><FollowButton handle={e.handle} following={e.isFollowing} isSelf={e.isSelf} size="sm" /></div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-gray-500">Ordenado por {METRICS.find((m) => m.value === metric)?.label} com ajuste de amostra — perfis com poucas apostas são puxados para a média da comunidade (evita sorte em amostra pequena dominar o topo).</p>
    </ComunidadeShell>
  );
}
