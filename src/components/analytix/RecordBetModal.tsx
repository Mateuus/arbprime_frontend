import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Loader2, Check, Trash2, Gift, Layers, Dices, Copy } from 'lucide-react';
import { apiGateway, CreateBetDTO, BetDTO, AccountDTO, BankrollDTO } from '@/gateways/api.gateway';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { Select } from '@/components/ui/Select';
import HousePicker from './HousePicker';
import HelpLabel from './HelpLabel';
import { BRL, unwrap } from './format';

export interface RecordBetDraftLeg {
  id?: string;            // edição: casa com a perna existente p/ preservar status
  bookmakerSlug: string;
  houseEventId?: string | null;
  market?: string | null;
  rawMarket?: string | null;
  selection?: string | null;
  handicap?: string | null;
  side?: 'back' | 'lay';
  isFreebet?: boolean;
  odd: number;
  stake: number;
  commissionPct?: number | null;
}

export interface RecordBetDraft {
  betType: 'arb' | 'single' | 'multi';
  eventId?: string | null;
  home?: string | null;
  away?: string | null;
  sport?: string | null;
  league?: string | null;
  eventStart?: string | null;
  surebetKey?: string | null;
  totalStake: number;
  expectedProfitPct?: number | null;
  expectedProfit?: number | null;
  source: 'calculator' | 'manual';
  strategy?: 'valuebet';      // origem da aposta (value bet → banca dedicada)
  stakeFraction?: number | null; // fração de Kelly p/ sugerir stake = fração × banca
  legs: RecordBetDraftLeg[];
}

interface Props {
  draft: RecordBetDraft;
  onClose: () => void;
  onSaved?: (bet: BetDTO | null) => void;
  // Pré-seleciona (e cria sob demanda) a banca dessa finalidade ao abrir.
  preferBankrollKind?: 'general' | 'valuebet';
  // Quando presente: modo EDIÇÃO (PUT na aposta em vez de criar uma nova).
  editBet?: BetDTO;
}

const numFmt = (n: number) => (Number.isFinite(n) ? n : 0);
const field = 'w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition';

// ISO (UTC) ⇄ valor do <input type="datetime-local"> (horário LOCAL "YYYY-MM-DDTHH:mm").
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
// ISO → { date: "YYYY-MM-DD", time: "HH:mm" } para inputs separados de Data e Hora.
const splitLocal = (iso?: string | null): { date: string; time: string } => {
  const v = toLocalInput(iso);
  if (!v) return { date: '', time: '' };
  const [date, time] = v.split('T');
  return { date, time: time || '' };
};

// retorno (caixa recebida) se a perna ganhar — back vs lay (contra).
const legReturn = (l: RecordBetDraftLeg) => {
  const S = numFmt(l.stake), O = numFmt(l.odd), c = numFmt(l.commissionPct || 0) / 100;
  if (l.side === 'lay') return S * (1 - c); // lay vencendo embolsa o stake do backer
  const profit = S * (O - 1) * (1 - c);
  return l.isFreebet ? profit : S + profit;
};
// Responsabilidade (liability) de uma lay = stake × (odd-1); 0 para back.
const legLiability = (l: RecordBetDraftLeg) => (l.side === 'lay' ? numFmt(l.stake) * (numFmt(l.odd) - 1) : 0);

// Seleção de uma múltipla (acumulada).
interface MultiSel { market: string; selection: string; handicap: string; odd: number }

const num = (v: string) => parseFloat(v.replace(',', '.')) || 0;

/**
 * Modal de "Lançar aposta" (e editar). Tipos: Simples, Surebet (N pernas) e
 * Múltipla (acumulada — 1 stake, várias seleções, odds multiplicam). Pré-preenchido
 * pela calculadora (surebet) ou manual; em modo edição recebe `editBet`.
 */
export default function RecordBetModal({ draft, onClose, onSaved, preferBankrollKind, editBet }: Props) {
  const isEdit = !!editBet;
  const fromCalc = draft.source === 'calculator' && !isEdit;
  const manual = draft.source === 'manual' || isEdit; // edição é "manual-like" (campos editáveis)
  const showTypeSelector = !fromCalc; // calculadora trava o tipo (surebet)

  const [betType, setBetType] = useState<'single' | 'arb' | 'multi'>(editBet?.betType ?? draft.betType ?? 'single');

  const [bankrolls, setBankrolls] = useState<BankrollDTO[]>([]);
  const [bankrollId, setBankrollId] = useState<string>(editBet?.bankrollId ?? '');
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);

  // Evento
  const [home, setHome] = useState(editBet?.home ?? draft.home ?? '');
  const [away, setAway] = useState(editBet?.away ?? draft.away ?? '');
  const [sport, setSport] = useState(editBet?.sport ?? draft.sport ?? '');
  const [league, setLeague] = useState(editBet?.league ?? draft.league ?? '');
  const initEvent = splitLocal(editBet?.eventStart ?? draft.eventStart);
  const [eventDate, setEventDate] = useState(initEvent.date);
  const [eventTime, setEventTime] = useState(initEvent.time);
  const [notes, setNotes] = useState(editBet?.notes ?? '');

  // Pernas (simples/surebet)
  const [legs, setLegs] = useState<RecordBetDraftLeg[]>(() => {
    if (editBet && editBet.betType !== 'multi') {
      return editBet.legs.map((l) => ({
        id: l.id, bookmakerSlug: l.bookmakerSlug, houseEventId: l.houseEventId, market: l.market, rawMarket: l.rawMarket,
        selection: l.selection, handicap: l.handicap, side: l.side, isFreebet: l.isFreebet, odd: l.odd, stake: l.stake, commissionPct: l.commissionPct,
      }));
    }
    return draft.legs.map((l) => ({ ...l }));
  });

  // Múltipla
  const multiLeg = editBet?.betType === 'multi' ? editBet.legs[0] : null;
  const [msHouse, setMsHouse] = useState(multiLeg?.bookmakerSlug ?? '');
  const [msStake, setMsStake] = useState<number>(multiLeg?.stake ?? 0);
  const [msFreebet, setMsFreebet] = useState<boolean>(multiLeg?.isFreebet ?? false);
  const [msSels, setMsSels] = useState<MultiSel[]>(() => {
    if (multiLeg?.selections?.length) return multiLeg.selections.map((s) => ({ market: s.market ?? '', selection: s.selection ?? '', handicap: s.handicap ?? '', odd: s.odd }));
    return [{ market: '', selection: '', handicap: '', odd: 2 }, { market: '', selection: '', handicap: '', odd: 2 }];
  });
  const updSel = (i: number, patch: Partial<MultiSel>) => setMsSels((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // Stake em % da banca (só simples/múltipla — onde há um único stake).
  const [pctMode, setPctMode] = useState(false);
  const [pctValue, setPctValue] = useState(2);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addLeg = () => setLegs((prev) => [...prev, { bookmakerSlug: '', odd: 2, stake: 0, selection: '', market: '' }]);
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, j) => j !== i));
  const setLeg = (i: number, patch: Partial<RecordBetDraftLeg>) => setLegs((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // quick-add casa (legs vindas da calculadora, casa ainda não cadastrada)
  const [quickSlug, setQuickSlug] = useState<string | null>(null);
  const [quickLabel, setQuickLabel] = useState('');
  const [quickBalance, setQuickBalance] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const reloadAccounts = async () => setAccounts(unwrap<AccountDTO[]>(await apiGateway.getMyAccounts(), []));

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rb, ra] = await Promise.all([apiGateway.getBankrolls(), apiGateway.getMyAccounts()]);
        if (!active) return;
        let bl = unwrap<BankrollDTO[]>(rb, []);

        let selected: BankrollDTO | undefined;
        if (preferBankrollKind === 'valuebet') {
          let vb = bl.find((b) => b.kind === 'valuebet');
          if (!vb) {
            const created = unwrap<BankrollDTO | null>(await apiGateway.ensureValuebetBankroll(), null);
            if (created) { vb = created; bl = [...bl, created]; }
          }
          selected = vb;
        }
        if (!selected) selected = bl.find((b) => b.isDefault) || bl[0];

        if (!active) return;
        setBankrolls(bl);
        // Em edição mantém a banca da aposta; senão escolhe a default/valuebet.
        if (selected) {
          setBankrollId((prev) => prev || selected!.id);
          if (!isEdit && draft.stakeFraction && draft.stakeFraction > 0 && selected.currentBalance > 0) {
            const suggested = Math.round(draft.stakeFraction * selected.currentBalance * 100) / 100;
            if (suggested > 0) setLegs((prev) => prev.map((l, i) => (i === 0 && !l.stake ? { ...l, stake: suggested } : l)));
          }
        }
        setAccounts(unwrap<AccountDTO[]>(ra, []));
      } catch { /* segue sem banca: backend cria a default */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountFor = (slug: string) => accounts.find((a) => a.slug.toLowerCase() === (slug || '').toLowerCase());

  const totals = useMemo(() => {
    const total = legs.reduce((a, l) => a + (l.isFreebet ? 0 : numFmt(l.stake)), 0);
    const returns = legs.map(legReturn);
    const guaranteed = returns.length ? Math.min(...returns) : 0;
    return { total, guaranteed, profit: guaranteed - total };
  }, [legs]);

  const multiTotals = useMemo(() => {
    const combined = msSels.reduce((p, s) => p * (numFmt(s.odd) || 0), 1);
    const ret = msFreebet ? numFmt(msStake) * (combined - 1) : numFmt(msStake) * combined;
    return { combined, ret, profit: ret - (msFreebet ? 0 : numFmt(msStake)) };
  }, [msSels, msStake, msFreebet]);

  // Stake calculado a partir do % da banca selecionada.
  const bankrollBalance = bankrolls.find((b) => b.id === bankrollId)?.currentBalance ?? 0;
  const pctStake = Math.round((pctValue / 100) * bankrollBalance * 100) / 100;

  // Em modo %, o stake (único) é dirigido pelo percentual × saldo da banca.
  useEffect(() => {
    if (!pctMode || betType === 'arb') return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (betType === 'multi') setMsStake(pctStake);
    else setLegs((prev) => prev.map((l, i) => (i === 0 ? { ...l, stake: pctStake } : l)));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pctMode, pctStake, betType]);

  const pickType = (t: 'single' | 'arb' | 'multi') => {
    setBetType(t);
    if (t === 'single') setLegs((prev) => prev.slice(0, 1)); // simples = 1 perna
    if (t === 'arb') setPctMode(false); // % não se aplica a surebet (vários stakes)
  };

  const submitQuickAdd = async (slug: string) => {
    setQuickSaving(true);
    setError('');
    try {
      const r = await apiGateway.createAccount({ slug, label: quickLabel.trim() || undefined, initialBalance: parseFloat(quickBalance.replace(',', '.')) || 0 });
      if (r.data?.result === 1) { await reloadAccounts(); setQuickSlug(null); setQuickLabel(''); setQuickBalance(''); }
      else setError(r.data?.message || 'Não foi possível cadastrar a casa.');
    } catch { setError('Erro ao cadastrar a casa.'); }
    finally { setQuickSaving(false); }
  };

  const submit = async () => {
    setError('');
    const src = (isEdit ? editBet!.source : draft.source) as 'calculator' | 'manual';
    // Data + Hora separados → ISO (hora vazia = meia-noite).
    const eventStartIso = eventDate ? fromLocalInput(`${eventDate}T${eventTime || '00:00'}`) : null;
    let dto: CreateBetDTO;

    if (betType === 'multi') {
      if (!msHouse) { setError('Escolha a casa da múltipla.'); return; }
      const sels = msSels.filter((s) => numFmt(s.odd) > 0);
      if (sels.length < 2) { setError('A múltipla precisa de pelo menos 2 seleções com odd.'); return; }
      if (!(numFmt(msStake) > 0)) { setError('Informe o stake da múltipla.'); return; }
      dto = {
        bankrollId: bankrollId || undefined,
        betType: 'multi',
        eventId: draft.eventId ?? null,
        home: home || null, away: away || null,
        sport: sport.trim() || null, league: league.trim() || null,
        eventStart: eventStartIso,
        surebetKey: draft.surebetKey ?? null,
        totalStake: numFmt(msStake),
        source: src,
        notes: notes.trim() || null,
        legs: sels.map((s, i) => ({
          bookmakerSlug: msHouse,
          accountId: accountFor(msHouse)?.id || null,
          market: s.market.trim() || null,
          selection: s.selection.trim() || null,
          handicap: s.handicap.trim() || null,
          side: 'back',
          isFreebet: i === 0 ? msFreebet : false,
          odd: numFmt(s.odd),
          stake: 0,
        })),
      };
    } else {
      if (!legs.length) return;
      dto = {
        bankrollId: bankrollId || undefined,
        betType: legs.length > 1 ? 'arb' : 'single',
        eventId: draft.eventId ?? null,
        home: home || null, away: away || null,
        sport: sport.trim() || null, league: league.trim() || null,
        eventStart: eventStartIso,
        surebetKey: draft.surebetKey ?? null,
        totalStake: numFmt(totals.total),
        expectedProfitPct: draft.expectedProfitPct ?? null,
        expectedProfit: draft.expectedProfit ?? null,
        source: src,
        notes: notes.trim() || null,
        legs: legs.map((l) => ({
          id: l.id,
          bookmakerSlug: l.bookmakerSlug,
          accountId: accountFor(l.bookmakerSlug)?.id || null,
          houseEventId: l.houseEventId ?? null,
          market: l.market ?? null,
          rawMarket: l.rawMarket ?? null,
          selection: l.selection ?? null,
          handicap: l.handicap ?? null,
          side: l.side || 'back',
          isFreebet: !!l.isFreebet,
          odd: numFmt(l.odd),
          stake: numFmt(l.stake),
          commissionPct: l.commissionPct ?? null,
        })),
      };
    }

    setSaving(true);
    try {
      const r = isEdit ? await apiGateway.updateBet(editBet!.id, dto) : await apiGateway.createBet(dto);
      if (r.data?.result === 1) { onSaved?.(unwrap<BetDTO | null>(r, null)); onClose(); }
      else setError(r.data?.message || 'Não foi possível salvar a aposta.');
    } catch { setError('Erro ao salvar a aposta.'); }
    finally { setSaving(false); }
  };

  const TYPE_OPTS: { k: 'single' | 'arb' | 'multi'; label: string; icon: React.ReactNode }[] = [
    { k: 'single', label: 'Simples', icon: <Dices size={14} /> },
    { k: 'arb', label: 'Surebet', icon: <Copy size={14} /> },
    { k: 'multi', label: 'Múltipla', icon: <Layers size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-2xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <h2 className="text-lg font-bold text-white pr-8">{isEdit ? 'Editar aposta' : 'Lançar aposta'}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{draft.sport ? `${draft.sport} · ` : ''}{draft.league || 'Registro de aposta'}</p>

        {/* Tipo */}
        {showTypeSelector && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Tipo de aposta</div>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPE_OPTS.map((t) => (
                <button key={t.k} onClick={() => pickType(t.k)}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ring-1 transition ${betType === t.k ? 'bg-teal-500/15 text-teal-200 ring-teal-500/40' : 'text-gray-400 ring-white/10 hover:bg-white/5'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Evento */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-400">Mandante
            <input value={home} onChange={(e) => setHome(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-gray-400">Visitante
            <input value={away} onChange={(e) => setAway(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>

        {manual && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-400">Esporte
              <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="ex.: futebol" className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-gray-400">Campeonato
              <input value={league} onChange={(e) => setLeague(e.target.value)} placeholder="ex.: Copa do Mundo 2026" className={`${field} mt-1`} />
            </label>
          </div>
        )}

        {/* Data + Hora do jogo (kickoff) — campos separados; aparece na lista de apostas */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-400">
            <HelpLabel help="Data em que o jogo acontece. Aparece na coluna Evento da lista de apostas.">Data do jogo</HelpLabel>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-gray-400">Hora
            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>

        {/* Banca */}
        {bankrolls.length > 0 && (
          <div className="mt-3">
            <HelpLabel className="text-xs text-gray-400 mb-1" help="Banca onde esta aposta será contabilizada (entra no lucro/ROI dela).">Banca</HelpLabel>
            <Select value={bankrollId} onChange={setBankrollId} buttonClassName="bg-black/20 py-2"
              options={bankrolls.map((b) => ({ value: b.id, label: `${b.name} — ${BRL(b.currentBalance)}` }))} />
          </div>
        )}

        {/* Valor: R$ ou % da banca (apenas simples/múltipla — um único stake) */}
        {betType !== 'arb' && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <HelpLabel className="text-xs text-gray-400" help="Defina o stake em reais ou como % do saldo da banca selecionada.">Valor da aposta</HelpLabel>
              <div className="inline-flex rounded-lg ring-1 ring-white/10 overflow-hidden text-[11px]">
                <button onClick={() => setPctMode(false)} className={`px-2.5 py-1 transition ${!pctMode ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:bg-white/5'}`}>R$</button>
                <button onClick={() => setPctMode(true)} className={`px-2.5 py-1 transition ${pctMode ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:bg-white/5'}`}>% da banca</button>
              </div>
            </div>
            {pctMode && (
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input value={String(pctValue)} onChange={(e) => setPctValue(num(e.target.value))} inputMode="decimal" className={`${field} text-center`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">de {BRL(bankrollBalance)} = <span className="text-teal-200 font-semibold">{BRL(pctStake)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* ===================== MÚLTIPLA ===================== */}
        {betType === 'multi' ? (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">Múltipla (acumulada)</div>

            <div>
              <HelpLabel className="text-xs text-gray-400 mb-1" help="Casa onde a múltipla foi feita (todas as seleções na mesma casa).">Casa</HelpLabel>
              <HousePicker value={msHouse} onChange={setMsHouse} accounts={accounts} />
            </div>

            <div className="flex items-end gap-2">
              <label className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">{pctMode ? 'Stake (% banca)' : msFreebet ? 'Valor FB (R$)' : 'Stake (R$)'}
                <input value={String(msStake)} onChange={(e) => setMsStake(num(e.target.value))} readOnly={pctMode} inputMode="decimal" className={`${field} mt-0.5 text-center font-bold text-teal-200 ${pctMode ? 'opacity-70 cursor-not-allowed' : ''}`} />
              </label>
              <button onClick={() => setMsFreebet((v) => !v)} title="Freebet (aposta grátis)"
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-2.5 rounded-lg ring-1 transition ${msFreebet ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' : 'text-gray-400 ring-white/10 hover:bg-white/5'}`}>
                <Gift size={12} /> Freebet
              </button>
            </div>

            <div className="space-y-1.5">
              {msSels.map((s, i) => (
                <div key={i} className="rounded-xl p-2.5 ring-1 bg-white/5 ring-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">Seleção {i + 1}</span>
                    {msSels.length > 2 && <button onClick={() => setMsSels((prev) => prev.filter((_, j) => j !== i))} className="p-1 rounded text-rose-300 hover:bg-rose-500/15"><Trash2 size={13} /></button>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <input value={s.selection} onChange={(e) => updSel(i, { selection: e.target.value })} placeholder="Opção (ex.: Brasil)" className={field} />
                    <input value={s.market} onChange={(e) => updSel(i, { market: e.target.value })} placeholder="Mercado (ex.: 1x2)" className={field} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-gray-500">Odd
                      <input value={String(s.odd)} onChange={(e) => updSel(i, { odd: num(e.target.value) })} inputMode="decimal" className={`${field} mt-0.5 w-24 text-center`} />
                    </label>
                  </div>
                </div>
              ))}
              <button onClick={() => setMsSels((prev) => [...prev, { market: '', selection: '', handicap: '', odd: 2 }])} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/15 text-sm text-teal-300 hover:bg-white/5">
                <Plus size={15} /> Adicionar seleção
              </button>
            </div>

            <div className={`rounded-xl p-3 ring-1 ${multiTotals.profit >= 0 ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-rose-500/10 ring-rose-500/30'}`}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Odd combinada</div><div className="text-base font-bold tabular-nums text-white">{multiTotals.combined.toFixed(2)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Retorno</div><div className="text-base font-bold tabular-nums text-white">{BRL(multiTotals.ret)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Lucro</div><div className={`text-base font-bold tabular-nums ${multiTotals.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{multiTotals.profit >= 0 ? '+' : ''}{BRL(multiTotals.profit)}</div></div>
              </div>
              {msFreebet && <div className="mt-1.5 text-center text-[10px] text-amber-300/80">Freebet: ganhando, fica só com o lucro; perdendo, não há prejuízo.</div>}
            </div>
          </div>
        ) : (
          /* ===================== SIMPLES / SUREBET ===================== */
          <>
            <div className="mt-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">Pernas ({legs.length})</div>
              {legs.map((leg, i) => {
                const acc = accountFor(leg.bookmakerSlug);
                const isQuick = quickSlug === leg.bookmakerSlug;
                return (
                  <div key={i} className={`rounded-xl p-2.5 ring-1 ${leg.isFreebet ? 'bg-amber-500/[0.06] ring-amber-500/30' : 'bg-white/5 ring-white/10'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {manual
                          ? <HousePicker value={leg.bookmakerSlug} onChange={(slug) => setLeg(i, { bookmakerSlug: slug })} accounts={accounts} />
                          : <BookmakerTag slug={leg.bookmakerSlug} size={16} nameClassName="text-sm" />}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {manual && (
                          <div className="inline-flex rounded-full ring-1 ring-white/10 overflow-hidden text-[10px]">
                            <button onClick={() => setLeg(i, { side: 'back' })} title="A favor (back)" className={`px-2 py-1 transition ${leg.side !== 'lay' ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:bg-white/5'}`}>A favor</button>
                            <button onClick={() => setLeg(i, { side: 'lay' })} title="Contra (lay)" className={`px-2 py-1 transition ${leg.side === 'lay' ? 'bg-orange-500/20 text-orange-200' : 'text-gray-400 hover:bg-white/5'}`}>Contra</button>
                          </div>
                        )}
                        <button onClick={() => setLeg(i, { isFreebet: !leg.isFreebet })} title="Freebet (aposta grátis)"
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full ring-1 transition ${leg.isFreebet ? 'bg-amber-500/15 text-amber-300 ring-amber-500/40' : 'text-gray-400 ring-white/10 hover:bg-white/5'}`}>
                          <Gift size={12} /> Freebet
                        </button>
                        {!manual && !acc && (
                          <button onClick={() => { setQuickSlug(isQuick ? null : leg.bookmakerSlug); setQuickLabel(''); setQuickBalance(''); }} className="inline-flex items-center gap-1 text-[11px] text-teal-300 hover:text-teal-200">
                            <Plus size={12} /> Cadastrar
                          </button>
                        )}
                        {!manual && acc && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><Check size={12} /> vinculada</span>}
                        {manual && betType === 'arb' && legs.length > 1 && (
                          <button onClick={() => removeLeg(i)} className="p-1 rounded text-rose-300 hover:bg-rose-500/15"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>

                    {manual ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input value={leg.selection || ''} onChange={(e) => setLeg(i, { selection: e.target.value })} placeholder="Seleção (ex.: Casa)" className={field} />
                        {/* Edita o NOME do mercado (rawMarket). Em pernas da calculadora o
                            `market` é o ID canônico (ex.: total-cards...:3202) — esse é
                            preservado e nunca mostrado; o usuário vê/edita o nome. */}
                        <input
                          value={leg.rawMarket || leg.market || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const hasCanonicalId = !!leg.market && leg.market.includes(':');
                            setLeg(i, hasCanonicalId ? { rawMarket: v } : { market: v, rawMarket: v });
                          }}
                          placeholder="Mercado (ex.: 1x2)"
                          className={field}
                        />
                      </div>
                    ) : leg.selection && (
                      <div className="mt-1.5 text-[11px] text-gray-400 truncate">
                        {leg.selection}{leg.handicap ? ` (${leg.handicap})` : ''}{leg.market ? ` · ${leg.market}` : ''}
                      </div>
                    )}

                    <div className="mt-2 flex items-end gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">Odd
                        <input value={String(leg.odd)} onChange={(e) => setLeg(i, { odd: num(e.target.value) })} inputMode="decimal" className={`${field} mt-0.5 text-center`} />
                      </label>
                      <label className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">{leg.side === 'lay' ? 'Bancada (R$)' : leg.isFreebet ? 'Valor FB (R$)' : 'Stake (R$)'}
                        <input value={String(leg.stake)} onChange={(e) => setLeg(i, { stake: num(e.target.value) })} readOnly={pctMode && betType === 'single'} inputMode="decimal" className={`${field} mt-0.5 text-center font-bold text-teal-200 ${pctMode && betType === 'single' ? 'opacity-70 cursor-not-allowed' : ''}`} />
                      </label>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">{leg.side === 'lay' ? 'Ganho' : 'Retorno'}
                        <div className="mt-0.5 px-2 py-2 rounded-lg bg-black/30 text-sm text-white text-center tabular-nums">{BRL(legReturn(leg))}</div>
                      </div>
                    </div>
                    {leg.side === 'lay' && <div className="mt-1.5 text-[10px] text-orange-300/80">Contra (lay): responsabilidade <strong>{BRL(legLiability(leg))}</strong> em risco; ganhando, embolsa a bancada.</div>}

                    {isQuick && (
                      <div className="mt-2 rounded-lg bg-black/20 ring-1 ring-teal-500/20 p-2">
                        <div className="text-[11px] text-teal-200 mb-1.5">Cadastrar conta em <strong>{leg.bookmakerSlug}</strong></div>
                        <div className="flex items-center gap-2">
                          <input value={quickLabel} onChange={(e) => setQuickLabel(e.target.value)} placeholder="Apelido (opcional)" className={field} />
                          <input value={quickBalance} onChange={(e) => setQuickBalance(e.target.value)} placeholder="Saldo R$" inputMode="decimal" className={`${field} w-24`} />
                          <button onClick={() => submitQuickAdd(leg.bookmakerSlug)} disabled={quickSaving} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 text-xs font-semibold disabled:opacity-60 shrink-0">
                            {quickSaving ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />} Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {manual && betType === 'arb' && (
                <button onClick={addLeg} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/15 text-sm text-teal-300 hover:bg-white/5">
                  <Plus size={15} /> Adicionar perna
                </button>
              )}
            </div>

            <div className={`mt-4 rounded-xl p-3 ring-1 ${totals.profit >= 0 ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-rose-500/10 ring-rose-500/30'}`}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Total</div><div className="text-base font-bold tabular-nums text-white">{BRL(totals.total)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Retorno gar.</div><div className="text-base font-bold tabular-nums text-white">{BRL(totals.guaranteed)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Lucro</div><div className={`text-base font-bold tabular-nums ${totals.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{totals.profit >= 0 ? '+' : ''}{BRL(totals.profit)}</div></div>
              </div>
            </div>
          </>
        )}

        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Anotações sobre a aposta (motivo, contexto). Só você vê.">Observações</HelpLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} mt-1 resize-none`} placeholder="Notas sobre esta aposta (opcional)" />
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {isEdit ? 'Salvar alterações' : 'Lançar aposta'}
          </button>
        </div>
      </div>
    </div>
  );
}
