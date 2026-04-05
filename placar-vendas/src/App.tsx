import { useEffect, useState, useRef } from "react";
import { fetchPlacarData, type DashboardData, type RankedSeller } from "./services/SupabaseService";
import { supabase } from "./services/supabaseClient";
import { TeamBoard } from "./components/TeamBoard";
import { MetaCelebration } from "./components/MetaCelebration";
import { FloatingParticles } from "./components/FloatingParticles";
import Controller from "./components/Controller";
import { DAILY_GOAL } from "./config/teams";
import { motion } from "framer-motion";

function App() {
  const [data, setData] = useState<DashboardData>({ teams: [], winningTeam: null });
  const [celebratingSeller, setCelebratingSeller] = useState<RankedSeller | null>(null);
  const [isAdmin, setIsAdmin] = useState(window.location.hash === "#/admin");
  
  const celebratedSellersRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Escutar mudança de Hash para Navegação
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdmin(window.location.hash === "#/admin");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Busca inicial e Realtime
  useEffect(() => {
    if (isAdmin) return;

    const loadAndListen = async () => {
      try {
        const initialData = await fetchPlacarData();
        setData(initialData);
        isFirstLoadRef.current = false;
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      }

      // Configurar Realtime
      const channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async (payload: any) => {
          const newData = await fetchPlacarData();
          
          // Lógica de Celebração
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
             const updatedSeller = payload.new;
             if (updatedSeller.total_sales >= DAILY_GOAL && !celebratedSellersRef.current.has(updatedSeller.id)) {
                // Encontrar o vendedor no novo dataset para ter os dados completos (foto, etc)
                const fullSeller = newData.teams.flatMap(t => t.sellers).find(s => s.id === updatedSeller.id);
                if (fullSeller) {
                   setCelebratingSeller(fullSeller);
                   celebratedSellersRef.current.add(updatedSeller.id);
                }
             }
             // Se resetar o valor, permitir comemorar de novo
             if (updatedSeller.total_sales === 0) {
                celebratedSellersRef.current.delete(updatedSeller.id);
             }
          }
          
          setData(newData);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
          const newData = await fetchPlacarData();
          setData(newData);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    loadAndListen();
  }, [isAdmin]);

  if (isAdmin) {
    return <Controller />;
  }

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

      {/* PARTICULAS FLUTUANTES */}
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
            <TeamBoard teamData={team as any} isWinning={data.winningTeam === team.teamName} />
          </div>
        ))}
        {data.teams.length === 0 && (
          <div className="col-span-1 lg:col-span-2 text-center text-zinc-500 font-mono text-xl mt-20 animate-pulse">
            Sincronizando com o Supabase...
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

      {/* BOTAO PARA ADMIN (Discreto) */}
      <a 
        href="#/admin" 
        className="absolute bottom-4 right-4 z-30 p-2 bg-white/5 hover:bg-white/10 rounded-full opacity-20 hover:opacity-100 transition-opacity"
        title="Painel de Controle"
      >
        <span className="sr-only">Admin</span>
        ⚙️
      </a>
    </main>
  );
}

export default App;
