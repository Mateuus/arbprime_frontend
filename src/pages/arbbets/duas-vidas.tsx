import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Zap, RefreshCcw, Search, HelpCircle, X, Sigma, ShieldAlert, TrendingUp, Settings, AlertTriangle, Layers } from 'lucide-react';
import { useSurebets } from '@/hooks/useSurebets';
import { useUserContext } from '@/context/UserContext';
import { Select } from '@/components/ui/Select';
import { Tooltip } from '@/components/ui/Tooltip';
import { DuasVidasCard } from '@/components/arbbets/DuasVidasCard';
import { DuasVidasCalcModal } from '@/components/arbbets/DuasVidasCalcModal';
import { LeagueSidebar, LeagueFilterMobile, buildLeagueTree } from '@/components/arbbets/LeagueFilter';
import { apiGateway } from '@/gateways/api.gateway';
import { FilterDTO } from '@/interfaces';
import { DuasVidasData, DuasVidas } from '@/interfaces/duasvidas.interface';

interface Flat { event: DuasVidasData; sb: DuasVidas }
type SortMode = 'apparent' | 'ev' | 'value' | 'time';

export default function DuasVidasPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useUserContext();

  const [autoUpdate, setAutoUpdate] = useState(true);
  const { data: rawData, loading } = useSurebets('duasvidas', autoUpdate, isAuthenticated);
  const data = rawData as unknown as DuasVidasData[];

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('apparent');
  const [infoOpen, setInfoOpen] = useState(false);
  const [calc, setCalc] = useState<{ id: string; sbId: string } | null>(null);
  // Campeonatos (país → liga)
  const [country, setCountry] = useState('');
  const [league, setLeague] = useState('');
  // Filtro salvo do usuário (ABFilter) — mesmas CASAS dos surebets/DG (exclui casas indesejadas).
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string }[]>([]);
  const [activeFilterId, setActiveFilterId] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterDTO | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Carrega filtros salvos e auto-seleciona (lembra a escolha; senão o 1º).
  useEffect(() => {
    apiGateway.getUserFilters().then((r) => {
      if (r.data?.result !== 1 || !Array.isArray(r.data.data)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: { id: string; name: string }[] = r.data.data.map((f: any) => ({ id: String(f.id), name: f.name }));
      setSavedFilters(list);
      const stored = typeof window !== 'undefined' ? localStorage.getItem('duasvidas:filter') : null;
      if (stored === null) { if (list.length) setActiveFilterId(list[0].id); }
      else if (stored && list.some((f) => f.id === stored)) setActiveFilterId(stored);
    }).catch(() => {});
  }, []);
  const selectFilter = (idv: string) => { setActiveFilterId(idv); if (typeof window !== 'undefined') localStorage.setItem('duasvidas:filter', idv); };
  useEffect(() => {
    if (!activeFilterId) { setActiveFilter(null); return; }
    let active = true;
    apiGateway.getFilterById(activeFilterId).then((r) => { if (active && r.data?.result === 1) setActiveFilter(r.data.data as FilterDTO); }).catch(() => {});
    return () => { active = false; };
  }, [activeFilterId]);

  const leagueTree = useMemo(() => buildLeagueTree(data), [data]);

  const items = useMemo<Flat[]>(() => {
    const q = search.trim().toLowerCase();
    const f = activeFilter;
    const flat: Flat[] = [];
    for (const g of data) {
      if (country && (g.country || '') !== country) continue;
      if (league && (g.league || '') !== league) continue;
      if (f?.sports?.length && !f.sports.map((s) => s.toLowerCase()).includes((g.sport || '').toLowerCase())) continue;
      if (q && !`${g.home} ${g.away} ${g.league}`.toLowerCase().includes(q)) continue;
      for (const sb of g.surebets) {
        // Filtro salvo: TODAS as casas usadas (cobertura + múltipla) têm que estar no preset.
        if (f?.bookmakers?.length && !sb.surebet.every((l) => f.bookmakers.includes(l.bookmaker))) continue;
        flat.push({ event: g, sb });
      }
    }
    flat.sort((a, b) => {
      if (sortMode === 'ev') return b.sb.trueEV - a.sb.trueEV;
      if (sortMode === 'value') return (b.sb.parlayEdge ?? -Infinity) - (a.sb.parlayEdge ?? -Infinity);
      if (sortMode === 'time') {
        const ta = new Date(a.event.date).getTime(), tb = new Date(b.event.date).getTime();
        return (Number.isFinite(ta) ? ta : Infinity) - (Number.isFinite(tb) ? tb : Infinity);
      }
      return b.sb.apparentMargin - a.sb.apparentMargin;
    });
    return flat;
  }, [data, search, sortMode, country, league, activeFilter]);

  const total = useMemo(() => data.reduce((acc, g) => acc + g.surebets.length, 0), [data]);

  const activeCalc = useMemo(() => {
    if (!calc) return null;
    const ev = data.find((g) => g.id === calc.id);
    const sb = ev?.surebets.find((s) => s.id === calc.sbId);
    return ev && sb ? { event: ev, sb } : null;
  }, [calc, data]);

  if (!isAuthenticated) {
    return (
      <div className="w-full px-3 sm:px-6 py-6">
        <div className="mx-auto max-w-md mt-16 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          {authLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Verificando acesso...</div>
          ) : (
            <>
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-fuchsia-500/15 ring-1 ring-fuchsia-500/30 mb-4"><Zap className="text-fuchsia-300" size={24} /></div>
              <h2 className="text-lg font-bold text-white">Entre para ver o Duas Vidas</h2>
              <p className="text-sm text-gray-400 mt-1 mb-5">As oportunidades de Duas Vidas são exclusivas para usuários logados.</p>
              <button onClick={() => router.push({ pathname: '/arbbets/duas-vidas', query: { ...router.query, modal: 'auth', page: 'login' } }, undefined, { shallow: true })} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-semibold transition">Fazer login</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      {/* Cabeçalho */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-fuchsia-500/5 ring-1 ring-fuchsia-500/30"><Zap className="text-fuchsia-300" size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Duas Vidas</h1>
            <p className="text-sm text-gray-400">Turbine a zebra com um favorito-PA de outro jogo — surebet condicional</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block"><div className="text-2xl font-bold text-white tabular-nums">{total}</div><div className="text-[11px] uppercase tracking-wider text-gray-400">oportunidades</div></div>
          <Tooltip label="O que é o Duas Vidas?"><button onClick={() => setInfoOpen(true)} className="grid place-items-center h-9 w-9 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-fuchsia-200 hover:border-fuchsia-500/40 transition" aria-label="O que é?"><HelpCircle size={16} /></button></Tooltip>
          <Tooltip label={autoUpdate ? 'Auto-update ligado' : 'Auto-update desligado'}><button onClick={() => setAutoUpdate((v) => !v)} className={`grid place-items-center h-9 w-9 rounded-lg border transition ${autoUpdate ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200' : 'bg-white/5 border-white/10 text-gray-400'}`} aria-label="Auto-update"><RefreshCcw size={16} className={autoUpdate && loading ? 'animate-spin' : ''} /></button></Tooltip>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar evento, liga..." className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/50 transition" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Select className="w-40" value={activeFilterId} onChange={selectFilter} options={[{ value: '', label: 'Sem filtro salvo' }, ...savedFilters.map((f) => ({ value: f.id, label: f.name }))]} />
          <Tooltip label="Gerenciar filtros salvos (casas)">
            <button onClick={() => router.push({ pathname: router.pathname, query: { ...router.query, modal: 'user', page: 'abfilter' } }, undefined, { shallow: true })} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-fuchsia-300"><Settings size={15} /></button>
          </Tooltip>
        </div>
        <Select className="w-52" value={sortMode} onChange={(v) => setSortMode(v as SortMode)} options={[
          { value: 'apparent', label: 'Maior margem aparente' },
          { value: 'ev', label: 'Maior EV real' },
          { value: 'value', label: 'Maior valor do booster' },
          { value: 'time', label: 'Horário (mais perto)' },
        ]} />
      </div>

      <LeagueFilterMobile tree={leagueTree} total={data.length} country={country} league={league} onPick={(c, l) => { setCountry(c); setLeague(l); }} />

      <div className="flex gap-4">
        <LeagueSidebar tree={leagueTree} total={data.length} country={country} league={league} accent="fuchsia" onPick={(c, l) => { setCountry(c); setLeague(l); }} />
        <div className="flex-1 min-w-0">
          {loading && !data.length ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-400"><RefreshCcw className="animate-spin" size={18} /> Carregando Duas Vidas...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <div className="grid place-items-center h-12 w-12 mx-auto rounded-xl bg-white/5 ring-1 ring-white/10 mb-3"><Zap className="text-gray-500" size={22} /></div>
              <p className="text-sm text-gray-400">Nenhuma oportunidade com os filtros atuais. Elas aparecem e somem conforme as odds (e os resultados PA) andam.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
              {items.map(({ event, sb }) => (
                <DuasVidasCard key={`${event.id}:${sb.id}`} event={event} sb={sb} onCalc={() => setCalc({ id: event.id, sbId: sb.id })} onExplain={() => setInfoOpen(true)} notify={notify} />
              ))}
            </div>
          )}
        </div>
      </div>

      {infoOpen && <DuasVidasExplainModal onClose={() => setInfoOpen(false)} />}
      {activeCalc && <DuasVidasCalcModal event={activeCalc.event} sb={activeCalc.sb} onClose={() => setCalc(null)} notify={notify} />}
      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] rounded-lg bg-black/90 px-4 py-2 text-sm text-white ring-1 ring-white/10 shadow-xl">{toast}</div>}
    </div>
  );
}

function DuasVidasExplainModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-brand-dark p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-rose-400" aria-label="Fechar"><X size={18} /></button>

        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30"><Zap size={18} /></span>
          <h2 className="text-lg font-bold text-white">O que é o Duas Vidas?</h2>
        </div>

        {/* Aviso de risco em destaque */}
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="text-[13px] leading-relaxed text-rose-100/90"><strong className="text-rose-200">NÃO é uma surebet.</strong> É uma aposta com <strong>risco assumido</strong>: existe um cenário em que você perde tudo o que apostou. A margem "aparente" parece um lucro garantido, mas não é — sempre olhe o <strong>EV real</strong> e a <strong>probabilidade de perda</strong>.</p>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-gray-300">
          <p>Num jogo 1X2 que <strong>não</strong> fecha como surebet, a gente <strong className="text-fuchsia-300">turbina a zebra</strong>: multiplica a odd dela por um <strong className="text-amber-300">favorito (com PA) de outro jogo</strong>, formando uma múltipla na <strong>mesma casa</strong> (é um bilhete só). As outras duas pontas cobrem o resto:</p>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] px-3 py-2 ring-1 ring-emerald-500/20"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-300">1</span><span className="text-[13px]"><strong className="text-white">Favorito do jogo</strong> — 1ª vida (cobertura)</span></div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/[0.06] px-3 py-2 ring-1 ring-emerald-500/20"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-[11px] font-bold text-emerald-300">2</span><span className="text-[13px]"><strong className="text-white">Empate</strong> — 2ª vida (cobertura)</span></div>
            <div className="flex items-center gap-2 rounded-lg bg-fuchsia-500/[0.08] px-3 py-2 ring-1 ring-fuchsia-500/25"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-fuchsia-500/15 text-fuchsia-300"><Zap size={12} className="fill-fuchsia-300/40" /></span><span className="text-[13px]"><strong className="text-white">Múltipla</strong> — zebra × favorito-2 (a aposta de valor)</span></div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Os 4 desfechos</div>
            <ul className="space-y-1 text-[13px]">
              <li className="flex gap-2"><TrendingUp size={15} className="mt-0.5 shrink-0 text-emerald-400" /> Favorito vence → lucro pequeno ✅</li>
              <li className="flex gap-2"><TrendingUp size={15} className="mt-0.5 shrink-0 text-emerald-400" /> Empate → lucro pequeno ✅</li>
              <li className="flex gap-2"><TrendingUp size={15} className="mt-0.5 shrink-0 text-emerald-400" /> Zebra vence <strong>e</strong> favorito-2 vence → múltipla bate (pagão) ✅</li>
              <li className="flex gap-2"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-400" /> Zebra vence <strong>e</strong> favorito-2 falha → <strong className="text-rose-300">perde tudo</strong> ⚠️</li>
            </ul>
          </div>

          <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
            <div className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-200"><Sigma size={13} className="text-amber-300" /> Como ler os números</div>
            <ul className="space-y-1 text-[12px] text-gray-400">
              <li><strong className="text-white">Aparente</strong>: como se a múltipla fosse perna única (o gancho).</li>
              <li><strong className="text-white">EV real</strong> = aparente − prob. de perda. O honesto — costuma ser <strong>negativo</strong>.</li>
              <li><strong className="text-white">Perde</strong>: a chance do cenário ⚠️ (zebra vence, favorito-2 falha).</li>
              <li><strong className="text-white">Odd justa / valor</strong> (Pinnacle): ajuda a escolher um 2º jogo melhor.</li>
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] p-3 ring-1 ring-amber-500/20">
            <Layers size={16} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="text-[13px] text-amber-100/90">O <strong className="text-amber-200">PA</strong> (Pagamento Antecipado) do favorito-2 é a sua rede: se ele abrir 2 a 0, a perna já é paga como vencedora — então o risco real é <strong>menor</strong> que o "perde" exibido (mostramos sempre o pior caso). E se o 2º jogo começa antes, dá pra usar a <strong>janela de hedge</strong> na calculadora pra limitar a perda.</p>
          </div>
        </div>

        <button onClick={onClose} className="mt-4 w-full rounded-lg bg-fuchsia-500 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-400">Entendi o risco</button>
      </div>
    </div>
  );
}
