import SportsCryptoLoading from "@/components/loaders/SportsCryptoLoading";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold text-white mb-6">ArbPrime</h1>

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
      </div>

      <div className="mt-8">
        <SportsCryptoLoading />
      </div>
    </div>
  );
}