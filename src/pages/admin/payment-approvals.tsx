import { useState, useEffect, useCallback } from 'react';
import { apiGateway, ManualReviewItemDTO } from '@/gateways/api.gateway';
import {
  ClipboardCheck, RefreshCcw, Loader2, ChevronLeft, ChevronRight, Eye, Check, X, Download, FileText, AlertCircle
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const brlCents = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const STATUS: Record<string, { tone: string; label: string }> = {
  in_review: { tone: 'bg-amber-500/15 text-amber-300 ring-amber-500/30', label: 'em análise' },
  completed: { tone: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'aprovado' },
  rejected: { tone: 'bg-rose-500/15 text-rose-300 ring-rose-500/30', label: 'recusado' },
  pending: { tone: 'bg-white/5 text-gray-400 ring-white/10', label: 'aguardando' },
};

const FILTERS = [
  { key: 'in_review', label: 'Em análise' },
  { key: 'completed', label: 'Aprovadas' },
  { key: 'rejected', label: 'Recusadas' },
  { key: 'all', label: 'Todas' },
];

// ---- Modal: visualizar comprovante ----
const ProofModal = ({ txid, onClose }: { txid: string; onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<{ proofImage: string | null; proofMime: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiGateway.getManualProof(txid);
        if (!mounted) return;
        if (res.data?.result === 1) setProof(res.data.data);
        else setError(res.data?.message || 'Erro ao carregar comprovante.');
      } catch (e: unknown) {
        if (mounted) setError(errorMessage(e, 'Erro ao carregar comprovante.'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [txid]);

  const isPdf = (proof?.proofMime || '').includes('pdf');

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-dark border border-white/10 w-full max-w-2xl rounded-2xl p-5 relative shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><FileText size={18} className="text-teal-300" /> Comprovante</h2>

        {loading ? (
          <div className="py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : error || !proof?.proofImage ? (
          <div className="py-10 text-center text-gray-400">{error || 'Nenhum comprovante anexado.'}</div>
        ) : isPdf ? (
          <div className="space-y-3">
            <iframe src={proof.proofImage} title="Comprovante PDF" className="w-full h-[60vh] rounded-lg bg-white" />
            <a href={proof.proofImage} download={`comprovante-${txid}.pdf`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"><Download size={15} /> Baixar PDF</a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-black/30 rounded-lg p-2 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof.proofImage} alt="Comprovante" className="max-h-[65vh] object-contain rounded" />
            </div>
            <a href={proof.proofImage} download={`comprovante-${txid}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"><Download size={15} /> Baixar imagem</a>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Modal: recusar (com motivo) ----
const RejectModal = ({ txid, onClose, onDone }: { txid: string; onClose: () => void; onDone: (msg: string) => void }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!note.trim()) { setError('Informe o motivo da recusa.'); return; }
    setSaving(true);
    try {
      const res = await apiGateway.rejectManualPayment(txid, note.trim());
      if (res.data?.result === 1) onDone(res.data?.message || 'Pagamento recusado.');
      else setError(res.data?.message || 'Erro ao recusar.');
    } catch (e: unknown) {
      setError(errorMessage(e, 'Erro ao recusar.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-brand-dark border border-white/10 w-full max-w-md rounded-2xl p-5 relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-rose-400"><X size={20} /></button>
        <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><AlertCircle size={18} className="text-rose-300" /> Recusar pagamento</h2>
        <p className="text-xs text-gray-400 mb-4">O motivo é exibido ao usuário, que poderá reenviar o comprovante.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ex.: Comprovante ilegível / valor divergente / pagamento não localizado."
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 resize-y"
        />
        {error && <div className="mt-2 text-xs text-rose-200">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white">Cancelar</button>
          <button onClick={submit} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Recusar
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminPaymentApprovalsPage = () => {
  const [items, setItems] = useState<ManualReviewItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('in_review');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [proofTxid, setProofTxid] = useState<string | null>(null);
  const [rejectTxid, setRejectTxid] = useState<string | null>(null);
  const [actingTxid, setActingTxid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getManualReviewQueue({ status, page, limit: 20 });
      if (res.data?.result === 1) {
        setItems(res.data.data.transactions || []);
        setTotalPages(res.data.data.pagination?.totalPages || 1);
        setTotal(res.data.data.pagination?.total || 0);
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar fila.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar fila.') });
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const approve = async (txid: string) => {
    setActingTxid(txid);
    try {
      const res = await apiGateway.approveManualPayment(txid);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Pagamento aprovado.' });
      if (res.data?.result === 1) await load();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao aprovar.') });
    } finally {
      setActingTxid(null);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-500/5 ring-1 ring-amber-500/30">
            <ClipboardCheck className="text-amber-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Aprovações</h1>
            <p className="text-sm text-gray-400">Comprovantes de pagamento manual aguardando confirmação — {total} no total</p>
          </div>
        </div>
        <button onClick={() => load()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatus(f.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition ${status === f.key ? 'bg-amber-500/20 ring-amber-500/50 text-amber-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="px-4 py-16 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">Nenhum pagamento {status === 'in_review' ? 'aguardando análise' : 'encontrado'}.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {items.map((it) => {
              const st = STATUS[it.status] || STATUS.pending;
              const acting = actingTxid === it.txid;
              return (
                <div key={it.id} className="flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{it.user?.fullname || it.user?.email || '—'}</div>
                    <div className="text-[11px] text-gray-500 truncate">{it.user?.email || ''}</div>
                  </div>
                  <span className="lg:w-32 text-xs text-gray-300 truncate">{it.plan?.name || '—'}</span>
                  <span className="lg:w-40 text-xs text-gray-400">{dateTime(it.proofUploadedAt || it.createdAt)}</span>
                  <span className="lg:w-24 lg:text-right text-sm font-semibold text-white">{brlCents(it.amountCents)}</span>
                  <span className="lg:w-24 lg:text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.tone}`}>{st.label}</span>
                  </span>
                  <div className="flex items-center gap-1.5 lg:w-auto">
                    <button
                      onClick={() => setProofTxid(it.txid)}
                      disabled={!it.hasProof}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white"
                      title={it.hasProof ? 'Ver comprovante' : 'Sem comprovante'}
                    >
                      <Eye size={14} /> Comprovante
                    </button>
                    {it.status === 'in_review' && (
                      <>
                        <button onClick={() => approve(it.txid)} disabled={acting} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 font-semibold" title="Aprovar e liberar plano">
                          {acting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprovar
                        </button>
                        <button onClick={() => setRejectTxid(it.txid)} disabled={acting} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200" title="Recusar">
                          <X size={14} /> Recusar
                        </button>
                      </>
                    )}
                  </div>
                  {it.status === 'rejected' && it.reviewNote && (
                    <div className="w-full text-[11px] text-rose-300/80 pl-0.5">Motivo: {it.reviewNote}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-400">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}

      {proofTxid && <ProofModal txid={proofTxid} onClose={() => setProofTxid(null)} />}
      {rejectTxid && (
        <RejectModal
          txid={rejectTxid}
          onClose={() => setRejectTxid(null)}
          onDone={(m) => { setRejectTxid(null); setMsg({ type: 'ok', text: m }); load(); }}
        />
      )}
    </div>
  );
};

export default AdminPaymentApprovalsPage;
