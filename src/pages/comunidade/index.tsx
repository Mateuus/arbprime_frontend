import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BadgeCheck, Users2, TrendingUp, Settings2, Trophy, Flame, Store, Target } from 'lucide-react';
import { apiGateway, ProfileCardDTO, CommunityAnalyticsDTO } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import ComunidadeShell from '@/components/comunidade/ComunidadeShell';
import FollowButton from '@/components/comunidade/FollowButton';
import Avatar from '@/components/comunidade/Avatar';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import KpiCard from '@/components/analytix/KpiCard';
import EmptyState from '@/components/analytix/EmptyState';
import { Select } from '@/components/ui/Select';
import { pct, profitColor, unwrap } from '@/components/analytix/format';

const WINDOWS = [
  { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: 'all', label: 'Tudo' },
];

function BreakdownList({ rows }: { rows: { key: string; betsCount: number; yield: number }[] }) {
  if (!rows.length) return <div className="py-6 text-center text-xs text-gray-500">Sem dados no período.</div>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-300 truncate capitalize">{r.key}</span>
          <span className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-gray-500">{r.betsCount}</span>
            <span className={`tabular-nums font-semibold ${profitColor(r.yield)}`}>{pct(r.yield, true)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ComunidadeHub() {
  const router = useRouter();
  const { isAuthenticated } = useUserContext();
  const [profiles, setProfiles] = useState<ProfileCardDTO[]>([]);
  const [analytics, setAnalytics] = useState<CommunityAnalyticsDTO | null>(null);
  const [windowKey, setWindowKey] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getCommunityProfiles();
        if (active) setProfiles(unwrap<ProfileCardDTO[]>(r, []));
      } catch { if (active) setProfiles([]); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getCommunityAnalytics({ window: windowKey });
        if (active) setAnalytics(unwrap<CommunityAnalyticsDTO | null>(r, null));
      } catch { if (active) setAnalytics(null); }
    })();
    return () => { active = false; };
  }, [windowKey]);

  const k = analytics?.kpis;
  const topYield = [...profiles].sort((a, b) => b.yield - a.yield).slice(0, 5);

  return (
    <ComunidadeShell
      active="descobrir"
      title="Comunidade"
      subtitle="Desempenho da base e apostadores verificados"
      actions={(
        <>
          <Select className="w-28" value={windowKey} onChange={setWindowKey} buttonClassName="bg-black/20 py-1.5" options={WINDOWS} />
          <button onClick={() => router.push(isAuthenticated ? '/comunidade/perfil' : { pathname: '/comunidade', query: { modal: 'auth', page: 'login' } })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">
            <Settings2 size={16} /> {isAuthenticated ? 'Meu perfil' : 'Entrar'}
          </button>
        </>
      )}
    >
      {/* KPIs da comunidade */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Apostadores ativos" icon={<Users2 size={16} />} value={k ? String(k.activeUsers) : '—'} />
        <KpiCard label="Apostas" icon={<Target size={16} />} value={k ? String(k.totalBets) : '—'} delta={k ? `${k.settledBets} liquidadas` : ''} />
        <KpiCard label="Yield da comunidade" icon={<TrendingUp size={16} />} value={k ? pct(k.yield, true) : '—'} valueClass={profitColor(k?.yield)} />
        <KpiCard label="Odd média" value={k ? k.avgOdd.toFixed(2) : '—'} />
      </div>

      {/* Recortes da comunidade */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-1.5"><TrendingUp size={15} className="text-teal-300" /> Esportes mais lucrativos</h2>
          <BreakdownList rows={analytics?.bySport || []} />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-1.5"><Target size={15} className="text-teal-300" /> Mercados mais lucrativos</h2>
          <BreakdownList rows={analytics?.byMarket || []} />
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-1.5"><Store size={15} className="text-teal-300" /> Casas mais usadas</h2>
          {(analytics?.byHouse || []).length === 0 ? <div className="py-6 text-center text-xs text-gray-500">Sem dados.</div> : (
            <ul className="space-y-1.5">
              {analytics!.byHouse.map((h) => (
                <li key={h.slug} className="flex items-center justify-between gap-2">
                  <BookmakerTag slug={h.slug} size={16} nameClassName="text-sm" />
                  <span className="text-[11px] text-gray-400 tabular-nums">{h.count} apostas</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-1.5"><Flame size={15} className="text-amber-300" /> Em alta</h2>
          {(analytics?.trending || []).length === 0 ? <div className="py-6 text-center text-xs text-gray-500">Sem eventos.</div> : (
            <ul className="space-y-1.5">
              {analytics!.trending.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-300 truncate">{t.home || '—'}{t.away ? <span className="text-gray-500"> x {t.away}</span> : ''}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{t.count} apostas</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Top por yield (mini) */}
      {topYield.length > 0 && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5"><Trophy size={15} className="text-amber-300" /> Top por yield</h2>
            <Link href="/comunidade/ranking" className="text-xs text-teal-300 hover:text-teal-200">Ver ranking →</Link>
          </div>
          <div className="space-y-1.5">
            {topYield.map((p, i) => (
              <Link key={p.handle} href={`/comunidade/u/${p.handle}`} className="flex items-center gap-3 rounded-lg hover:bg-white/5 p-1.5 transition">
                <span className={`w-5 text-center font-bold tabular-nums ${i < 3 ? 'text-amber-300' : 'text-gray-500'}`}>{i + 1}</span>
                <Avatar src={p.avatar} name={p.displayName} size={28} />
                <span className="text-sm text-white truncate flex-1">{p.displayName} <span className="text-gray-500">@{p.handle}</span></span>
                <span className={`text-sm font-semibold tabular-nums ${profitColor(p.yield)}`}>{pct(p.yield, true)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Apostadores */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Apostadores</h2>
      </div>
      {loading ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={<Users2 size={22} />}
          title="Ninguém publicou ainda"
          message="Seja o primeiro a tornar sua banca pública e mostrar seu desempenho verificado para a comunidade."
          action={<button onClick={() => router.push(isAuthenticated ? '/comunidade/perfil' : { pathname: '/comunidade', query: { modal: 'auth', page: 'login' } })} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm"><TrendingUp size={16} /> Publicar minha banca</button>}
        />
      ) : (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <Link key={p.handle} href={`/comunidade/u/${p.handle}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-teal-500/40 transition block">
              <div className="flex items-center gap-3">
                <Avatar src={p.avatar} name={p.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-semibold text-white truncate">
                    {p.displayName} {p.isVerifiedTipster && <BadgeCheck size={14} className="text-teal-300 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">@{p.handle} · {p.followersCount} seguidores</div>
                </div>
                <FollowButton handle={p.handle} following={p.isFollowing} isSelf={p.isSelf} size="sm" />
              </div>
              {p.bio && <p className="mt-2 text-xs text-gray-400 line-clamp-2">{p.bio}</p>}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center rounded-xl bg-black/20 p-2">
                <div><div className="text-[9px] uppercase tracking-wide text-gray-500">ROI</div><div className={`text-sm font-semibold tabular-nums ${profitColor(p.roi)}`}>{pct(p.roi, true)}</div></div>
                <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Yield</div><div className={`text-sm font-semibold tabular-nums ${profitColor(p.yield)}`}>{pct(p.yield, true)}</div></div>
                <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Acerto</div><div className="text-sm font-semibold tabular-nums text-white">{pct(p.winRate)}</div></div>
                <div><div className="text-[9px] uppercase tracking-wide text-gray-500">Apostas</div><div className="text-sm font-semibold tabular-nums text-white">{p.betsCount}</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </ComunidadeShell>
  );
}
