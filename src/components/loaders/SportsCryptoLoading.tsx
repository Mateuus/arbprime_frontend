import React from "react";
import { Dribbble, Bitcoin, CircleDollarSign } from "lucide-react";

const SportsCryptoLoading: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-6 animate-fade-in">
      <div className="relative flex items-center gap-6">
        {/* Bola de futebol girando */}
        <div className="animate-spin-slow text-green-500">
          <CircleDollarSign size={48} />
        </div>

        {/* Criptomoeda pulando */}
        <div className="animate-bounce text-yellow-400">
          <Bitcoin size={48} />
        </div>

        {/* Bola de basquete pulando invertida */}
        <div className="animate-bounce-alt text-orange-500">
            <Dribbble size={48} />
        </div>
      </div>
    </div>
  );
};

export default SportsCryptoLoading;
