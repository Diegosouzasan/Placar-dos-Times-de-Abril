import { motion } from "framer-motion";
import clsx from "clsx";
import type { RankedSeller } from "../services/SupabaseService";
import { Coins } from "lucide-react";
import { useEffect, useRef } from "react";

interface SellerCardProps {
  seller: RankedSeller;
  index: number;
  dailyGoal: number;
  weeklyGoal: number;
}

export function SellerCard({ seller, index, dailyGoal, weeklyGoal }: SellerCardProps) {
  const prevSalesRef = useRef(seller.sales);

  useEffect(() => {
    prevSalesRef.current = seller.sales;
  }, [seller.sales]);
  const formattedSales = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(seller.sales);

  const currentDailyGoal = seller.dailyGoal || dailyGoal;
  const missingDaily = Math.max(0, currentDailyGoal - seller.sales);
  const formattedMissing = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(missingDaily);

  const hasMetDailyGoal = seller.sales >= currentDailyGoal;
  const hasMetWeeklyGoal = seller.weeklySales >= weeklyGoal;

  const weeklyProgress = Math.min(100, (seller.weeklySales / weeklyGoal) * 100);

  return (
    <motion.div
      layout
      layoutId={seller.name}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={clsx(
        "relative flex items-center justify-between px-3 lg:px-6 py-[clamp(0.2rem,1.2vh,0.75rem)] rounded-xl lg:rounded-2xl transition-all",
        "backdrop-blur-md flex-1 min-h-[40px]",
        hasMetWeeklyGoal 
          ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/5 border border-blue-400/60 shadow-[0_0_20px_rgba(37,99,235,0.4)] z-10"
          : hasMetDailyGoal 
            ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.3)] z-10" 
            : "bg-white/5 border border-white/10 shadow-sm hover:bg-white/10"
      )}
    >
      {/* Brilho Meta Semanal (Azul/Branco) */}
      {hasMetWeeklyGoal && (
        <div className="absolute inset-0 rounded-xl lg:rounded-2xl bg-white/10 mix-blend-overlay animate-pulse pointer-events-none shadow-[inset_0_0_15px_rgba(255,255,255,0.3)]" />
      )}
      
      {/* Brilho Meta Diária (Amarelo) */}
      {hasMetDailyGoal && !hasMetWeeklyGoal && (
        <div className="absolute inset-0 rounded-xl lg:rounded-2xl bg-yellow-500/10 mix-blend-overlay animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center gap-2 lg:gap-4 h-full relative z-10 flex-1 min-w-0">
        <span className="text-zinc-500 font-mono text-[clamp(0.75rem,2vh,1.125rem)] w-4 flex-shrink-0 text-center">
          {index + 1}
        </span>
        
        <div className="relative flex items-center h-full">
          <img
            src={seller.photoUrl}
            alt={seller.name}
            className={clsx(
              "w-[clamp(2rem,6vh,3rem)] h-[clamp(2rem,6vh,3rem)] rounded-full object-cover border shadow-[0_0_10px_rgba(0,0,0,0.5)]",
              hasMetWeeklyGoal ? "border-blue-400" : "border-white/20"
            )}
            onError={(e) => {
              const img = e.currentTarget;
              const sellerFirstName = seller.name.split(' ')[0];
              
              if (img.src.includes('avatar')) return; // Evita loop infinito

              if (img.src.includes('http') && !img.src.includes('ui-avatars')) {
                // Se era uma URL externa e falhou, tenta local
                img.src = `/img/${encodeURIComponent(sellerFirstName)}.png`;
              } else if (img.src.endsWith('.png')) {
                // Se era PNG local e falhou, tenta JPG
                img.src = `/img/${encodeURIComponent(sellerFirstName)}.jpg`;
              } else {
                // Último recurso: avatar de texto
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
              }
            }}
          />
        </div>

        {/* BARRA DE PROGRESSO SEMANAL - Criativa e Moderna */}
        <div className="flex-1 flex flex-col justify-center min-w-0 pr-4">
          <div className="flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
            <span className={clsx(
              "leading-tight tracking-tight text-[clamp(0.8rem,2.5vh,1.125rem)] truncate",
              hasMetWeeklyGoal ? "text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" :
              hasMetDailyGoal ? "text-yellow-300 font-bold" : "text-white font-medium"
            )}>
              {seller.name}
            </span>
          </div>
          
          <div className="mt-1.5 relative">
            <div className="h-1.5 lg:h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${weeklyProgress}%` }}
                   transition={{ duration: 1.5, ease: "circOut" }}
                   className={clsx(
                     "h-full rounded-full relative animate-gradient-flow",
                     hasMetWeeklyGoal 
                       ? "bg-gradient-to-r from-blue-400 via-white to-blue-400 shadow-[0_0_15px_rgba(255,255,255,0.6)]" 
                       : "bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500"
                   )}
                 >
                    {/* Faísca que percorre a barra */}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                       <div className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-sparkle" />
                    </div>
                    
                    {/* Brilho interno líquido */}
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] w-1/2 animate-[shimmer_2s_infinite]" />
                 </motion.div>
            </div>

            {/* Valor Flutuante Abaixo da Barra (Fora do overflow-hidden) */}
            <motion.div 
              initial={{ left: 0 }}
              animate={{ left: `${weeklyProgress}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="absolute top-full -translate-y-0.5 -translate-x-1/2 z-20 pointer-events-none"
            >
              <span className="text-white/90 text-[clamp(0.55rem,1.5vh,0.65rem)] font-mono font-bold whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(seller.weeklySales)}
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Coluna Venda Diária */}
      <div className="w-32 lg:w-44 flex justify-center items-center gap-1 lg:gap-2 shrink-0 relative z-10">
        {seller.sales > 0 && <Coins className={clsx(
          "w-4 h-4 lg:w-5 lg:h-5 opacity-80",
          hasMetWeeklyGoal ? "text-white" : hasMetDailyGoal ? "text-yellow-400" : "text-emerald-500"
        )} />}
        <span
          className={clsx(
            "font-mono tracking-tighter text-[clamp(1rem,2.5vh,1.5rem)] whitespace-nowrap",
            hasMetWeeklyGoal ? "text-white font-black drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]" :
            hasMetDailyGoal 
              ? "text-yellow-400 font-black drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" 
              : (seller.sales > 0 ? "font-bold text-emerald-400" : "font-bold text-zinc-600")
          )}
        >
          {formattedSales}
        </span>
      </div>

      {/* Coluna Falta */}
      <div className="w-24 lg:w-32 flex justify-end items-center shrink-0 relative z-10">
        {!hasMetDailyGoal && (
           <span className="text-[clamp(0.8rem,2vh,1.1rem)] text-red-500/90 font-mono font-bold tracking-tighter animate-pulse">
             {formattedMissing.replace("R$", "").trim()}
           </span>
        )}
        {hasMetDailyGoal && (
          <span className="text-emerald-500 font-bold text-[0.7rem] uppercase tracking-widest text-right">
            Meta Batida
          </span>
        )}
      </div>
    </motion.div>
  );
}
