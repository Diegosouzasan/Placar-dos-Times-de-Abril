import { motion } from "framer-motion";
import clsx from "clsx";
import type { RankedSeller } from "../services/GoogleSheetsService";
import { Coins } from "lucide-react";
import { DAILY_GOAL } from "../config/teams";

interface SellerCardProps {
  seller: RankedSeller;
  index: number;
}

export function SellerCard({ seller, index }: SellerCardProps) {
  // Format para mostrar dinheiro br (R$ 10.000,00)
  const formattedSales = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(seller.sales);

  const hasMetGoal = seller.sales >= DAILY_GOAL;

  return (
    <motion.div
      layout
      layoutId={seller.name}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={clsx(
        "relative flex items-center justify-between px-3 lg:px-6 py-[clamp(0.25rem,1.5vh,1rem)] rounded-xl lg:rounded-2xl transition-all",
        "backdrop-blur-md flex-1 min-h-[40px] max-h-[80px]",
        hasMetGoal 
          ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] z-10" 
          : "bg-white/5 border border-white/10 shadow-sm hover:bg-white/10"
      )}
    >
      {/* Brilho Extra Animado (Pulso) simulando luz em quem bateu a meta */}
      {hasMetGoal && (
        <div className="absolute inset-0 rounded-xl lg:rounded-2xl bg-yellow-500/10 mix-blend-overlay animate-pulse pointer-events-none" />
      )}
      <div className="flex items-center gap-2 lg:gap-4 h-full">
        {/* Posição no Ranking Interno da Equipe */}
        <span className="text-zinc-500 font-mono text-[clamp(0.75rem,2vh,1.125rem)] w-4 flex-shrink-0 text-center">
          {index + 1}
        </span>
        
        {/* Foto do Vendedor */}
        <div className="relative flex items-center h-full">
          <img
            src={seller.photoUrl}
            alt={seller.name}
            className="w-[clamp(2rem,6vh,3rem)] h-[clamp(2rem,6vh,3rem)] rounded-full object-cover border border-white/20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
            onError={(e) => {
              const img = e.currentTarget;
              // Se a primeira tentativa (.jpg) falhou, tentamos o formato .png
              if (img.src.endsWith('.jpg')) {
                img.src = `/img/${encodeURIComponent(seller.name)}.png`;
              } else {
                // Se o PNG também não existe, usa os avatares padrão com iniciais
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
              }
            }}
          />
        </div>

        {/* Nome do Vendedor */}
        <div className="flex flex-col justify-center">
          <span className={clsx(
            "leading-tight tracking-tight text-[clamp(0.8rem,2.5vh,1.125rem)]",
            hasMetGoal 
              ? "text-yellow-300 font-bold drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" 
              : "text-white font-medium"
          )}>
            {seller.name}
          </span>
          <span className="text-zinc-400 text-[clamp(0.65rem,1.5vh,0.85rem)] leading-none mt-0.5">Vendedor</span>
        </div>
      </div>

      {/* Valor Vendido (Destaque em Verde Fluído ou Dourado se bater a meta) */}
      <div className="flex items-center gap-1.5 lg:gap-3">
        {seller.sales > 0 && <Coins className={clsx(
          "w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)] opacity-80",
          hasMetGoal ? "text-yellow-400" : "text-emerald-500"
        )} />}
        <span
          className={clsx(
            "font-mono tracking-tighter text-[clamp(1rem,3vh,1.5rem)]",
            hasMetGoal 
              ? "text-yellow-400 font-black drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" 
              : (seller.sales > 0 ? "font-bold text-emerald-400" : "font-bold text-zinc-600")
          )}
        >
          {formattedSales}
        </span>
      </div>
    </motion.div>
  );
}
