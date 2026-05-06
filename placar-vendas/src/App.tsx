import { useEffect, useState, useRef } from "react";
import { fetchPlacarData, updateSettings, type DashboardData, type RankedSeller } from "./services/SupabaseService";
import { supabase } from "./services/supabaseClient";
import { TeamBoard } from "./components/TeamBoard";
import { MetaCelebration } from "./components/MetaCelebration";
import { FloatingParticles } from "./components/FloatingParticles";
import Controller from "./components/Controller";
import { CategorySelection } from "./components/CategorySelection";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const [category, setCategory] = useState<'INSS' | 'CLT' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<DashboardData>({ teams: [], winningTeam: null });
  const [celebratingSeller, setCelebratingSeller] = useState<RankedSeller | null>(null);
  const [tvName, setTvName] = useState(() => localStorage.getItem('tvName') || "");
  const [tempTvName, setTempTvName] = useState("");
  
  const celebratedSellersRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Parse hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/inss")) {
        setCategory('INSS');
        setIsAdmin(hash.includes("/admin"));
      } else if (hash.startsWith("#/clt")) {
        setCategory('CLT');
        setIsAdmin(hash.includes("/admin"));
      } else {
        setCategory(null);
        setIsAdmin(false);
      }
    };
    
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Busca inicial e Realtime
  useEffect(() => {
    if (!category || isAdmin) return;

    let channel: any;

    const init = async () => {
      try {
        const initialData = await fetchPlacarData(category);
        setData(initialData);
        isFirstLoadRef.current = false;
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      }

      // Configurar Realtime
      channel = supabase
        .channel(`dashboard-realtime-${category}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async (payload: any) => {
          const newData = await fetchPlacarData(category);
          
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
          const newData = await fetchPlacarData(category);
          setData(newData);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'placar_settings' }, async () => {
          const newData = await fetchPlacarData(category);
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
  }, [category, isAdmin]);

  if (!category) {
    return <CategorySelection onSelect={(cat) => window.location.hash = `#/${cat.toLowerCase()}`} />;
  }

  let overlayData = { media: [] as string[], index: 0, targetTv: "Todas", registeredTvs: [] as string[] };
  try {
    if (data.settings?.overlay_url?.startsWith('{')) {
       overlayData = { ...overlayData, ...JSON.parse(data.settings?.overlay_url) };
    } else if (data.settings?.overlay_url) {
       overlayData.media = [data.settings.overlay_url];
    }
  } catch(e) {
     console.error("Erro ao parsear overlay_url", e);
  }

  const handleRegisterTv = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    localStorage.setItem('tvName', trimmed);
    setTvName(trimmed);

    // Adiciona no BD se não existir
    if (!overlayData.registeredTvs) overlayData.registeredTvs = [];
    if (!overlayData.registeredTvs.includes(trimmed)) {
       const newRegistered = [...overlayData.registeredTvs, trimmed];
       const newOverlay = { ...overlayData, registeredTvs: newRegistered };
       try {
         await updateSettings(category as string, { overlay_url: JSON.stringify(newOverlay) });
       } catch (err) { console.error(err); }
    }
  };

  if (!isAdmin && !tvName) {
    const existingTvs = Array.from(new Set([
      ...(overlayData.registeredTvs || []), 
      ...(data?.teams.map(t => t.teamName) || [])
    ])).filter(Boolean);

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 space-y-8 shadow-2xl relative z-10"
        >
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-widest text-emerald-400 drop-shadow-sm">Identificação da TV</h1>
            <p className="text-zinc-400 text-sm">Cadastre esta tela ou escolha um grupo existente para receber alertas.</p>
          </div>
          
          <div className="space-y-6">
            {existingTvs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 opacity-60">
                  <div className="h-px bg-zinc-700 flex-1" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-widest">Opções Existentes</span>
                  <div className="h-px bg-zinc-700 flex-1" />
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {existingTvs.map((tv, i) => (
                    <button
                      key={i}
                      onClick={() => setTempTvName(tv)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-300 ${
                        tempTvName === tv 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 scale-105 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                          : 'bg-black/40 border-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/80'
                      }`}
                    >
                      {tv}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3 opacity-60">
                <div className="h-px bg-zinc-700 flex-1" />
                <span className="text-[10px] text-white font-bold uppercase tracking-widest">Ou Digite o Nome</span>
                <div className="h-px bg-zinc-700 flex-1" />
              </div>
              <input 
                type="text" 
                placeholder="Ex: Recepção, Equipe X..." 
                value={tempTvName}
                onChange={(e) => setTempTvName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempTvName.trim()) {
                    handleRegisterTv(tempTvName);
                  }
                }}
                className="w-full bg-black/60 border border-zinc-800 rounded-2xl p-4 text-center text-xl font-bold text-white placeholder-zinc-700 focus:border-emerald-500 focus:bg-black outline-none transition-all focus:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              />
            </div>
          </div>

          <button 
            onClick={() => handleRegisterTv(tempTvName)}
            disabled={!tempTvName.trim()}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-emerald-900/50 active:scale-95"
          >
            Confirmar e Entrar
          </button>
        </motion.div>
      </div>
    );
  }

  if (isAdmin) {
    return <Controller key={category} category={category} />;
  }

  const dailyGoal = data.settings?.daily_goal || 20000;
  const weeklyGoal = data.settings?.weekly_goal || 100000;


  const targetTv = overlayData.targetTv || "Todas";
  const isTargetAll = targetTv === "Todas" || targetTv === "Todas as TVs" || targetTv === "";
  const isOverlayActive = data.settings?.is_overlay_active && 
                          overlayData.media.length > 0 && 
                          (isTargetAll || targetTv === tvName);
  
  const currentMediaUrl = overlayData.media[overlayData.index] || "";

  return (
    <main className="relative h-[100dvh] w-screen bg-zinc-950 font-sans text-white overflow-hidden flex flex-col p-2 lg:p-6">
      
      {/* FULLSCREEN OVERLAY (METAS AVULSAS / SLIDES) */}
      <AnimatePresence>
        {isOverlayActive && currentMediaUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"
          >
             {currentMediaUrl.toLowerCase().includes('.mp4') || 
              currentMediaUrl.toLowerCase().includes('.mov') ||
              currentMediaUrl.toLowerCase().includes('.webm') ? (
               <video 
                 key={currentMediaUrl}
                 src={currentMediaUrl} 
                 className="w-full h-full object-contain shadow-[0_0_50px_rgba(255,255,255,0.2)]" 
                 autoPlay 
                 loop 
                 muted 
                 playsInline 
               />
             ) : (
               <img 
                 key={currentMediaUrl}
                 src={currentMediaUrl} 
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
        className={`absolute top-[10%] left-[20%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full blur-[120px] pointer-events-none ${
          category === 'INSS' ? 'bg-emerald-500/20' : 'bg-teal-500/20'
        }`}
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
      <div className="relative z-10 flex-shrink-0 flex items-center justify-between mb-4 lg:mb-6 pt-2 px-4 lg:px-10">
        <button 
          onClick={() => window.location.hash = ""}
          className="text-zinc-500 hover:text-white transition-colors flex items-center gap-2 font-bold uppercase tracking-widest text-xs"
        >
          ← Voltar
        </button>
        
        <h1 className="text-[clamp(1.5rem,5vh,3.5rem)] tracking-tighter uppercase font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 drop-shadow-sm leading-none">
          Placar {category}
        </h1>

        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* DASHBOARD GRID */}
      <div className={`relative z-10 flex-1 w-full mx-auto grid gap-4 lg:gap-8 min-h-0 pb-4 ${
        data.teams.length === 1 ? 'grid-cols-1 max-w-7xl' : 'grid-cols-1 lg:grid-cols-2'
      }`}>
        {data.teams.map((team) => (
          <div key={team.id} className="relative min-h-0 flex flex-col rounded-[2.5rem] overflow-hidden glass-panel">
            <TeamBoard 
              teamData={team as any} 
              isWinning={data.winningTeam === team.teamName && data.teams.length > 1} 
              dailyGoal={dailyGoal}
              weeklyGoal={weeklyGoal}
              isSingleTeam={data.teams.length === 1}
            />
          </div>
        ))}
        {data.teams.length === 0 && (
          <div className="col-span-full text-center text-zinc-500 font-mono text-xl mt-20 animate-pulse">
            Sincronizando dados {category}...
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

      {/* BOTAO PARA REDEFINIR NOME DA TV */}
      <button 
        onClick={() => { localStorage.removeItem('tvName'); setTvName(""); setTempTvName(""); }}
        className="absolute bottom-4 left-4 z-30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white bg-black/50 hover:bg-black/80 border border-white/5 hover:border-white/20 rounded-full transition-all flex items-center gap-2"
        title="Redefinir Nome da TV"
      >
        <span>TV: {tvName}</span>
        <span>✏️</span>
      </button>

      {/* BOTAO PARA ADMIN */}
      <a 
        href={`#/${category.toLowerCase()}/admin`} 
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
