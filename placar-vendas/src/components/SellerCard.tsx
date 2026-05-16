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
  compact?: boolean;
}

export function SellerCard({ seller, index, dailyGoal, weeklyGoal, compact }: SellerCardProps) {
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
        "relative flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-1.5 rounded-xl transition-all",
        "backdrop-blur-md min-h-[50px] w-full flex-shrink-0",
        hasMetWeeklyGoal
          ? "bg-gradient-to-r from-blue-600/30 to-indigo-600/5 border border-blue-400/60 shadow-[0_0_15px_rgba(37,99,235,0.3)] z-10"
          : hasMetDailyGoal
            ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/5 border border-yellow-500/60 shadow-[0_0_15px_rgba(234,179,8,0.2)] z-10"
            : "bg-[#1a2b2b]/40 border border-white/5 shadow-sm hover:bg-white/5"
      )}
    >
      {/* Brilho Meta Semanal */}
      {hasMetWeeklyGoal && (
        <div className="absolute inset-0 rounded-xl bg-white/10 mix-blend-overlay animate-pulse pointer-events-none shadow-[inset_0_0_10px_rgba(255,255,255,0.2)]" />
      )}

      {/* Rank (Número na esquerda) */}
      <div className="w-5 flex-shrink-0 flex justify-center items-center">
        <span className="text-zinc-600 font-mono text-xs font-bold">
          {index + 1}
        </span>
      </div>

      {/* Foto do Vendedor */}
      <div className="relative w-10 h-10 lg:w-11 lg:h-11 flex-shrink-0">
        {hasMetWeeklyGoal && (
          <motion.img
            initial={{ scale: 0, rotate: -40 }}
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: -32,
              filter: ["drop-shadow(0 0 8px rgba(234, 179, 8, 0.4))", "drop-shadow(0 0 20px rgba(234, 179, 8, 0.8))", "drop-shadow(0 0 8px rgba(234, 179, 8, 0.4))"]
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            src="/img/Coroa.png"
            alt="Coroa"
            className="absolute -top-4 -left-2 w-6 h-6 z-50 pointer-events-none"
          />
        )}
        <img
          src={seller.photoUrl}
          alt={seller.name}
          className={clsx(
            "w-full h-full rounded-full object-cover border-2 shadow-xl",
            hasMetWeeklyGoal ? "border-blue-400" : "border-zinc-700"
          )}
          onError={(e) => {
            const img = e.currentTarget;
            const sellerFirstName = seller.name.split(' ')[0];
            
            // Tenta o caminho local padrão se o photoUrl falhar
            const localPath = `/img/${sellerFirstName}.png`;
            if (img.src !== window.location.origin + localPath) {
              img.src = localPath;
            } else {
              // Fallback final para iniciais
              img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerFirstName)}&background=3f3f46&color=fff`;
            }
          }}
        />
      </div>

      {/* Info Group: Nome + Progresso Semanal */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <span className="text-white font-bold text-base lg:text-lg tracking-tight leading-tight truncate">
          {seller.name}
        </span>
        
        <div className="mt-1 w-full relative h-6 flex items-center">
          <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyProgress}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className={clsx(
                "h-full rounded-full animate-gradient-flow relative",
                hasMetWeeklyGoal
                  ? "bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-200"
                  : "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
              )}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 blur-sm" />
            </motion.div>
          </div>
          
          {/* Valor Flutuante que segue a ponta da barra */}
          <motion.div 
            initial={{ left: 0 }}
            animate={{ left: `${weeklyProgress}%` }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="absolute top-4 -translate-x-1/2 flex flex-col items-center"
          >
            <span className="text-white font-bold font-mono text-[9px] tracking-tighter bg-zinc-900/80 backdrop-blur-sm border border-white/10 px-1 rounded-sm shadow-lg whitespace-nowrap">
              {new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(seller.weeklySales)}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Valor Vendido Hoje (Destaque Esmeralda) */}
      <div className="flex items-center gap-1.5 px-2">
        <Coins className="w-4 h-4 text-emerald-500/80" />
        <span className="text-emerald-400 font-bold font-mono text-lg lg:text-xl tracking-tighter whitespace-nowrap">
          {formattedSales}
        </span>
      </div>

      {/* Valor que Falta (Destaque Vermelho) */}
      <div className="flex justify-end w-20 lg:w-28">
        {!hasMetDailyGoal ? (
          <span className="text-[#ff4d4d] font-mono font-bold text-base lg:text-lg tracking-tighter">
            {formattedMissing.replace("R$", "").trim()}
          </span>
        ) : (
          <span className="text-emerald-500 font-black text-[9px] uppercase tracking-widest text-right">
            META BATIDA
          </span>
        )}
      </div>
    </motion.div>
  );
}
