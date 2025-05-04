import SportsCryptoLoading from "@/components/loaders/SportsCryptoLoading";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Home</h1>
      <p className="text-gray-300">
        Bem-vindo à página de Torneios! Aqui você encontrará todas as informações sobre os torneios em andamento e futuros.
      </p>
      <SportsCryptoLoading/>
    </div>
  );
}
