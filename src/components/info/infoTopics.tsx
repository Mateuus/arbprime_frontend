'use client';
import { ReactNode } from 'react';
import {
  Gem, Scale, Percent, Gauge, ShieldCheck, Wallet, LineChart, Brain, AlertTriangle, ArrowRight,
  TrendingUp, Hourglass, Building2, Eye, BarChart3, Target,
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
          <p>O selo de <strong className="text-white">tier</strong> indica o quão sólida é a estimativa — quanto menor o número (e maior a confiança), mais forte o sinal:</p>
          <ul className="space-y-1.5">
            <Field name="Tier 1">núcleo do mercado (1X2, total de gols). Confiança tipicamente alta.</Field>
            <Field name="Tier 2">mercados secundários (escanteios, cartões, gols por time). Confiança média.</Field>
            <Field name="Tier 3">estimativa mais conservadora. Confiança menor — pondere o risco.</Field>
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

  // CLV (Closing Line Value) — a prova de edge (doc 10 §1, §4, §6.5, §8).
  clv: {
    title: 'O que é o CLV (Closing Line Value)?',
    subtitle: 'A prova de que suas apostas têm edge real — antes do lucro aparecer.',
    icon: violetIcon(<LineChart size={20} />),
    footerNote: 'CLV positivo sustentado = edge real. Ele aparece muito antes do lucro cru.',
    body: (
      <div className="divide-y divide-white/5">
        <Section icon={<LineChart size={15} />} title="O problema: o lucro engana no curto prazo">
          <p>
            Apostas de valor têm <strong className="text-white">variância alta</strong>: você pode acertar o edge e ainda assim perder várias seguidas por azar. Olhar só o lucro nas primeiras dezenas/centenas de apostas <strong className="text-white">não diz</strong> se a sua estratégia presta — pode ser sorte ou azar.
          </p>
          <p>
            O <strong className="text-white">CLV</strong> resolve isso: é uma métrica que mede o edge <strong className="text-white">independente do resultado</strong> da aposta, e por isso converge <strong className="text-white">muito mais rápido</strong> que o lucro.
          </p>
        </Section>

        <Section icon={<Scale size={15} />} title="O que o CLV mede">
          <p>
            CLV compara a <strong className="text-white">odd que você pegou</strong> com a <strong className="text-white">odd justa no fechamento</strong> do jogo — o último instante antes da bola rolar, quando o mercado já absorveu todas as informações (escalações, lesões, dinheiro dos apostadores sharp). É o momento mais <strong className="text-white">preciso</strong> do mercado.
          </p>
          <p className="rounded-lg bg-black/30 p-2.5 text-center font-mono text-[12px] text-violet-200 ring-1 ring-violet-500/20">
            CLV % = (odd que você pegou ÷ odd justa de fechamento) − 1
          </p>
          <p>
            <strong className="text-white">Exemplo:</strong> você pegou <strong className="text-white">2.10</strong>; no fechamento a odd justa estava <strong className="text-white">1.95</strong> → CLV <strong className="text-emerald-300">+7,7%</strong>. Você travou um preço melhor do que o mercado fechou — pegou valor de verdade.
          </p>
        </Section>

        <Section icon={<TrendingUp size={15} />} title="Por que isso importa">
          <p>
            Pegar <strong className="text-white">consistentemente</strong> odds melhores que o fechamento é o que os apostadores profissionais usam como <strong className="text-white">termômetro nº 1</strong>. Se o seu CLV médio é positivo de forma sustentada — já em <strong className="text-white">~50–200 apostas</strong> —, é prova estatística de que você tem <strong className="text-emerald-300">edge real</strong>, mesmo que o lucro ainda não tenha aparecido.
          </p>
          <p className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
            <strong className="text-white">Em uma frase:</strong> o lucro diz se você <em>ganhou</em>; o CLV diz se você <em>jogou certo</em>. No longo prazo, jogar certo vira lucro.
          </p>
        </Section>

        <Section icon={<Hourglass size={15} />} title="Por que o CLV fica “pendente”">
          <p>
            O fechamento só existe <strong className="text-white">quando o jogo começa</strong>. Por isso o CLV de uma aposta só é calculado <strong className="text-white">depois do apito inicial</strong> (liquidação ~10 min após o início). Antes disso, a aposta aparece como <strong className="text-white">“pendente”</strong> — é esperado, não é erro.
          </p>
          <p>
            Em alguns casos o jogo liquida mas <strong className="text-white">não há fechamento resolvível</strong> (faltou a âncora de referência naquele mercado). Essas apostas ficam de fora das médias de CLV — não dá pra medir o que não tem régua.
          </p>
        </Section>

        <Section icon={<BarChart3 size={15} />} title="Como ler o painel de Desempenho">
          <ul className="space-y-1.5">
            <Field name="CLV médio">a média do seu CLV na janela. Positivo e estável = bom sinal.</Field>
            <Field name="% CLV positivo">quantas apostas fecharam com CLV &gt; 0. Acima de 50% é um norte saudável.</Field>
            <Field name="Apostas liquidadas">quantas já têm CLV calculado (base da estatística).</Field>
            <Field name="Edge médio (tomado)">o valor que estimamos na hora da captura — compare com o CLV realizado.</Field>
            <Field name="CLV médio por dia">a série temporal: é o sinal de saúde do motor ao longo do tempo.</Field>
            <Field name="Quebra por casa / mercado / tier">onde você está pegando (ou perdendo) valor.</Field>
          </ul>
        </Section>

        <Section icon={<ShieldCheck size={15} />} title="Transparência (como prometemos não enganar)">
          <ul className="space-y-1.5">
            <Field name="Odd imutável">gravamos a odd no 1º instante em que o value foi visto — ela nunca é “melhorada” depois.</Field>
            <Field name="Sem cereja">o CLV é calculado para TODAS as emissões liquidadas, não só as que deram certo.</Field>
            <Field name="Tier 3 segregado">o CLV de Tier 3 usa uma referência mais conservadora (que pode incluir a própria casa), gerando viés — por isso mostramos por tier e não somamos T3 com T1/T2 no mesmo número.</Field>
          </ul>
        </Section>

        <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <div className="mb-1 flex items-center gap-2 text-amber-300">
            <AlertTriangle size={15} /> <span className="text-sm font-semibold">Importante</span>
          </div>
          <ul className="space-y-1 text-[12px] leading-relaxed text-amber-100/80">
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> O CLV não é garantia de lucro em nenhuma aposta individual — é um indicador estatístico de longo prazo.</li>
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> Precisa de volume: julgue com dezenas/centenas de apostas, não com 5 ou 10.</li>
            <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0" /> CLV positivo + disciplina de banca = o caminho. CLV negativo sustentado = revisar a estratégia.</li>
          </ul>
        </div>
      </div>
    ),
  },

  // Juice / margem da casa (doc 11).
  juice: {
    title: 'O que é o “juice” (margem da casa)?',
    subtitle: 'O lucro que a casa embute em cada mercado — e por que você ainda tem valor.',
    icon: violetIcon(<Percent size={20} />),
    footerNote: 'Mostramos a margem com “~” porque é uma estimativa — use para comparar, não como número oficial.',
    body: (
      <div className="divide-y divide-white/5">
        <Section icon={<Percent size={15} />} title="O que é">
          <p>
            <strong className="text-white">Juice</strong> (também: <em>vig</em>, <em>overround</em> ou margem) é o <strong className="text-white">lucro embutido</strong> que a casa cobra num mercado. Toda casa precifica de forma que a soma das probabilidades implícitas passe de 100% — esse excesso é a margem dela.
          </p>
          <p className="rounded-lg bg-black/30 p-2.5 text-center font-mono text-[12px] text-violet-200 ring-1 ring-violet-500/20">
            juice = Σ (1 ÷ odd de cada seleção) − 1
          </p>
          <p>
            <strong className="text-white">Exemplo (1X2):</strong> Casa 2.10 · Empate 3.40 · Fora 3.50 → 0,476 + 0,294 + 0,286 = 1,056 → juice <strong className="text-white">5,6%</strong>. É o que a casa ganha no agregado daquele mercado.
          </p>
        </Section>

        <Section icon={<Target size={15} />} title="Por que existe valor mesmo com juice">
          <p>
            O juice é a margem <strong className="text-white">geral</strong> do mercado; o <strong className="text-white">valor (edge)</strong> é numa <strong className="text-white">seleção específica</strong>. Você pode ter value (<span className="rounded bg-emerald-500/15 px-1 text-emerald-300">+edge%</span>) num mercado de juice alto: a casa carregou a mão no conjunto, mas <strong className="text-white">errou para mais</strong> justamente na seleção que você vai apostar. São coisas diferentes — não confunda margem com lucro esperado.
          </p>
        </Section>

        <Section icon={<Building2 size={15} />} title="Dois juices: a casa e a referência">
          <ul className="space-y-1.5">
            <Field name="Margem da casa">o juice da casa onde você aposta (betano / bet365 / superbet). É o que importa pra você — quanto ela está te cobrando naquele mercado.</Field>
            <Field name="Margem da referência (Pinnacle/consenso)">o juice da fonte da “odd justa”. Serve só como termômetro de qualidade da estimativa.</Field>
          </ul>
          <p className="rounded-lg bg-white/[0.04] p-2.5 ring-1 ring-white/10">
            <strong className="text-white">Padrão esperado:</strong> casas soft cobram <strong className="text-white">6–13%</strong>; a Pinnacle, <strong className="text-white">5–7%</strong>. Mostrar os dois lado a lado deixa claro por que o value existe — e quanto menor a margem da casa, mais “honesto” é aquele mercado.
          </p>
        </Section>

        <Section icon={<Eye size={15} />} title="Transparência: é uma estimativa">
          <p>
            Calculamos o juice a partir das odds das <strong className="text-white">duas pontas</strong> daquele mercado <strong className="text-white">no instante da captura</strong>. Por isso o número é <strong className="text-white">aproximado</strong> (mostramos com <span className="font-mono">~</span>) e <strong className="text-white">não</strong> é necessariamente a margem exata que a casa usa internamente. Use para <em>comparar</em> mercados e casas — não como número oficial.
          </p>
          <p>
            Quando a casa não tem as <strong className="text-white">duas pontas</strong> da partição (ex.: só o “Mais de 2.5”, sem o “Menos de 2.5”), o juice fica <strong className="text-white">não medível</strong> e nós simplesmente <strong className="text-white">não exibimos</strong> — em vez de chutar um valor.
          </p>
        </Section>

        <Section icon={<Gauge size={15} />} title="Como usamos na tela">
          <ul className="space-y-1.5">
            <Field name="Badge no card">“margem da casa ~6,7%”, com cor por faixa (menor = melhor).</Field>
            <Field name="Filtro">“só mercados com margem abaixo de X%” — evita mercados muito carregados.</Field>
            <Field name="Ranking de casas">no painel de Desempenho, a margem média por casa/mercado — qual cobra menos.</Field>
          </ul>
        </Section>
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
