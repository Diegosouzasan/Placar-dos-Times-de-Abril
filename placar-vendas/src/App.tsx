import { useEffect, useState, useRef } from "react";
import { fetchPlacarData } from "./services/GoogleSheetsService";
import type { DashboardData, RankedSeller } from "./services/GoogleSheetsService";
import { TeamBoard } from "./components/TeamBoard";
import { MetaCelebration } from "./components/MetaCelebration";
import { FloatingParticles } from "./components/FloatingParticles";
import { DAILY_GOAL } from "./config/teams";
import { motion } from "framer-motion";

function App() {
  const [data, setData] = useState<DashboardData>({ teams: [], winningTeam: null });
  const [celebratingSeller, setCelebratingSeller] = useState<RankedSeller | null>(null);
  
  // Guardamos as vendas anteriores para proteção contra oscilação
  const previousSalesRef = useRef<Record<string, number>>({});
  // Guardamos quem já bateu a meta nessa sessão para impedir o loop
  const celebratedSellersRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Polling para atualizar o placar
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const pollData = async () => {
      try {
        const newData = await fetchPlacarData();
        
        if (!isFirstLoadRef.current) {
          const allSellers = newData.teams.flatMap(t => t.sellers);
          
          for (const seller of allSellers) {
            const previousSales = previousSalesRef.current[seller.name] || 0;
            
            // Se o valor zerar, liberamos para comemorar de novo amanhã/próximo ciclo
            if (seller.sales === 0 && previousSales > 0) {
               celebratedSellersRef.current.delete(seller.name);
            }

            // Impede a dupla comemoração: só aciona se nunca comemorou na sessão
            if (seller.sales >= DAILY_GOAL && !celebratedSellersRef.current.has(seller.name)) {
              setCelebratingSeller(seller);
              celebratedSellersRef.current.add(seller.name);
            }

            // Proteção contra o "Jitter" foi removida a pedido do usuário
            // para permitir que o placar seja atualizado caso o valor de uma venda diminua.
          }

          // Como corrigimos os valores pra não oscilarem, precisamos recalcular os times
          newData.teams.forEach(team => {
            team.totalSales = team.sellers.reduce((sum, s) => sum + s.sales, 0);
            team.sellers.sort((a,b) => b.sales - a.sales);
          });

          // Re-avaliar quem está ganhando
          if (newData.teams.length === 2) {
             const t1 = newData.teams[0];
             const t2 = newData.teams[1];
             if (t1.totalSales > t2.totalSales) newData.winningTeam = t1.teamName;
             else if (t2.totalSales > t1.totalSales) newData.winningTeam = t2.teamName;
             else newData.winningTeam = null;
          }
        }

        // Registrar Snapshot Oficial dessa amostragem
        const newSalesMap: Record<string, number> = {};
        newData.teams.flatMap(t => t.sellers).forEach(s => {
          newSalesMap[s.name] = s.sales;
        });
        previousSalesRef.current = newSalesMap;
        isFirstLoadRef.current = false;
        
        setData(newData);
      } catch (error) {
        console.error("Erro ao fazer polling do Google Sheets:", error);
      } finally {
        timeoutId = setTimeout(pollData, 10000); // 10s de intervalo
      }
    };

    pollData();

    return () => clearTimeout(timeoutId);
  }, []);

  // Enquanto a celebração está rolando, bloqueamos o fundo (mas ele continua atualizando nos state hidden)
  return (
    <main className="relative h-[100dvh] w-screen bg-zinc-950 font-sans text-white overflow-hidden flex flex-col p-2 lg:p-6">
      {/* BOLA COM BLUR DE FUNDO */}
      <motion.div
        className="absolute top-[10%] left-[20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none"
        animate={{
          x: ["0vw", "20vw", "-20vw", "10vw", "0vw"],
          y: ["0vh", "30vh", "10vh", "-20vh", "0vh"],
          scale: [1, 1.2, 0.8, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* PARTICULAS FLUTUANTES (CICLO DE MINUTOS) */}
      <FloatingParticles />

      {/* CABEÇALHO DO PLACAR */}
      <div className="relative z-10 flex-shrink-0 flex justify-center mb-4 lg:mb-6 pt-2">
        <h1 className="text-[clamp(2rem,6vh,4rem)] tracking-tighter uppercase font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 drop-shadow-sm leading-none">
          Placar dos Times
        </h1>
      </div>

      {/* DASHBOARD GRID */}
      <div className="relative z-10 flex-1 w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 min-h-0 pb-4">
        {data.teams.map((team) => (
          <div key={team.teamName} className="relative min-h-0 flex flex-col rounded-3xl overflow-hidden glass-panel">
            <TeamBoard teamData={team} isWinning={data.winningTeam === team.teamName} />
          </div>
        ))}
        {data.teams.length === 0 && (
          <div className="col-span-1 lg:col-span-2 text-center text-zinc-500 font-mono text-xl mt-20 animate-pulse">
            Sincronizando com o Google Sheets...
          </div>
        )}
      </div>

      {/* OVERLAY DE COMEMORAÇÃO */}
      <MetaCelebration 
        seller={celebratingSeller} 
        onFinished={() => setCelebratingSeller(null)} 
      />

      {/* LOGO INFERIOR */}
      <div className="absolute bottom-2 lg:bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <img 
          src="/img/Logo Nosso Consignado.png" 
          alt="Nosso Consignado" 
          className="h-5 lg:h-8 object-contain opacity-70 drop-shadow-sm mix-blend-screen" 
        />
      </div>
    </main>
  );
}

export default App;
