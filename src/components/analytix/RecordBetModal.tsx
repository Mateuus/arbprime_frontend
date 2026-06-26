import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Loader2, Check, Trash2, Gift } from 'lucide-react';
import { apiGateway, CreateBetDTO, BetDTO, AccountDTO, BankrollDTO } from '@/gateways/api.gateway';
import { BookmakerTag } from '@/components/bookmaker/BookmakerTag';
import { Select } from '@/components/ui/Select';
import HousePicker from './HousePicker';
import HelpLabel from './HelpLabel';
import { BRL, unwrap } from './format';

export interface RecordBetDraftLeg {
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
  betType: 'arb' | 'single';
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
}

const numFmt = (n: number) => (Number.isFinite(n) ? n : 0);
const field = 'w-full bg-black/20 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition';

// retorno (caixa recebida) e lucro de uma perna, comissão só sobre o lucro.
const legReturn = (l: RecordBetDraftLeg) => {
  const profit = numFmt(l.stake) * (numFmt(l.odd) - 1) * (1 - numFmt(l.commissionPct || 0) / 100);
  return l.isFreebet ? profit : numFmt(l.stake) + profit;
};

/**
 * Modal de "Lançar aposta": pré-preenchido pela calculadora (ou manual).
 * Ajusta odd/stake por perna, escolhe banca, vincula/cadastra a casa (busca),
 * marca freebet e registra a aposta no Analytix.
 */
export default function RecordBetModal({ draft, onClose, onSaved, preferBankrollKind }: Props) {
  const [bankrolls, setBankrolls] = useState<BankrollDTO[]>([]);
  const [bankrollId, setBankrollId] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [legs, setLegs] = useState<RecordBetDraftLeg[]>(() => draft.legs.map((l) => ({ ...l })));
  const [notes, setNotes] = useState('');
  const [home, setHome] = useState(draft.home || '');
  const [away, setAway] = useState(draft.away || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const manual = draft.source === 'manual';

  const addLeg = () => setLegs((prev) => [...prev, { bookmakerSlug: '', odd: 2, stake: 0, selection: '', market: '' }]);
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, j) => j !== i));

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

        // Value bet → garante/seleciona a banca DEDICADA (nunca a default).
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
        if (selected) {
          setBankrollId(selected.id);
          // Stake sugerido (Kelly ¼): fração × saldo atual da banca selecionada.
          // Só aplica quando a perna veio sem stake (0) — não sobrescreve edição.
          if (draft.stakeFraction && draft.stakeFraction > 0 && selected.currentBalance > 0) {
            const suggested = Math.round(draft.stakeFraction * selected.currentBalance * 100) / 100;
            if (suggested > 0) {
              setLegs((prev) => prev.map((l, i) => (i === 0 && !l.stake ? { ...l, stake: suggested } : l)));
            }
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
    const profit = guaranteed - total;
    return { total, guaranteed, profit };
  }, [legs]);

  const setLeg = (i: number, patch: Partial<RecordBetDraftLeg>) =>
    setLegs((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submitQuickAdd = async (slug: string) => {
    setQuickSaving(true);
    setError('');
    try {
      const r = await apiGateway.createAccount({ slug, label: quickLabel.trim() || undefined, initialBalance: parseFloat(quickBalance.replace(',', '.')) || 0 });
      if (r.data?.result === 1) {
        await reloadAccounts();
        setQuickSlug(null); setQuickLabel(''); setQuickBalance('');
      } else { setError(r.data?.message || 'Não foi possível cadastrar a casa.'); }
    } catch { setError('Erro ao cadastrar a casa.'); }
    finally { setQuickSaving(false); }
  };

  const submit = async () => {
    if (!legs.length) return;
    setSaving(true);
    setError('');
    try {
      const dto: CreateBetDTO = {
        bankrollId: bankrollId || undefined,
        betType: legs.length > 1 ? 'arb' : 'single',
        eventId: draft.eventId ?? null,
        home: home || null,
        away: away || null,
        sport: draft.sport ?? null,
        league: draft.league ?? null,
        eventStart: draft.eventStart ?? null,
        surebetKey: draft.surebetKey ?? null,
        totalStake: numFmt(totals.total),
        expectedProfitPct: draft.expectedProfitPct ?? null,
        expectedProfit: draft.expectedProfit ?? null,
        source: draft.source,
        notes: notes.trim() || null,
        legs: legs.map((l) => ({
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
      const r = await apiGateway.createBet(dto);
      if (r.data?.result === 1) { onSaved?.(unwrap<BetDTO | null>(r, null)); onClose(); }
      else setError(r.data?.message || 'Não foi possível lançar a aposta.');
    } catch { setError('Erro ao lançar a aposta.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="relative w-full sm:max-w-2xl bg-brand-dark border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-rose-400"><X size={20} /></button>

        <h2 className="text-lg font-bold text-white pr-8">Lançar aposta</h2>
        <p className="text-xs text-gray-400 mt-0.5">{draft.sport ? `${draft.sport} · ` : ''}{draft.league || 'Registro de aposta'}</p>

        {/* Evento */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-400">Mandante
            <input value={home} onChange={(e) => setHome(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="text-xs text-gray-400">Visitante
            <input value={away} onChange={(e) => setAway(e.target.value)} className={`${field} mt-1`} />
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

        {/* Pernas */}
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
                    {manual && legs.length > 1 && (
                      <button onClick={() => removeLeg(i)} className="p-1 rounded text-rose-300 hover:bg-rose-500/15"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>

                {manual ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={leg.selection || ''} onChange={(e) => setLeg(i, { selection: e.target.value })} placeholder="Seleção (ex.: Casa)" className={field} />
                    <input value={leg.market || ''} onChange={(e) => setLeg(i, { market: e.target.value })} placeholder="Mercado (ex.: 1x2)" className={field} />
                  </div>
                ) : leg.selection && (
                  <div className="mt-1.5 text-[11px] text-gray-400 truncate">
                    {leg.selection}{leg.handicap ? ` (${leg.handicap})` : ''}{leg.market ? ` · ${leg.market}` : ''}
                  </div>
                )}

                <div className="mt-2 flex items-end gap-2">
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">Odd
                    <input value={String(leg.odd)} onChange={(e) => setLeg(i, { odd: parseFloat(e.target.value.replace(',', '.')) || 0 })} inputMode="decimal" className={`${field} mt-0.5 text-center`} />
                  </label>
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">{leg.isFreebet ? 'Valor FB (R$)' : 'Stake (R$)'}
                    <input value={String(leg.stake)} onChange={(e) => setLeg(i, { stake: parseFloat(e.target.value.replace(',', '.')) || 0 })} inputMode="decimal" className={`${field} mt-0.5 text-center font-bold text-teal-200`} />
                  </label>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 flex-1">Retorno
                    <div className="mt-0.5 px-2 py-2 rounded-lg bg-black/30 text-sm text-white text-center tabular-nums">{BRL(legReturn(leg))}</div>
                  </div>
                </div>

                {leg.isFreebet && <div className="mt-1.5 text-[10px] text-amber-300/80">Freebet: ganhando, fica só com o lucro; perdendo, não há prejuízo.</div>}

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
          {manual && (
            <button onClick={addLeg} className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/15 text-sm text-teal-300 hover:bg-white/5">
              <Plus size={15} /> Adicionar perna
            </button>
          )}
        </div>

        {/* Resumo */}
        <div className={`mt-4 rounded-xl p-3 ring-1 ${totals.profit >= 0 ? 'bg-emerald-500/10 ring-emerald-500/30' : 'bg-rose-500/10 ring-rose-500/30'}`}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Total</div><div className="text-base font-bold tabular-nums text-white">{BRL(totals.total)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Retorno gar.</div><div className="text-base font-bold tabular-nums text-white">{BRL(totals.guaranteed)}</div></div>
            <div><div className="text-[10px] uppercase tracking-wider text-gray-400">Lucro</div><div className={`text-base font-bold tabular-nums ${totals.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{totals.profit >= 0 ? '+' : ''}{BRL(totals.profit)}</div></div>
          </div>
        </div>

        <label className="block mt-3 text-xs text-gray-400">
          <HelpLabel help="Anotações sobre a aposta (motivo, contexto). Só você vê.">Observações</HelpLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} mt-1 resize-none`} placeholder="Notas sobre esta aposta (opcional)" />
        </label>

        {error && <div className="mt-3 rounded-lg bg-rose-500/10 ring-1 ring-rose-500/30 px-3 py-2 text-xs text-rose-300">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Lançar aposta
          </button>
        </div>
      </div>
    </div>
  );
}
