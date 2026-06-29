'use client';
import { useState, ReactNode } from 'react';
import {
  Target, Ticket, Gauge, TrendingUp, TriangleAlert, ArrowRight, ChevronLeft, ChevronRight,
  Percent, Trophy, CircleCheck, Lock, Sparkles, Coins, ShieldCheck,
} from 'lucide-react';

/**
 * Guia DIDÁTICO de Middles para LEIGOS — corpo do InfoTopic "middle" (renderiza
 * dentro do InfoModal). Em ABAS para não virar parede de texto, com analogias
 * visuais (raspadinha, escadinha de EV, reta do miolo) e um mini-exemplo
 * interativo (slider de gols). Copy de especialista, tom leve, PT-BR.
 */

const TABS = [
  { key: 'oque', label: 'O que é?', icon: <Target size={14} /> },
  { key: 'free', label: 'Free Middle', icon: <Ticket size={14} /> },
  { key: 'numeros', label: 'Os números', icon: <Gauge size={14} /> },
  { key: 'ev', label: 'EV: quanto maior?', icon: <TrendingUp size={14} /> },
  { key: 'avisos', label: 'Avisos', icon: <TriangleAlert size={14} /> },
];

// Reta do miolo (ilustração estática).
function MioloLine() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <div className="shrink-0 text-center">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400/80">Mais de</div>
          <div className="text-sm font-bold tabular-nums text-emerald-200">2.5</div>
        </div>
        <ChevronRight size={14} className="shrink-0 text-emerald-400/60" />
        <div className="relative flex h-9 flex-1 items-center">
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_6px,transparent_6px_12px)]" />
          <span className="relative mx-auto grid h-7 place-items-center rounded-full bg-emerald-500/20 px-3 text-xs font-bold text-emerald-100 ring-1 ring-emerald-400/50 shadow-[0_0_14px_rgba(16,185,129,0.55)]">
            🟢 3 gols
          </span>
        </div>
        <ChevronLeft size={14} className="shrink-0 text-rose-400/60" />
        <div className="shrink-0 text-center">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-rose-400/80">Menos de</div>
          <div className="text-sm font-bold tabular-nums text-rose-200">3.5</div>
        </div>
      </div>
      <div className="mt-1.5 text-center text-[11px] text-gray-400">
        a <strong className="text-emerald-300">faixa verde</strong> é o <strong className="text-white">miolo</strong>: aqui as DUAS pernas ganham
      </div>
    </div>
  );
}

// Mini-exemplo interativo: quantos gols saíram?
function GoalSlider() {
  const [goals, setGoals] = useState(3);
  const overWins = goals > 2.5; // Mais de 2.5
  const underWins = goals < 3.5; // Menos de 3.5
  const both = overWins && underWins; // miolo = exatamente 3
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white"><Sparkles size={13} className="text-indigo-300" /> Experimente: quantos gols saíram?</span>
        <span className="text-xl font-bold tabular-nums text-indigo-200">{goals}</span>
      </div>
      <input type="range" min={0} max={6} step={1} value={goals} onChange={(e) => setGoals(parseInt(e.target.value, 10))} className="w-full accent-indigo-500" />
      <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-gray-500">
        {[0, 1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={n === 3 ? 'font-bold text-emerald-300' : ''}>{n}</span>)}
      </div>
      <div className={`mt-2 rounded-lg p-2 text-center text-[12px] font-semibold ring-1 ${both ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30' : 'bg-white/5 text-gray-300 ring-white/10'}`}>
        {both
          ? '🎉 As DUAS ganharam! Caiu no miolo — esse é o prêmio.'
          : overWins
            ? 'Só o “Mais de 2.5” ganhou — e o “Menos” perdeu pouco.'
            : 'Só o “Menos de 3.5” ganhou — e o “Mais” perdeu pouco.'}
      </div>
    </div>
  );
}

// Raspadinha: aposta normal vs free middle.
function ScratchCards() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Aposta normal 📉</div>
        <div className="mt-1.5 text-sm text-gray-200">Joga <strong className="text-white">R$100</strong> → na média volta <strong className="text-rose-200">R$95</strong></div>
        <div className="mt-1 text-[11px] text-gray-400">Os R$5 ficam com a casa. Você <strong className="text-white">paga</strong> pra jogar.</div>
      </div>
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Free middle 🆓</div>
        <div className="mt-1.5 text-sm text-gray-200">Joga <strong className="text-white">R$100</strong> → na média volta <strong className="text-emerald-200">R$100</strong></div>
        <div className="mt-1 text-[11px] text-gray-400">Não paga nada pra jogar — e ainda pode cair no miolo e levar prêmio.</div>
      </div>
    </div>
  );
}

// Escadinha de EV (degraus ascendentes).
function Staircase() {
  const steps = [
    { label: 'Aposta normal', sub: 'Você paga ❌', h: 32, tone: 'bg-rose-500/40', txt: 'negativo' },
    { label: 'Free middle', sub: 'De graça 🆓', h: 56, tone: 'bg-amber-500/50', txt: '≈ zero' },
    { label: '+EV middle', sub: 'Te pagam ✅', h: 80, tone: 'bg-emerald-500/55', txt: 'positivo' },
    { label: 'Surebet', sub: 'Lucro sempre 🔒', h: 104, tone: 'bg-emerald-400/70', txt: 'garantido' },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-end gap-2">
        {steps.map((s) => (
          <div key={s.label} className="flex flex-1 flex-col items-center">
            <span className="mb-1 text-[10px] font-bold text-gray-300">{s.txt}</span>
            <div className={`w-full rounded-t-lg ${s.tone}`} style={{ height: s.h }} />
            <div className="mt-1 text-center text-[10px] font-semibold leading-tight text-white">{s.label}</div>
            <div className="text-center text-[9px] leading-tight text-gray-400">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[10px] text-gray-500">retorno esperado sobe da esquerda para a direita</div>
    </div>
  );
}

function MetricRow({ icon, name, children }: { icon: ReactNode; name: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/12 text-indigo-300 ring-1 ring-indigo-500/25">{icon}</span>
      <span className="text-[13px] leading-relaxed text-gray-300"><strong className="text-white">{name}</strong> — {children}</span>
    </li>
  );
}

function Callout({ tone = 'indigo', children }: { tone?: 'indigo' | 'emerald' | 'amber'; children: ReactNode }) {
  const cls = {
    indigo: 'border-indigo-500/25 bg-indigo-500/[0.06] text-indigo-100/90',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-100/90',
    amber: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100/90',
  }[tone];
  return <div className={`rounded-xl border p-3 text-[13px] leading-relaxed ${cls}`}>{children}</div>;
}

export function MiddleGuide() {
  const [tab, setTab] = useState('oque');

  return (
    <div className="text-[13px]">
      {/* Abas (no topo do corpo; sem sticky p/ não sobrepor o conteúdo) */}
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-white/10 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${tab === t.key ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
          >
            {t.icon} <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* O QUE É */}
      {tab === 'oque' && (
        <div className="space-y-3">
          <p className="leading-relaxed text-gray-300">
            Um <strong className="text-white">middle</strong> é apostar nos <strong className="text-white">dois lados</strong> de um total, em <strong className="text-white">linhas diferentes</strong>, deixando uma <strong className="text-white">folga</strong> no meio. Se o resultado cai nessa folga (o <strong className="text-emerald-300">miolo</strong>), as duas ganham. Fora dela, uma ganha e a outra perde pouco.
          </p>
          <Callout tone="emerald">
            <strong className="text-white">Ex.:</strong> <strong className="text-emerald-200">Mais de 2.5</strong> numa casa + <strong className="text-rose-200">Menos de 3.5</strong> em outra → se sair <strong className="text-white">exatamente 3 gols</strong>, as DUAS ganham 🎉
          </Callout>
          <MioloLine />
          <GoalSlider />
          <Callout tone="indigo">
            💡 Diferente da <strong className="text-white">surebet</strong> (lucro garantido sempre): no middle o lucro <strong className="text-white">não é garantido</strong> — é valor inteligente: perde pouco no pior caso e ganha bonito às vezes.
          </Callout>
        </div>
      )}

      {/* FREE MIDDLE */}
      {tab === 'free' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/5 text-emerald-300 ring-1 ring-emerald-500/30"><Ticket size={18} /></span>
            <p className="text-[15px] font-bold text-white">Free middle = uma raspadinha de graça 🎟️</p>
          </div>
          <p className="leading-relaxed text-gray-300">
            No <strong className="text-white">longo prazo não te custa nada</strong>, mas te dá chances de ganhar. Veja a diferença:
          </p>
          <ScratchCards />
          <p className="leading-relaxed text-gray-300">
            <strong className="text-white">Por quê?</strong> Você pega o “Mais” numa casa e o “Menos” em outra; quando elas discordam o suficiente, a <strong className="text-white">comissão das duas se cancela</strong>.
          </p>
          <Callout tone="emerald">
            <strong className="text-white">Com número:</strong> R$50 + R$50 · 🎯 saiu o miolo (~22%) → ganha <strong className="text-emerald-200">+R$7</strong> · 😐 não saiu (~78%) → perde <strong className="text-rose-200">−R$2</strong>.
            <div className="mt-1 rounded-lg bg-black/30 p-2 text-center font-mono text-[12px] text-emerald-200 ring-1 ring-emerald-500/20">0,22 × 7 − 0,78 × 2 ≈ 0 → deu zero. De graça.</div>
          </Callout>
          <Callout tone="amber">
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200"><TriangleAlert size={14} /> Atenção</span>
            <div className="mt-1">“Free” = de graça <strong className="text-white">na média</strong>, NÃO “impossível perder”. Numa aposta isolada você pode perder os R$2. O grátis só aparece somando <strong className="text-white">muitas</strong> apostas.</div>
          </Callout>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">A escadinha do retorno</div>
            <Staircase />
          </div>
        </div>
      )}

      {/* OS NÚMEROS */}
      {tab === 'numeros' && (
        <div className="space-y-2">
          <p className="mb-2 leading-relaxed text-gray-300">O que cada número do card quer dizer, em uma frase:</p>
          <ul className="space-y-2">
            <MetricRow icon={<TrendingUp size={14} />} name="EV"><strong className="text-emerald-300">Lucro médio no longo prazo</strong>, em % do que apostou (+2% = R$100 viram R$102 em média). É o número nº 1.</MetricRow>
            <MetricRow icon={<Target size={14} />} name="Acerto %">chance de <strong className="text-white">cair no miolo</strong> e ganhar dos dois lados. Maior = vitória mais frequente.</MetricRow>
            <MetricRow icon={<TrendingUp size={14} />} name="Lucro se acerta">o <strong className="text-emerald-300">prêmio</strong>, se cair no miolo.</MetricRow>
            <MetricRow icon={<Coins size={14} />} name="Perda se erra">quanto perde se <strong className="text-white">não</strong> cair (geralmente pequeno).</MetricRow>
            <MetricRow icon={<ShieldCheck size={14} />} name="Asiático / Meia-perda">versão “com seguro”: na fronteira você perde só <strong className="text-white">metade</strong>.</MetricRow>
            <MetricRow icon={<Trophy size={14} />} name="Nº de middles">quantas oportunidades aquele jogo tem.</MetricRow>
          </ul>
        </div>
      )}

      {/* EV: QUANTO MAIOR? */}
      {tab === 'ev' && (
        <div className="space-y-3">
          <p className="leading-relaxed text-gray-300">
            Sim, o <strong className="text-white">EV é o número nº 1</strong> — com <strong className="text-white">3 ressalvas</strong>:
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2.5 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-500/30">1</span>
              <span className="text-[13px] leading-relaxed text-gray-300">É média de <strong className="text-white">longo prazo</strong>, não garantia. Um +5% perde na maioria das apostas; o lucro vem do <strong className="text-white">volume</strong>.</span>
            </li>
            <li className="flex gap-2.5 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-500/30">2</span>
              <span className="text-[13px] leading-relaxed text-gray-300">EV não mostra <strong className="text-white">risco</strong> → olhe o <strong className="text-white">Acerto %</strong>. Banca pequena → acerto alto; banca grande → EV máximo.</span>
            </li>
            <li className="flex gap-2.5 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-white/5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-[12px] font-bold text-indigo-300 ring-1 ring-indigo-500/30">3</span>
              <span className="text-[13px] leading-relaxed text-gray-300">EV alto demais = 🚩 (odd velha / limite / boost). Se tá <strong className="text-white">bom demais</strong>, confira a odd na casa antes.</span>
            </li>
          </ul>
          <Callout tone="emerald">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200"><CircleCheck size={14} /> Frase de ouro</span>
            <div className="mt-1 text-gray-200">
              <strong className="text-white">EV</strong> decide <strong className="text-white">SE</strong> aposta · <strong className="text-white">Acerto%</strong> decide <strong className="text-white">QUANTO</strong> · <strong className="text-white">verificar a odd</strong> decide se é <strong className="text-white">REAL</strong>.
            </div>
          </Callout>
        </div>
      )}

      {/* AVISOS */}
      {tab === 'avisos' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
            <div className="mb-2 inline-flex items-center gap-2 font-semibold text-amber-300"><TriangleAlert size={15} /> Avisos importantes</div>
            <ul className="space-y-2 text-[12px] leading-relaxed text-amber-100/85">
              <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> <strong className="text-white">Não é lucro garantido</strong> — é estatística.</li>
              <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Os resultados <strong className="text-white">variam muito</strong>: pense em dezenas de apostas, não numa só.</li>
              <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> <strong className="text-white">Confirme a odd na casa</strong> antes de apostar (odds mudam rápido).</li>
              <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Aposte com <strong className="text-white">responsabilidade</strong>.</li>
            </ul>
          </div>
          <Callout tone="indigo">
            <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-100"><Lock size={14} /> Resumo</span>
            <div className="mt-1 text-gray-200">Middle = <strong className="text-white">perde pouco</strong> no pior caso, <strong className="text-emerald-300">ganha bonito</strong> quando cai no miolo. No longo prazo, com disciplina, o <strong className="text-white">+EV</strong> trabalha a seu favor.</div>
          </Callout>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <Percent size={12} /> os números do card já saem prontos do nosso motor — você só executa.
          </div>
        </div>
      )}
    </div>
  );
}

export default MiddleGuide;
