'use client';
import { ReactNode } from 'react';
import {
  Gem, Scale, Percent, Gauge, ShieldCheck, Wallet, LineChart, Brain, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { InfoModal } from '@/components/ui/InfoModal';

/**
 * Registro de TÓPICOS de informação. O modal (InfoModal) é genérico e
 * reutilizável; cada explicação é só DADO aqui — para um novo tópico (clv,
 * juice, surebet, …) basta adicionar uma entrada em INFO_TOPICS, sem criar
 * componente novo. Renderize com <InfoTopicModal topicKey="..." />.
 */
export interface InfoTopic {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  body: ReactNode;
  footerNote?: string;
}

// --- Helpers de layout reutilizáveis pelos corpos dos tópicos ---
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="py-3 first:pt-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/25">{icon}</span>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="pl-9 text-[13px] leading-relaxed text-gray-300 space-y-2">{children}</div>
    </section>
  );
}

function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" />
      <span><strong className="text-white">{name}</strong> — {children}</span>
    </li>
  );
}

const violetIcon = (node: ReactNode) => (
  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-violet-500/5 text-violet-300 ring-1 ring-violet-500/30">{node}</span>
);

// ===================== TÓPICOS =====================
export const INFO_TOPICS: Record<string, InfoTopic> = {
  // O que é um value bet (doc 10 + 11 + boas práticas OddsMonkey / surebet.com).
  valuebet: {
    title: 'O que é um Value Bet?',
    subtitle: 'Aposta de valor: você aposta quando a odd da casa está acima do que é justo.',
    icon: violetIcon(<Gem size={20} />),
    footerNote: 'O lucro é estatístico (longo prazo), não garantido em cada aposta.',
    body: (
      <div className="divide-y divide-white/5">
        <Section icon={<Gem size={15} />} title="O que é (e o que não é)">
          <p>
            Um <strong className="text-white">value bet</strong> (aposta de valor) é uma aposta <strong className="text-white">única</strong>, em <strong className="text-white">uma</strong> casa, em que a odd oferecida está <strong className="text-white">acima da odd justa</strong> — ou seja, a casa pagou mais do que deveria por aquela seleção.
          </p>
          <p className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
            <strong className="text-white">Diferente da surebet:</strong> na surebet você cobre todos os resultados e o lucro é garantido. No value bet você aposta em <strong className="text-white">um</strong> lado só — o lucro é <strong className="text-white">esperado</strong> (estatística), não garantido. Apostas individuais podem perder; o ganho vem do <strong className="text-white">acúmulo</strong> de muitas apostas de valor.
          </p>
        </Section>

        <Section icon={<Scale size={15} />} title="De onde vem a “odd justa”">
          <p>
            Usamos uma referência <strong className="text-white">confiável e sharp</strong> para estimar a probabilidade real: a <strong className="text-white">Pinnacle</strong> (a casa com a menor margem do mercado, ~2–3%) ou, quando ela não cobre o mercado, um <strong className="text-white">consenso</strong> de várias casas.
          </p>
          <p>
            Removemos a margem dessa referência (processo de <em>de-vig</em>) para obter a <strong className="text-white">probabilidade justa</strong> e, dela, a <strong className="text-white">odd justa</strong> (1 ÷ probabilidade). Se uma casa soft (betano, bet365, superbet) te paga <strong className="text-white">mais</strong> que essa odd justa, existe valor.
          </p>
        </Section>

        <Section icon={<Percent size={15} />} title="O “valor” (edge %)">
          <p>
            O <strong className="text-white">valor</strong> (badge <span className="rounded bg-emerald-500/15 px-1 text-emerald-300">+8,8%</span> no card) é o quanto a odd está acima do justo — o seu lucro <em>esperado</em> por aposta:
          </p>
          <p className="rounded-lg bg-black/30 p-2.5 text-center font-mono text-[12px] text-violet-200 ring-1 ring-violet-500/20">
            edge = (odd da casa × probabilidade justa) − 1
          </p>
          <p>
            <strong className="text-white">Exemplo:</strong> odd <strong className="text-white">2.10</strong>, odd justa <strong className="text-white">1.93</strong> → valor <strong className="text-emerald-300">+8,8%</strong>. Significa que, a cada R$100 apostados <em>nesse tipo</em> de aposta, espera-se ~<strong className="text-emerald-300">+R$8,80</strong> no longo prazo. Acima de <strong className="text-white">15%</strong> nós descartamos (quase sempre é erro/odd velha).
          </p>
        </Section>

        <Section icon={<Gauge size={15} />} title="Como ler o card">
          <ul className="space-y-1.5">
            <Field name="Odd">a odd oferecida pela casa — a que você vai apostar.</Field>
            <Field name="Justo">a odd justa estimada. Quanto maior a diferença para a odd, maior o valor.</Field>
            <Field name="Valor +X%">o edge (acima). É o destaque do card.</Field>
            <Field name="Confiança">o quão segura é a estimativa (barra 0–100%).</Field>
            <Field name="Selo (Tier / referência)">a origem da “verdade” — ver abaixo.</Field>
            <Field name="Margem da casa ~">estimativa do juice da casa naquele mercado (aproximada) — ver abaixo.</Field>
          </ul>
        </Section>

        <Section icon={<ShieldCheck size={15} />} title="Confiança & Tier (qualidade)">
          <p>O selo mostra de onde vem a estimativa — quanto mais alto o tier e a confiança, mais sólida ela é:</p>
          <ul className="space-y-1.5">
            <Field name="Tier 1 · Pinnacle">núcleo do mercado (1X2, total de gols). Confiança tipicamente alta.</Field>
            <Field name="Tier 2 · Pinnacle (sec.)">mercados secundários (escanteios, cartões, gols por time).</Field>
            <Field name="Tier 3 · Consenso">sem Pinnacle no mercado — estimativa pelo consenso das casas. Mais conservador.</Field>
          </ul>
        </Section>

        <Section icon={<Percent size={15} />} title="Margem da casa (juice)">
          <p>
            O <strong className="text-white">juice</strong> é a margem que a casa embute naquele mercado. Você ainda tem valor porque a casa <strong className="text-white">errou esta seleção específica</strong>, apesar da margem geral. <strong className="text-white">Menor juice = mercado mais honesto</strong>. Mostramos a margem da casa ao lado da referência (Pinnacle) para você comparar.
          </p>
          <p className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
            <strong className="text-white">É uma estimativa.</strong> Calculamos o juice a partir das odds das <strong className="text-white">duas pontas</strong> daquele mercado no instante da captura — por isso o valor é <strong className="text-white">aproximado</strong> (mostramos com <span className="font-mono">~</span>) e <strong className="text-white">não</strong> é necessariamente a margem exata que a casa cobra internamente. Use-o para <em>comparar</em> mercados e casas, não como número oficial.
          </p>
        </Section>

        <Section icon={<Wallet size={15} />} title="Quanto apostar (stake)">
          <p>
            A sugestão de stake usa <strong className="text-white">Kelly fracionário (¼)</strong> sobre a sua banca — quanto maior o valor e a confiança, maior a fração sugerida. É só <strong className="text-white">sugestão</strong>: você decide.
          </p>
          <p>
            Ao “Lançar aposta”, ela entra numa <strong className="text-white">banca dedicada de Value Bet</strong>, separada das surebets — porque value bet tem variância e track record próprios, e misturar contamina suas métricas.
          </p>
        </Section>

        <Section icon={<LineChart size={15} />} title="CLV — a prova de que funciona">
          <p>
            O lucro cru demora a aparecer (variância alta). O <strong className="text-white">CLV (Closing Line Value)</strong> mostra o edge real <strong className="text-white">muito antes</strong>: ele compara a odd que você pegou com a odd justa no <strong className="text-white">fechamento</strong> do jogo (o instante mais preciso do mercado).
          </p>
          <p>
            CLV <strong className="text-emerald-300">positivo</strong> de forma sustentada (já em ~50–200 apostas) = você consistentemente pega odds melhores que o fechamento = <strong className="text-white">edge real</strong>. Acompanhe em <strong className="text-white">Desempenho (CLV)</strong>.
          </p>
        </Section>

        <Section icon={<Brain size={15} />} title="Mentalidade certa">
          <ul className="space-y-1.5">
            <Field name="É longo prazo">julgue pelo acúmulo de centenas de apostas, não por uma noite.</Field>
            <Field name="Muitas apostas pequenas">melhor que poucas grandes — deixa a estatística trabalhar.</Field>
            <Field name="Disciplina de banca">siga o stake sugerido e não aumente após perdas (não “tilte”).</Field>
            <Field name="CLV antes de lucro">use o CLV para saber se está no caminho certo.</Field>
          </ul>
        </Section>

        <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <div className="mb-1 flex items-center gap-2 text-amber-300">
            <AlertTriangle size={15} /> <span className="text-sm font-semibold">Importante</span>
          </div>
          <ul className="space-y-1 text-[12px] leading-relaxed text-amber-100/80">
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Só geramos value bets em <strong>betano, bet365 e superbet</strong> (a Pinnacle é referência, nunca alvo).</li>
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Não há garantia de resultado em nenhum período — é estatística de longo prazo.</li>
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Casas podem limitar contas vencedoras. Aposte com responsabilidade.</li>
          </ul>
        </div>
      </div>
    ),
  },
};

export type InfoTopicKey = keyof typeof INFO_TOPICS;

/**
 * Modal de informação por TÓPICO: um único componente que renderiza qualquer
 * entrada de INFO_TOPICS no InfoModal genérico. Use em qualquer botão "?":
 *   {open && <InfoTopicModal topicKey="valuebet" onClose={() => setOpen(false)} />}
 */
export function InfoTopicModal({ topicKey, onClose }: { topicKey: InfoTopicKey; onClose: () => void }) {
  const topic = INFO_TOPICS[topicKey];
  if (!topic) return null;
  return (
    <InfoModal
      title={topic.title}
      subtitle={topic.subtitle}
      icon={topic.icon}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          {topic.footerNote && <p className="text-[11px] text-gray-500">{topic.footerNote}</p>}
          <button onClick={onClose} className="ml-auto shrink-0 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400">Entendi</button>
        </div>
      }
    >
      {topic.body}
    </InfoModal>
  );
}

export default InfoTopicModal;
