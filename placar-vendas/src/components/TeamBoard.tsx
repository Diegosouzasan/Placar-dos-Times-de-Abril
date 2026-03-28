import type { TeamData } from "../services/GoogleSheetsService";
import { SellerCard } from "./SellerCard";
import { Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TeamBoardProps {
  teamData: TeamData;
  isWinning: boolean;
}

export function TeamBoard({ teamData, isWinning }: TeamBoardProps) {
  const formattedTotal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(teamData.totalSales);

  return (
    <div className="flex flex-col p-4 md:p-6 lg:p-10 h-full w-full">
      {/* Header Team */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/10 pb-4 mb-4 lg:pb-6 lg:mb-6">
        <div className="flex items-center gap-3 lg:gap-6">
          {/* Logo da Equipe */}
          <div className="relative">
             <img
               src={`/img/LOGO ${teamData.teamName}.png`}
               alt={`Logo ${teamData.teamName}`}
               className="w-[clamp(4rem,10vh,6rem)] h-[clamp(4rem,10vh,6rem)] object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]"
               onError={(e) => {
                 // Fallback: tentar .png ou esconder se não achar
                 const img = e.currentTarget;
                 if (img.src.includes('LOGO%20')) {
                   img.src = `/img/${teamData.teamName}.png`;
                 } else if (img.src.endsWith('.png') && !img.src.endsWith('.jpg')) {
                    img.src = `/img/${teamData.teamName}.jpg`;
                 } else {
                   img.style.display = 'none';
                 }
               }}
             />
          </div>

          {/* Foto do Líder */}
          <div className="relative">
            <img
              src={teamData.leader.photoUrl}
              alt={`Líder da equipe ${teamData.teamName}`}
              className="w-[clamp(3.5rem,8vh,5rem)] h-[clamp(3.5rem,8vh,5rem)] rounded-full border-2 border-zinc-700 object-cover"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teamData.leader.name)}&background=random&color=fff`;
              }}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold px-2 py-0.5 text-[clamp(0.6rem,1.5vh,0.75rem)] rounded-full uppercase tracking-wider">
                Líder
              </span>
              <span className="text-zinc-300 font-medium text-[clamp(0.75rem,2vh,1rem)] leading-none">
                {teamData.leader.name}
              </span>
            </div>
            <h2 className="font-black text-white uppercase tracking-tighter mt-1 text-[clamp(1.25rem,4vh,2.5rem)] leading-none">
              {teamData.teamName}
            </h2>
            <div className="flex gap-2 items-center mt-1">
              <span className="text-zinc-500 text-[clamp(0.7rem,1.5vh,0.875rem)]">Vendas da Equipe</span>
              {/* Vencedor Badge Animado */}
              <AnimatePresence>
                {isWinning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
                    className="flex items-center gap-1 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-500/50 text-emerald-400 px-2 py-0.5 rounded-full"
                  >
                    <Trophy className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span className="text-[clamp(0.6rem,1.5vh,0.75rem)] font-bold uppercase tracking-widest leading-none">1º Lugar</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Total Board */}
        <div className="flex flex-col items-end justify-center">
          <span className="text-[clamp(1.5rem,5vh,3rem)] leading-none font-mono font-bold tracking-tighter text-white">
            {formattedTotal}
          </span>
        </div>
      </div>

      {/* Sellers List */}
      <div className="flex-1 min-h-0 flex flex-col gap-[clamp(0.25rem,1vh,0.75rem)]">
        {/* Usamos layout transitions da AnimatePresence pra quando a ordem do DOM mudar */}
        {teamData.sellers.map((seller, idx) => (
          <SellerCard key={seller.name} seller={seller} index={idx} />
        ))}
        {teamData.sellers.length === 0 && (
          <div className="text-zinc-600 text-center text-sm py-4">Nenhum vendedor encontrado</div>
        )}
      </div>
    </div>
  );
}
