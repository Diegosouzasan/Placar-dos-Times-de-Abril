import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RankedSeller } from "../services/GoogleSheetsService";

interface MetaCelebrationProps {
  seller: RankedSeller | null;
  onFinished: () => void;
}

export function MetaCelebration({ seller, onFinished }: MetaCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Iniciar a comemoração
  useEffect(() => {
    if (seller) {
      setIsPlaying(true);
      setVideoUrl(`/videos/${encodeURIComponent(seller.name)}.mp4`);

      // BOMBA-RELÓGIO DE EMERGÊNCIA (15 Segundos).
      // Se um vídeo estiver com Formato Quebrado/Codec de iPhone (HEVC) e o Google Chrome congelar
      // sem conseguir dar o Play, nós ativamos esse pino de segurança em 15 segundos para destravar a tela.
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = setTimeout(() => {
         console.warn(`[EMERGÊNCIA] O vídeo travou no primeiro frame e não iniciou após 15s. Abortando comemoração para destravar o Placar.`);
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
          {/* Video em Tela Cheia Dinâmico (Silencioso para Burlar Navegadores e Tocar Sozinho) */}
          <video
            ref={videoRef}
            src={videoUrl}
            onEnded={handleVideoEnded}
            onCanPlay={(e) => {
              e.currentTarget.style.display = 'block';
              e.currentTarget.play().catch(err => {
                 console.log("Autoplay mitigado com som");
              });
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
          
          {/* Overlay Escuro com Refração */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

          {/* Placar do Vencedor Inferior Centralizado */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring", damping: 15 }}
            className="relative z-10 glass-panel rounded-t-3xl rounded-b-none px-12 py-8 mb-0 flex flex-col items-center gap-2 border-b-0 w-full max-w-3xl pointer-events-none"
          >
            <div className="absolute -top-12">
               <img
                 src={seller.photoUrl}
                 alt={seller.name}
                 className="w-24 h-24 rounded-full border-4 border-emerald-500 shadow-xl object-cover bg-zinc-800"
                 onError={(e) => {
                   const img = e.currentTarget;
                   if (img.src.endsWith('.jpg')) {
                     img.src = `/img/${encodeURIComponent(seller.name)}.png`;
                   } else {
                     img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
                   }
                 }}
               />
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tighter text-center mt-6">
              META BATIDA: {seller.name}!
            </h1>
            <p className="text-emerald-400 font-mono text-3xl font-bold tracking-tight">
              {formattedSales}
            </p>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
}
