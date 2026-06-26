import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Rss, ShieldCheck, BadgeCheck, RefreshCcw, Users2 } from 'lucide-react';
import { apiGateway, FeedItemDTO } from '@/gateways/api.gateway';
import { useUserContext } from '@/context/UserContext';
import ComunidadeShell from '@/components/comunidade/ComunidadeShell';
import Avatar from '@/components/comunidade/Avatar';
import EmptyState from '@/components/analytix/EmptyState';
import { profitColor, fmtDateShort, BRL, unwrap } from '@/components/analytix/format';

const fmtU = (u: number | null) => (u == null ? '—' : `${u >= 0 ? '+' : ''}${u.toFixed(2)}u`);

export default function ComunidadeFeed() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserContext();
  const [items, setItems] = useState<FeedItemDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void (async () => {
      try {
        const r = await apiGateway.getCommunityFeed({ limit: 30 });
        if (active) setItems(unwrap<{ items: FeedItemDTO[] }>(r, { items: [] }).items || []);
      } catch { if (active) setItems([]); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [isAuthenticated]);

  if (isLoading) {
    return <ComunidadeShell active="feed" title="Feed"><div className="mt-10 flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Carregando...</div></ComunidadeShell>;
  }
  if (!isAuthenticated) {
    return (
      <ComunidadeShell active="feed" title="Feed">
        <EmptyState icon={<Rss size={22} />} title="Entre para ver seu feed" message="Siga apostadores e acompanhe as entradas deles aqui." action={<button onClick={() => router.push({ pathname: '/comunidade/feed', query: { modal: 'auth', page: 'login' } }, undefined, { shallow: true })} className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold">Fazer login</button>} />
      </ComunidadeShell>
    );
  }

  return (
    <ComunidadeShell active="feed" title="Feed" subtitle="Entradas de quem você segue">
      {loading ? (
        <div className="space-y-2 max-w-2xl">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Users2 size={22} />} title="Seu feed está vazio" message="Você ainda não segue ninguém (ou quem você segue não publicou apostas). Descubra apostadores para seguir." action={<Link href="/comunidade" className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm">Descobrir apostadores</Link>} />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {items.map(({ author, bet }) => (
            <div key={bet.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/comunidade/u/${author.handle}`} className="flex items-center gap-2 min-w-0 group">
                  <Avatar src={author.avatar} name={author.displayName} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold text-white truncate group-hover:text-teal-300">
                      {author.displayName} {author.isVerifiedTipster && <BadgeCheck size={13} className="text-teal-300 shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-gray-500">@{author.handle} · {fmtDateShort(bet.createdAt)}</span>
                  </span>
                </Link>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-semibold tabular-nums ${profitColor(bet.profitUnits)}`}>{bet.realizedProfit != null ? BRL(bet.realizedProfit) : fmtU(bet.profitUnits)}</div>
                  <div className="text-[10px] text-gray-500">{bet.status === 'settled' ? 'Liquidada' : bet.status === 'open' ? 'Aberta' : bet.status === 'void' ? 'Anulada' : 'Parcial'}</div>
                </div>
              </div>
              <div className="mt-2 rounded-xl bg-black/20 p-2.5">
                <div className="flex items-center gap-1.5 text-sm text-white">
                  {bet.home || '—'}{bet.away ? <span className="text-gray-500"> x {bet.away}</span> : ''}
                  {bet.verified === 'verified' && <ShieldCheck size={12} className="text-teal-300" />}
                </div>
                <div className="text-[11px] text-gray-500">{[bet.sport, bet.league].filter(Boolean).join(' · ')}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {bet.legs.map((l, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] rounded-md bg-white/5 ring-1 ring-white/10 px-1.5 py-0.5 text-gray-300">
                      <span className="text-gray-500">{l.houseLabel}</span> {l.selection || l.market} <strong className="text-teal-200">@{l.odd.toFixed(2)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ComunidadeShell>
  );
}
