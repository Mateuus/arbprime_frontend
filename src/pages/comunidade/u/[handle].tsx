import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { BadgeCheck, ShieldCheck, ArrowLeft, CalendarDays } from 'lucide-react';
import { apiGateway, PublicProfileDTO, PublicBetDTO, PublicCurvePointDTO } from '@/gateways/api.gateway';
import ComunidadeShell from '@/components/comunidade/ComunidadeShell';
import FollowButton from '@/components/comunidade/FollowButton';
import Avatar from '@/components/comunidade/Avatar';
import EmptyState from '@/components/analytix/EmptyState';
import { pct, profitColor, fmtDateShort, BRL, unwrap } from '@/components/analytix/format';

const ChartSkeleton = () => <div style={{ height: 260 }} className="rounded-xl bg-white/5 animate-pulse" />;
const PublicCurveChart = dynamic(() => import('@/components/comunidade/PublicCurveChart'), { ssr: false, loading: () => <ChartSkeleton /> });

const fmtU = (u: number | null) => (u == null ? '—' : `${u >= 0 ? '+' : ''}${u.toFixed(2)}u`);

const STATUS_TONE: Record<string, string> = { settled: 'text-emerald-300', open: 'text-amber-300', partially_settled: 'text-sky-300', void: 'text-zinc-400' };

export default function PublicProfilePage() {
  const router = useRouter();
  const handle = typeof router.query.handle === 'string' ? router.query.handle : '';
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [curve, setCurve] = useState<PublicCurvePointDTO[]>([]);
  const [bets, setBets] = useState<PublicBetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!handle) return;
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getPublicProfile(handle);
        if (!active) return;
        if (r.data?.result !== 1) { setNotFound(true); return; }
        setProfile(r.data.data as PublicProfileDTO);
        const [rc, rt] = await Promise.all([apiGateway.getPublicCurve(handle), apiGateway.getPublicTrackRecord(handle, { limit: 30 })]);
        if (!active) return;
        setCurve(unwrap<PublicCurvePointDTO[]>(rc, []));
        setBets(unwrap<{ items: PublicBetDTO[] }>(rt, { items: [] }).items || []);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [handle]);

  if (notFound) {
    return (
      <ComunidadeShell title="Perfil" active="">
        <EmptyState icon={<ArrowLeft size={20} />} title="Perfil não encontrado" message="Este perfil não existe ou não é público." action={<button onClick={() => router.push('/comunidade')} className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">Voltar à comunidade</button>} />
      </ComunidadeShell>
    );
  }

  const s = profile?.stats;

  return (
    <ComunidadeShell title={profile?.displayName || 'Perfil'} active="">
      <button onClick={() => router.push('/comunidade')} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-teal-300 mb-3"><ArrowLeft size={13} /> Comunidade</button>

      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4">
        <Avatar src={profile?.avatar || null} name={profile?.displayName || handle} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-lg font-bold text-white">
            {profile?.displayName || handle}
            {profile?.isVerifiedTipster && <BadgeCheck size={16} className="text-teal-300" />}
          </div>
          <div className="text-xs text-gray-500">@{profile?.handle} · {profile?.followersCount ?? 0} seguidores</div>
          {profile?.bio && <p className="mt-1 text-sm text-gray-400">{profile.bio}</p>}
        </div>
        {profile && <FollowButton handle={profile.handle} following={profile.isFollowing} isSelf={profile.isSelf} />}
      </div>

      {/* Stats verificadas */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-teal-300/80 mb-3"><ShieldCheck size={13} /> Verificado pelo ArbPrime</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
          <Stat label="ROI" value={s ? pct(s.roi, true) : '—'} cls={profitColor(s?.roi)} loading={loading} />
          <Stat label="Yield" value={s ? pct(s.yield, true) : '—'} cls={profitColor(s?.yield)} loading={loading} />
          <Stat label="Acerto" value={s ? pct(s.winRate) : '—'} loading={loading} />
          <Stat label="Odd média" value={s ? s.avgOdd.toFixed(2) : '—'} loading={loading} />
          <Stat label="Lucro" value={s ? (s.totalProfit != null ? BRL(s.totalProfit) : fmtU(s.profitUnits)) : '—'} cls={profitColor(s?.profitUnits)} loading={loading} />
          <Stat label="Apostas" value={s ? String(s.betsCount) : '—'} loading={loading} />
        </div>
      </div>

      {/* Curva */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Evolução (índice base 100)</h2>
        {loading ? <ChartSkeleton /> : curve.length > 1 ? <PublicCurveChart data={curve} /> : <div className="h-[260px] grid place-items-center text-sm text-gray-500">Track record insuficiente para a curva.</div>}
      </section>

      {/* Track record */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Track record</h2>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}</div>
        ) : bets.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">Nenhuma aposta pública ainda.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {bets.map((b) => (
              <li key={b.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm text-white truncate">
                      {b.home || '—'}{b.away ? <span className="text-gray-500"> x {b.away}</span> : ''}
                      {b.verified === 'verified' && <ShieldCheck size={12} className="text-teal-300 shrink-0" />}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={10} /> {fmtDateShort(b.createdAt)}</span>
                      {b.sport ? ` · ${b.sport}` : ''}{b.league ? ` · ${b.league}` : ''}
                      {b.legs.length > 0 && ` · ${b.legs.map((l) => `${l.selection || '?'} @${l.odd.toFixed(2)}`).join(' / ')}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-semibold tabular-nums ${profitColor(b.profitUnits)}`}>
                      {b.realizedProfit != null ? BRL(b.realizedProfit) : fmtU(b.profitUnits)}
                    </div>
                    <div className={`text-[10px] ${STATUS_TONE[b.status] || 'text-gray-500'}`}>
                      {b.status === 'settled' ? 'Liquidada' : b.status === 'open' ? 'Aberta' : b.status === 'void' ? 'Anulada' : 'Parcial'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ComunidadeShell>
  );
}

function Stat({ label, value, cls = 'text-white', loading }: { label: string; value: string; cls?: string; loading?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
      {loading ? <div className="mt-1 h-5 w-12 mx-auto rounded bg-white/10 animate-pulse" /> : <div className={`text-base sm:text-lg font-semibold tabular-nums ${cls}`}>{value}</div>}
    </div>
  );
}
