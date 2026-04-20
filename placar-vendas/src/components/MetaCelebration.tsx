import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RankedSeller } from "../services/SupabaseService";

interface MetaCelebrationProps {
  seller: RankedSeller | null;
  onFinished: () => void;
}

export function MetaCelebration({ seller, onFinished }: MetaCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (seller) {
      setIsPlaying(true);
      setVideoUrl(`/videos/${encodeURIComponent(seller.name)}.mp4`);

      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = setTimeout(() => {
         console.warn(`[EMERGÊNCIA] O vídeo travou no primeiro frame e não iniciou após 15s.`);
         handleVideoEnded();
      }, 15000);

    } else {
      setIsPlaying(false);
      setVideoUrl("");
    }
    
    return () => {
       if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    }
  }, [seller]);

  const handleVideoEnded = () => {
    setIsPlaying(false);
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/90 pointer-events-auto"
        >
          <video
            ref={videoRef}
            src={videoUrl}
            onEnded={handleVideoEnded}
            onCanPlay={(e) => {
              e.currentTarget.style.display = 'block';
              e.currentTarget.play().catch(() => {});
            }}
            onPlaying={() => {
              if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
            }}
            onError={(e) => {
              const video = e.currentTarget;
              const fallbackUrl = "/videos/padrao.mp4";
              
              if (!video.src.includes(fallbackUrl)) {
                video.src = fallbackUrl;
                video.load();
              } else {
                handleVideoEnded();
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
                     if (img.src.endsWith('.jpg')) {
                       img.src = `/img/${encodeURIComponent(seller.name)}.png`;
                     } else {
                       img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
                     }
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
