import type { TeamData } from "../services/SupabaseService";
import { SellerCard } from "./SellerCard";
import { Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TeamBoardProps {
  teamData: TeamData;
  isWinning: boolean;
  dailyGoal: number;
  weeklyGoal: number;
  isSingleTeam?: boolean;
}

export function TeamBoard({ teamData, isWinning, dailyGoal, weeklyGoal, isSingleTeam }: TeamBoardProps) {
  const isHybrid = teamData.isHybridMode;
  
  const inssSellers = teamData.sellers.filter(s => s.isHybridInss);
  const cltSellers = teamData.sellers.filter(s => !s.isHybridInss);
  
  const inssTotal = inssSellers.reduce((sum, s) => sum + s.sales, 0);
  const cltTotal = cltSellers.reduce((sum, s) => sum + s.sales, 0);
  const consolidatedTotal = teamData.totalSales; // Já calculado no Service (ou pode ser inssTotal + cltTotal se não for manual)

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);

  const formattedWeeklyGoal = formatCurrency(weeklyGoal);

  if (isHybrid) {
    return (
      <div className="flex flex-col h-full w-full text-white p-2 lg:p-4 relative overflow-hidden font-sans">
        {/* Camada de Fundo Estilizada Removida para permitir transparência do App.tsx */}
        
        {/* Container Principal de Conteúdo (Sem fundo para usar o glass-panel do App.tsx) */}
        <div className="flex-1 relative z-10 flex flex-col mt-1 p-2 lg:p-6 overflow-hidden">
          
          {/* Header Interno: CLT | LÍDER | INSS */}
          <div className="flex items-center justify-between mb-4 lg:mb-6 px-2 lg:px-6">
            {/* Título e Valor CLT */}
            <div className="flex flex-col gap-1 w-[38%]">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl lg:text-4xl font-black italic tracking-tighter text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">CLT</h2>
                <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1 backdrop-blur-md">
                  <span className="text-white font-mono font-bold text-lg lg:text-xl">
                    {formatCurrency(cltTotal)}
                  </span>
                </div>
              </div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Vendas CLT do Time</span>
            </div>

            {/* Central: Informações do Líder */}
            <div className="flex items-center gap-3 w-[24%] justify-center scale-90 lg:scale-100">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-zinc-700 shadow-2xl relative z-10 bg-zinc-900">
                  <img 
                    src={teamData.leader.photoUrl} 
                    alt={teamData.leader.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      const img = e.currentTarget;
                      const firstName = teamData.leader.name.split(' ')[0];
                      const localPath = `/img/${firstName}.png`;
                      if (img.src !== window.location.origin + localPath) {
                        img.src = localPath;
                      } else {
                        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=3f3f46&color=fff`;
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="flex flex-col items-start text-left">
                <div className="flex items-center gap-1.5 mb-0">
                  <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold px-1.5 py-0.5 text-[8px] rounded-full uppercase tracking-wider">
                    LÍDER
                  </span>
                  <span className="text-white font-bold uppercase tracking-tight text-xs lg:text-sm whitespace-nowrap">
                    {teamData.leader.name}
                  </span>
                </div>
                
                <h2 className="font-black text-white uppercase tracking-tighter text-lg lg:text-xl leading-none mb-0.5 whitespace-nowrap">
                  {teamData.teamName}
                </h2>
                
                <span className="text-zinc-500 text-[8px] lg:text-[9px] font-bold uppercase tracking-wide opacity-80">
                  Vendas da Equipe
                </span>
              </div>
            </div>

            {/* Título e Valor INSS */}
            <div className="flex flex-col items-end gap-1 w-[38%]">
              <div className="flex items-center gap-3">
                <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1 backdrop-blur-md">
                  <span className="text-white font-mono font-bold text-lg lg:text-xl">
                    {formatCurrency(inssTotal)}
                  </span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-black italic tracking-tighter text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">INSS</h2>
              </div>
              <span className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Vendas INSS do Time</span>
            </div>
          </div>

          {/* Área de Vendedores */}
          <div className="flex-1 flex gap-6 lg:gap-8 min-h-0 relative">
            {/* Divisor Central Vertical */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2 z-0" />

            {/* Coluna CLT */}
            <div className="flex-1 flex flex-col gap-1 z-10">
              {cltSellers.map((seller, idx) => (
                <SellerCard 
                  key={seller.id} 
                  seller={seller} 
                  index={idx} 
                  dailyGoal={dailyGoal}
                  weeklyGoal={weeklyGoal}
                />
              ))}
            </div>

            {/* Coluna INSS */}
            <div className="flex-1 flex flex-col gap-1 z-10">
              {inssSellers.map((seller, idx) => (
                <SellerCard 
                  key={seller.id} 
                  seller={seller} 
                  index={idx + cltSellers.length} 
                  dailyGoal={dailyGoal}
                  weeklyGoal={weeklyGoal}
                />
              ))}
            </div>
          </div>

          {/* Rodapé: Total Consolidado (Compacto) */}
          <div className="mt-2 lg:mt-3 flex justify-center">
            <div className="bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 rounded-xl px-8 lg:px-12 py-2 lg:py-3 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-center scale-90 lg:scale-95">
              <span className="block text-[7px] lg:text-[8px] text-emerald-400 font-black uppercase tracking-[0.4em] mb-0.5">Total de Vendas do Time</span>
              <span className="text-white font-mono font-black text-2xl lg:text-4xl tracking-tighter drop-shadow-md">
                {formatCurrency(consolidatedTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 md:p-6 lg:p-10 h-full w-full">
      {/* Header Team (Original) */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/10 pb-4 mb-4 lg:pb-6 lg:mb-6">
        <div className="flex items-center gap-3 lg:gap-6">
          <div className="relative">
             <img
               src={
                 teamData.teamName.toUpperCase() === "TROPA DE ELITE" ? "/img/Logos/Logo Tropa de Elite.png" :
                 teamData.teamName.toUpperCase() === "AGUIAS" ? "/img/Logos/Logo Aguias.png" :
                 teamData.teamName.toUpperCase() === "PATROAS" ? "/img/Logos/Logo Patroas.png" :
                 `/img/Logos/Logo ${teamData.teamName}.png`
               }
               alt={`Logo ${teamData.teamName}`}
               className={`w-[clamp(4rem,8vh,6rem)] h-[clamp(4rem,8vh,6rem)] object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] ${
                 teamData.teamName.toUpperCase() === "PATROAS" ? "scale-90" : "scale-100"
               }`}
               onError={(e) => {
                 const img = e.currentTarget;
                 if (!img.src.includes('/Logos/')) {
                    img.style.display = 'none';
                 } else {
                    img.src = `/img/LOGO ${teamData.teamName}.png`;
                 }
               }}
             />
          </div>

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

        <div className="flex flex-col items-end justify-center">
          <span className="text-[clamp(0.6rem,1vh,0.75rem)] uppercase font-black tracking-widest text-emerald-500 mb-1">
            Venda Total
          </span>
          <span className="text-[clamp(1.5rem,5vh,3.5rem)] leading-none font-mono font-bold tracking-tighter text-white">
            {formatCurrency(teamData.totalSales)}
          </span>
        </div>
      </div>

      {/* Sellers List */}
      <div className="flex-1 flex flex-col justify-between min-h-0">
        {!isSingleTeam && (
          <div className="hidden lg:flex items-center px-4 lg:px-6 mb-1 text-zinc-500 font-black uppercase tracking-widest text-[0.7rem]">
            <div className="flex-1 flex justify-center pl-32 text-zinc-400">
              Meta Semanal: <span className="ml-1 text-zinc-300">{formattedWeeklyGoal}</span>
            </div> 
            <div className="w-32 lg:w-44 text-center">Venda Diária</div>
            <div className="w-24 lg:w-32 text-right">Falta</div>
          </div>
        )}

        <div className={isSingleTeam ? "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 h-full content-start" : "flex-1 flex flex-col justify-start gap-2"}>
          {teamData.sellers.map((seller, idx) => (
            <SellerCard 
              key={seller.id} 
              seller={seller} 
              index={idx} 
              dailyGoal={dailyGoal}
              weeklyGoal={weeklyGoal}
            />
          ))}
        </div>
        {teamData.sellers.length === 0 && (
          <div className="text-zinc-600 text-center text-sm py-4">Nenhum vendedor encontrado</div>
        )}
      </div>
    </div>
  );
}
