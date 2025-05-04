import React from "react";
import { Dribbble, Bitcoin, CircleDollarSign } from "lucide-react";

const SportsCryptoLoading: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-20 gap-1 animate-fade-in">
      <div className="relative flex items-center">
        {/* Bola de futebol girando */}
        <div className="animate-spin-slow text-green-500">
          <CircleDollarSign size={24} />
        </div>

        {/* Criptomoeda pulando */}
        <div className="animate-bounce text-yellow-400">
          <Bitcoin size={24} />
        </div>

        {/* Bola de basquete pulando invertida */}
        <div className="animate-bounce-alt text-orange-500">
            <Dribbble size={24} />
        </div>
      </div>
    </div>
  );
};

export default SportsCryptoLoading;
