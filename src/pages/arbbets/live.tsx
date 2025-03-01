import React, { useState } from 'react';

const ArbBetsLive: React.FC = () => {
  //const [highlightChange, setHighlightChange] = useState(false);
  const [profit, setProfit] = useState(10); // Valor inicial do lucro

  const triggerHighlight = () => {
    const cardElement = document.getElementById('example-card');
    if (cardElement) {
      const newProfit = profit + (Math.random() > 0.5 ? 5 : -5); // Lucro sobe ou desce
      const changeClass = newProfit > profit ? 'flash-green' : 'flash-red';

      setProfit(newProfit); // Atualiza o lucro
      cardElement.classList.add(changeClass); // Adiciona a classe de destaque

      // Remove a classe após 1 segundo
      setTimeout(() => {
        cardElement.classList.remove(changeClass);
      }, 1000);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-white mb-6">Arb Live</h1>
      <div className="flex justify-center mb-4">
        <button
          onClick={triggerHighlight}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          Simular Efeito
        </button>
      </div>
      <div
        id="example-card"
        className="bg-gray-900 p-6 rounded-lg shadow-md text-white transition-all"
      >
        <h2 className="text-xl font-bold mb-2">Exemplo de Card</h2>
        <p className="text-sm">Lucro Atual: {profit}%</p>
      </div>
    </div>
  );
};

export default ArbBetsLive;
