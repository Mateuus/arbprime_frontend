'use client';
import { useEffect, useState } from 'react';
import { Download, CheckCircle2, CircleDashed, RefreshCw, Puzzle, ShieldCheck } from 'lucide-react';
import { detectExtension, extensionVersion } from '@/utils/arbExtension';

// Onde o .zip da extensão fica hospedado (público do Next: arbprime_frontend/public/).
const EXT_ZIP_URL = '/downloads/arbprime-extension.zip';

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="grid place-items-center h-6 w-6 shrink-0 rounded-full bg-teal-500/15 text-teal-300 text-xs font-bold ring-1 ring-teal-400/30">
      {n}
    </span>
    <div className="pt-0.5 text-sm text-gray-300 leading-relaxed">{children}</div>
  </li>
);

export default function ExtensaoPage() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  const check = () => {
    setInstalled(null);
    detectExtension(800, true).then((ok) => {
      setInstalled(ok);
      setVersion(extensionVersion());
    });
  };

  useEffect(() => { check(); }, []);

  return (
    <div className="w-full px-3 sm:px-6 py-6 text-white">
      <div className="flex items-center gap-2 mb-1">
        <Puzzle size={20} className="text-teal-300" />
        <h1 className="text-2xl font-bold">Extensão — Abrir Jogo na Casa</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6 max-w-3xl">
        A extensão abre o jogo certo na casa direto da surebet, sem você procurar na mão.
        É instalada por você (sem loja): baixe, descompacte e carregue sem compactação.
      </p>

      {/* Status */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {installed === null ? (
            <>
              <CircleDashed size={18} className="text-gray-400 animate-spin" />
              <span className="text-sm text-gray-300">Verificando…</span>
            </>
          ) : installed ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span className="text-sm text-emerald-300 font-semibold">
                Extensão instalada{version ? ` (v${version})` : ''} ✓
              </span>
            </>
          ) : (
            <>
              <CircleDashed size={18} className="text-amber-400" />
              <span className="text-sm text-amber-300 font-semibold">Extensão não detectada</span>
            </>
          )}
        </div>
        <button
          onClick={check}
          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-teal-300 hover:bg-white/5 transition"
        >
          <RefreshCw size={13} /> Verificar de novo
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Passo a passo */}
        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
          <a
            href={EXT_ZIP_URL}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold px-4 py-2.5 transition mb-5"
            download
          >
            <Download size={18} /> Baixar extensão (.zip)
          </a>

          <ol className="space-y-3.5">
            <Step n={1}>Baixe o <b>.zip</b> e <b>descompacte</b> numa pasta fixa (não apague depois).</Step>
            <Step n={2}>
              Abra <code className="px-1 rounded bg-white/10 text-teal-200">chrome://extensions</code>
              {' '}(no Brave, <code className="px-1 rounded bg-white/10 text-teal-200">brave://extensions</code>).
            </Step>
            <Step n={3}>Ligue o <b>Modo do desenvolvedor</b> (canto superior direito).</Step>
            <Step n={4}>Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada.</Step>
            <Step n={5}>Volte aqui e clique em <b>Verificar de novo</b> — o status deve ficar verde.</Step>
          </ol>
        </div>

        {/* Notas */}
        <div className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={16} className="text-teal-300" />
              <h2 className="font-semibold">Atualizar</h2>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Quando sair versão nova, baixe o .zip, substitua os arquivos na mesma pasta e clique no
              botão de recarregar (↻) do card da extensão em <code className="px-1 rounded bg-white/10 text-teal-200">chrome://extensions</code>.
            </p>
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-amber-300" />
              <h2 className="font-semibold text-amber-200">Bom saber</h2>
            </div>
            <ul className="text-sm text-gray-300 leading-relaxed list-disc pl-5 space-y-1.5">
              <li>A extensão <b>continua funcionando</b> depois de reiniciar o navegador.</li>
              <li>
                Pode aparecer um aviso <i>“Desativar extensões em modo de desenvolvedor”</i> ao abrir o
                navegador — é só um lembrete, pode fechar que <b>não desativa</b> nada.
              </li>
              <li>Ela só age em <b>majovip.net</b> e no <b>ArbPrime</b>. Sem ela, o jogo ainda abre pelo link normal.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
