import { useEffect, useState, useRef } from "react";
import { fetchPlacarData, type DashboardData, type RankedSeller } from "./services/SupabaseService";
import { supabase } from "./services/supabaseClient";
import { TeamBoard } from "./components/TeamBoard";
import { MetaCelebration } from "./components/MetaCelebration";
import { FloatingParticles } from "./components/FloatingParticles";
import Controller from "./components/Controller";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const [data, setData] = useState<DashboardData>({ teams: [], winningTeam: null });
  const [celebratingSeller, setCelebratingSeller] = useState<RankedSeller | null>(null);
  const [isAdmin, setIsAdmin] = useState(window.location.hash === "#/admin");
  
  const celebratedSellersRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);

  const dailyGoal = data.settings?.daily_goal || 20000;
  const weeklyGoal = data.settings?.weekly_goal || 100000;

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

    let channel: any;

    const init = async () => {
      try {
        const initialData = await fetchPlacarData();
        setData(initialData);
        isFirstLoadRef.current = false;
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      }

      // Configurar Realtime
      channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async (payload: any) => {
          const newData = await fetchPlacarData();
          
          // Lógica de Celebração
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
             const updatedSeller = payload.new;
             const currentDailyGoal = newData.settings?.daily_goal || 20000;

             if (updatedSeller.total_sales >= currentDailyGoal && !celebratedSellersRef.current.has(updatedSeller.id)) {
                const fullSeller = newData.teams.flatMap(t => t.sellers).find(s => s.id === updatedSeller.id);
                if (fullSeller) {
                   setCelebratingSeller(fullSeller);
                   celebratedSellersRef.current.add(updatedSeller.id);
                }
             }
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'placar_settings' }, async () => {
          const newData = await fetchPlacarData();
          setData(newData);
        })
        .subscribe();
    };

    init();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isAdmin]);

  if (isAdmin) {
    return <Controller />;
  }

  const isOverlayActive = data.settings?.is_overlay_active && data.settings?.overlay_url;

  return (
    <main className="relative h-[100dvh] w-screen bg-zinc-950 font-sans text-white overflow-hidden flex flex-col p-2 lg:p-6">
      
      {/* FULLSCREEN OVERLAY (METAS AVULSAS) */}
      <AnimatePresence>
        {isOverlayActive && data?.settings?.overlay_url && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"
          >
             {data.settings.overlay_url.toLowerCase().includes('.mp4') || 
              data.settings.overlay_url.toLowerCase().includes('.mov') ||
              data.settings.overlay_url.toLowerCase().includes('.webm') ? (
               <video 
                 key={data.settings.overlay_url}
                 src={data.settings.overlay_url} 
                 className="w-full h-full object-contain shadow-[0_0_50px_rgba(255,255,255,0.2)]" 
                 autoPlay 
                 loop 
                 muted 
                 playsInline 
               />
             ) : (
               <img 
                 key={data.settings.overlay_url}
                 src={data.settings.overlay_url} 
                 className="w-full h-full object-contain shadow-[0_0_50px_rgba(255,255,255,0.2)]" 
                 alt="Meta Especial" 
                 onError={(e) => {
                    e.currentTarget.style.display = 'none';
                 }}
               />
             )}
          </motion.div>
        )}
      </AnimatePresence>

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
            <TeamBoard 
              teamData={team as any} 
              isWinning={data.winningTeam === team.teamName} 
              dailyGoal={dailyGoal}
              weeklyGoal={weeklyGoal}
            />
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
