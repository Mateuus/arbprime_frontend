import SportsCryptoLoading from "@/components/loaders/SportsCryptoLoading";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <div className="flex justify-center mb-6">
        <div className="text-5xl font-extrabold text-white">
          <span className="text-white">ARB</span><span className="text-green-500">PRIME</span>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">🧠 Sobre o Projeto</h2>
          <p className="text-gray-300">
            O <strong>ArbPrime</strong> está em fase de desenvolvimento e <strong>será totalmente gratuito durante este período</strong>.
            Já contamos com um <strong>fundo de sustentação</strong> dedicado exclusivamente para manter os servidores ativos até a conclusão da plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">📣 Feedback é essencial</h2>
          <p className="text-gray-300">
            Nosso objetivo é construir a melhor ferramenta de arbitragem, e para isso contamos com <strong>seu feedback direto em nosso Discord</strong>.
            A sua participação é essencial para que possamos melhorar continuamente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">🔎 Independência e Foco no Brasil</h2>
          <p className="text-gray-300">
            Diferente de 90% das plataformas atuais, <strong>não utilizamos APIs prontas como surebet.com</strong>.
            Todo o sistema — desde os crawlers que coletam dados em casas de apostas e exchanges até o cálculo de arbitragem —
            é <strong>100% processado por nossos próprios servidores</strong>.
          </p>
          <p className="text-gray-300 mt-2">
            Além disso, nossa plataforma de <strong>surebets é totalmente focada em casas de apostas brasileiras</strong>,
            oferecendo maior precisão e aderência ao nosso mercado.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">🌐 Comunidade no Discord</h2>
          <p className="text-gray-300">
            O nosso <strong>Discord é uma extensão direta da plataforma ArbPrime</strong>. Lá você encontra:
          </p>
          <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
            <li>Promoções e bônus exclusivos de casas de apostas parceiras</li>
            <li>Compartilhamento de entradas da comunidade para aumentar seus ganhos</li>
            <li>Acesso a métodos avançados como o uso de <strong>delay</strong> e estratégias validadas</li>
            <li>Suporte direto da equipe e atualizações em tempo real</li>
          </ul>
          <p className="text-green-400 mt-4">
            👉 <a href="https://discord.gg/gTfDKZscDx" target="_blank" rel="noopener noreferrer" className="underline">Acesse nosso Discord e faça parte da comunidade ArbPrime!</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">⚙️ O que estamos construindo</h2>
          <div className="space-y-4 text-gray-300">
            <div>
              <strong className="text-white">🧠 Prime Analytix:</strong><br />
              Em desenvolvimento. Através da calculadora (crypto e surebet), você poderá adicionar arbitragens realizadas e controlar sua banca — sem planilhas, sem sites de terceiros — tudo dentro do <strong>ArbPrime</strong>.
            </div>
            <div>
              <strong className="text-white">💰 ArbCrypto:</strong><br />
              Atualmente operando com <strong>mercados perpétuos (perpetuals)</strong>. Em breve, novos tipos de arbitragem cripto.
            </div>
            <div>
              <strong className="text-white">⚽ ArbBets:</strong><br />
              Foco inicial em <strong>surebets prematch</strong> de casas brasileiras. Em breve, integrações com apostas ao vivo (live).
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">🚀 Roadmap de Desenvolvimento</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong>Fase 1:</strong> Monitoramento de cripto e apostas com calculadora integrada ✅</li>
            <li><strong>Fase 2:</strong> Área do usuário com favoritos e alertas personalizados (em desenvolvimento)</li>
            <li><strong>Fase 3:</strong> Execução automatizada de ordens (cripto) e entrada assistida (apostas)</li>
          </ul>
        </section>
      </div>

      <div className="mt-8">
        <SportsCryptoLoading />
      </div>
    </div>
  );
}