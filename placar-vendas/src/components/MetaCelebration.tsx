import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RankedSeller } from "../services/SupabaseService";

interface MetaCelebrationProps {
  seller: RankedSeller | null;
  onFinished: () => void;
}

export function MetaCelebration({ seller, onFinished }: MetaCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (seller) {
      setIsPlaying(true);
      // Tentar primeiro nome para o vídeo (Albert.mp4 em vez de Albert Souza.mp4)
      const firstName = seller.name.split(' ')[0];
      const name = encodeURIComponent(firstName);
      setVideoUrl(`/videos/${name}.mp4`);

      // Iniciar áudio de vitória
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/victory.mp3');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Erro ao tocar áudio de vitória:", e));

      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      // Se não tiver vídeo nenhum após 10s, encerra a comemoração
      fallbackTimeoutRef.current = setTimeout(() => {
         console.warn(`[INFO] Encerrando comemoração após tempo limite.`);
         handleVideoEnded();
      }, 10000);

    } else {
      setIsPlaying(false);
      setVideoUrl(null);
    }
    
    return () => {
       if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    }
  }, [seller]);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setVideoUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onFinished();
  };
  
  if (!seller) return null;

  const formattedSales = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(seller.sales);

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/90 pointer-events-auto"
        >
          <video
            ref={videoRef}
            src={videoUrl ?? undefined}
            onEnded={handleVideoEnded}
            onCanPlay={(e) => {
              e.currentTarget.style.display = 'block';
              e.currentTarget.play().catch(() => {});
            }}
            onPlaying={() => {
              // Se o vídeo começar a tocar, limpamos o timeout de "emergência" e deixamos o vídeo ditar o fim
              if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
            }}
            onError={(e) => {
              const video = e.currentTarget;
              const currentSrc = video.src.toLowerCase();
              
              // Tentar extensões alternativas
              if (currentSrc.endsWith('.mp4')) {
                video.src = video.src.replace('.mp4', '.mov');
                video.load();
              } else if (currentSrc.endsWith('.mov')) {
                video.src = video.src.replace('.mov', '.webm');
                video.load();
              } else {
                // Se falhar tudo, esconde o vídeo mas mantém o card por alguns segundos
                video.style.display = 'none';
                console.warn("Nenhum vídeo encontrado para este vendedor.");
              }
            }}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted={true}
            autoPlay
            preload="auto"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

          {/* Placar do Vencedor Inferior Centralizado */}
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", damping: 15 }}
            className="relative z-10 bg-zinc-950/80 backdrop-blur-2xl rounded-t-[3rem] px-12 py-10 flex flex-col items-center gap-2 border border-white/10 w-full max-w-2xl pointer-events-none shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute -top-16">
               <motion.div
                 animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                 transition={{ repeat: Infinity, duration: 4 }}
               >
                 <img
                   src={seller.photoUrl}
                   alt={seller.name}
                   className="w-32 h-32 rounded-full border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.5)] object-cover bg-zinc-800"
                   onError={(e) => {
                     const img = e.currentTarget;
                     img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
                   }}
                 />
               </motion.div>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-black text-white uppercase tracking-tighter text-center mt-12 mb-2 italic">
              META BATIDA: <span className="text-yellow-400">{seller.name}</span>!
            </h1>
            
            <div className="flex flex-col items-center gap-1">
               <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Valor Vendido Hoje</span>
               <motion.p 
                 initial={{ scale: 0.5, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.8, type: "spring" }}
                 className="text-emerald-400 font-mono text-5xl lg:text-6xl font-black tracking-tight drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
               >
                 {formattedSales}
               </motion.p>
            </div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
