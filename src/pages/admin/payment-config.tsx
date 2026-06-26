import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGateway, ProviderConfigDTO, UpdateProviderConfigDTO } from '@/gateways/api.gateway';
import {
  RefreshCcw, Loader2, X, Save, Webhook, ServerCog, FlaskConical, Rocket, KeyRound, Upload, FileCheck2
} from 'lucide-react';

const errorMessage = (e: unknown, fallback: string): string => {
  const resp = (e as { response?: { data?: { message?: string } } })?.response;
  return resp?.data?.message || fallback;
};

const inputClass =
  'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition';

const SecretField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <label className="block text-xs text-gray-400">
    {label}
    <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1 font-mono`} placeholder={placeholder} />
  </label>
);

// Lê um arquivo e devolve seu conteúdo em base64 (sem o prefixo data URI).
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.replace(/^data:[^;]*;base64,/, ''));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Campo do certificado .p12: caminho editável + botão de upload do arquivo.
// O upload salva o .p12 em /certs no backend e devolve o caminho, que preenche o input.
const CertField = ({
  environment, value, onChange, placeholder, onMsg,
}: {
  environment: 'sandbox' | 'production';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onMsg: (m: { type: 'ok' | 'err'; text: string }) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!/\.p12$/i.test(file.name)) {
      onMsg({ type: 'err', text: 'Selecione um arquivo .p12.' });
      return;
    }
    setUploading(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await apiGateway.uploadProviderCert({ environment, filename: file.name, dataBase64 });
      if (res.data?.result === 1) {
        const certPath: string = res.data.data?.certPath || `./certs/${file.name}`;
        onChange(certPath);
        onMsg({ type: 'ok', text: res.data.message || 'Certificado enviado.' });
      } else {
        onMsg({ type: 'err', text: res.data?.message || 'Falha ao enviar certificado.' });
      }
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string } } })?.response;
      onMsg({ type: 'err', text: resp?.data?.message || 'Falha ao enviar certificado.' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="text-xs text-gray-400">
      <span className="block">Certificado (.p12)</span>
      <div className="mt-1 flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} font-mono flex-1`} placeholder={placeholder} />
        <input ref={inputRef} type="file" accept=".p12,application/x-pkcs12" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-xs font-medium transition"
          title="Enviar arquivo .p12"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Enviar
        </button>
      </div>
      {value && (
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300/80">
          <FileCheck2 size={12} /> {value}
        </span>
      )}
    </div>
  );
};

const AdminPaymentConfigPage = () => {
  const [cfg, setCfg] = useState<ProviderConfigDTO | null>(null);
  const [form, setForm] = useState<UpdateProviderConfigDTO>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGateway.getProviderConfig();
      if (res.data?.result === 1) {
        const c: ProviderConfigDTO = res.data.data;
        setCfg(c);
        setForm({
          isActive: c.isActive,
          environment: c.environment,
          sandboxClientId: c.sandboxClientId,
          sandboxClientSecret: c.sandboxClientSecret,
          sandboxCertPath: c.sandboxCertPath || '',
          sandboxPixKey: c.sandboxPixKey || '',
          prodClientId: c.prodClientId,
          prodClientSecret: c.prodClientSecret,
          prodCertPath: c.prodCertPath || '',
          prodPixKey: c.prodPixKey || '',
          webhookSecret: c.webhookSecret,
          webhookBaseUrl: c.webhookBaseUrl || '',
        });
      } else setMsg({ type: 'err', text: res.data?.message || 'Erro ao carregar config.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao carregar config.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
  }, [loadConfig]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiGateway.updateProviderConfig(form);
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Config salva.' });
      if (res.data?.result === 1) await loadConfig();
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Erro ao salvar config.') });
    } finally {
      setSaving(false);
    }
  };

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const res = await apiGateway.registerPaymentWebhook();
      setMsg({ type: res.data?.result === 1 ? 'ok' : 'err', text: res.data?.message || 'Webhook registrado.' });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: errorMessage(e, 'Falha ao registrar webhook.') });
    } finally {
      setRegistering(false);
    }
  };

  const isProd = form.environment === 'production';

  return (
    <div className="w-full px-3 sm:px-6 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-teal-500/30 to-teal-500/5 ring-1 ring-teal-500/30">
            <ServerCog className="text-teal-300" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pagamentos — Provedor</h1>
            <p className="text-sm text-gray-400">Configuração do provedor de pagamento (Efí Bank / PIX)</p>
          </div>
        </div>
        <button onClick={() => loadConfig()} className="grid place-items-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition" title="Atualizar">
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {msg && (
        <div className={`mb-4 flex items-start justify-between gap-3 text-sm px-4 py-2.5 rounded-xl ring-1 ${msg.type === 'ok' ? 'bg-emerald-500/10 ring-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 ring-rose-500/30 text-rose-200'}`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      )}

      <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ServerCog size={18} className="text-teal-300" />
          <h2 className="font-semibold text-white">Provedor: Efí Bank</h2>
          {cfg && <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ${cfg.isActive ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-300 ring-rose-500/30'}`}>{cfg.isActive ? 'ativo' : 'inativo'}</span>}
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="block text-xs text-gray-400 mb-1.5">Ambiente em uso</span>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <button
                  onClick={() => setForm({ ...form, environment: 'sandbox' })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm ring-1 transition ${!isProd ? 'bg-amber-500/15 ring-amber-500/40 text-amber-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}
                >
                  <FlaskConical size={15} /> Sandbox
                </button>
                <button
                  onClick={() => setForm({ ...form, environment: 'production' })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm ring-1 transition ${isProd ? 'bg-emerald-500/15 ring-emerald-500/40 text-emerald-200' : 'bg-white/5 ring-white/10 text-gray-300 hover:bg-white/10'}`}
                >
                  <Rocket size={15} /> Produção
                </button>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-teal-500" />
              Provedor ativo (cobranças habilitadas)
            </label>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                <KeyRound size={13} /> Credenciais {isProd ? 'de produção' : 'de sandbox'}
              </div>
              {isProd ? (
                <>
                  <SecretField label="Client ID" value={form.prodClientId || ''} onChange={(v) => setForm({ ...form, prodClientId: v })} />
                  <SecretField label="Client Secret" value={form.prodClientSecret || ''} onChange={(v) => setForm({ ...form, prodClientSecret: v })} />
                  <CertField environment="production" value={form.prodCertPath || ''} onChange={(v) => setForm({ ...form, prodCertPath: v })} onMsg={setMsg} placeholder="./certs/producao-xxx.p12" />
                  <label className="block text-xs text-gray-400">Chave PIX recebedora
                    <input value={form.prodPixKey || ''} onChange={(e) => setForm({ ...form, prodPixKey: e.target.value })} className={`${inputClass} mt-1`} placeholder="chave PIX" />
                  </label>
                </>
              ) : (
                <>
                  <SecretField label="Client ID" value={form.sandboxClientId || ''} onChange={(v) => setForm({ ...form, sandboxClientId: v })} />
                  <SecretField label="Client Secret" value={form.sandboxClientSecret || ''} onChange={(v) => setForm({ ...form, sandboxClientSecret: v })} />
                  <CertField environment="sandbox" value={form.sandboxCertPath || ''} onChange={(v) => setForm({ ...form, sandboxCertPath: v })} onMsg={setMsg} placeholder="./certs/homologacao-xxx.p12" />
                  <label className="block text-xs text-gray-400">Chave PIX recebedora
                    <input value={form.sandboxPixKey || ''} onChange={(e) => setForm({ ...form, sandboxPixKey: e.target.value })} className={`${inputClass} mt-1`} placeholder="chave PIX" />
                  </label>
                </>
              )}
              <p className="text-[11px] text-gray-500">Os segredos são exibidos mascarados. Deixe como está para manter; digite um novo valor para substituir.</p>
            </div>

            <label className="block text-xs text-gray-400">URL pública da API (webhook)
              <input value={form.webhookBaseUrl || ''} onChange={(e) => setForm({ ...form, webhookBaseUrl: e.target.value })} className={`${inputClass} mt-1 font-mono`} placeholder="https://api.arbprime.pro" />
            </label>
            <p className="text-[11px] text-gray-500">A Efí entrega o webhook em <span className="font-mono">{(form.webhookBaseUrl || '').replace(/\/+$/, '') || 'https://api...'}/payment/webhook/efibank/pix</span></p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={save} disabled={saving} className="text-sm px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar config
              </button>
              <button onClick={registerWebhook} disabled={registering} className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5">
                {registering ? <Loader2 size={15} className="animate-spin" /> : <Webhook size={15} />} Registrar webhook
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentConfigPage;
