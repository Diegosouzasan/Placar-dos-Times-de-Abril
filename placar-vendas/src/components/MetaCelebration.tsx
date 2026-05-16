import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RankedSeller } from "../services/SupabaseService";

export interface Team300kCelebration {
  teamName: string;
  totalSales: number;
}

interface MetaCelebrationProps {
  seller: RankedSeller | null;
  onFinished: () => void;
  isAudioEnabled?: boolean;
  team300k?: Team300kCelebration | null;
  onTeam300kFinished?: () => void;
}

export function MetaCelebration({
  seller,
  onFinished,
  isAudioEnabled = false,
  team300k = null,
  onTeam300kFinished,
}: MetaCelebrationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modeRef = useRef<"seller" | "team300k">("seller");
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = () => {
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
  };

  const finish = () => {
    setIsPlaying(false);
    setVideoUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    clearFallback();
    if (modeRef.current === "team300k") {
      onTeam300kFinished?.();
    } else {
      onFinished();
    }
  };

  // ── Seller celebration (priority) ──
  useEffect(() => {
    if (!seller) return;
    modeRef.current = "seller";
    setIsPlaying(true);
    const firstName = seller.name.split(" ")[0];
    setVideoUrl(`/videos/${encodeURIComponent(firstName)}.mp4`);

    // Play victory audio as background – will be silenced if video has its own audio
    if (!audioRef.current) {
      audioRef.current = new Audio("/audio/victory.mp3");
    }
    audioRef.current.currentTime = 0;
    audioRef.current.volume = 1;
    audioRef.current.play().catch((e) =>
      console.warn("Erro ao tocar áudio de vitória:", e)
    );

    clearFallback();
    fallbackTimeoutRef.current = setTimeout(() => finish(), 15000);

    return () => clearFallback();
  }, [seller]);

  // ── Team 300k celebration (only when no seller is active) ──
  useEffect(() => {
    if (!team300k || seller) return;
    modeRef.current = "team300k";
    setIsPlaying(true);
    setVideoUrl("/videos/Video 300 Mil.mp4");

    clearFallback();
    fallbackTimeoutRef.current = setTimeout(() => finish(), 30000);

    return () => clearFallback();
  }, [team300k, seller]);

  // ── Reset when nothing is active ──
  useEffect(() => {
    if (!seller && !team300k) {
      setIsPlaying(false);
      setVideoUrl(null);
    }
  }, [seller, team300k]);

  // ── When the video actually starts playing, unmute it if audio is enabled ──
  const handleVideoPlaying = () => {
    clearFallback();
    if (isAudioEnabled && videoRef.current) {
      try {
        videoRef.current.muted = false;
        // Silence the victory.mp3 so only the video audio plays
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      } catch (e) {
        console.warn("Não foi possível ativar áudio do vídeo:", e);
      }
    }
  };

  if (!isPlaying) return null;

  const isSeller = modeRef.current === "seller" && seller;
  const isTeam = modeRef.current === "team300k" && team300k;

  const formattedSales = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(
    isSeller ? seller!.sales : isTeam ? team300k!.totalSales : 0
  );

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
            onEnded={finish}
            onCanPlay={(e) => {
              e.currentTarget.style.display = "block";
              e.currentTarget.play().catch(() => {});
            }}
            onPlaying={handleVideoPlaying}
            onError={(e) => {
              const video = e.currentTarget;
              const currentSrc = video.src.toLowerCase();
              if (currentSrc.endsWith(".mp4")) {
                video.src = video.src.replace(".mp4", ".mov");
                video.load();
              } else if (currentSrc.endsWith(".mov")) {
                video.src = video.src.replace(".mov", ".webm");
                video.load();
              } else {
                video.style.display = "none";
                console.warn("Nenhum vídeo encontrado.");
              }
            }}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted={true}
            autoPlay
            preload="auto"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

          {/* ── Compact Floating Card ── */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", damping: 15 }}
            className="relative z-10 bg-zinc-950/90 backdrop-blur-xl rounded-[2.5rem] px-8 py-6 mb-12 flex flex-col items-center gap-1 border border-white/10 w-[90%] max-w-lg pointer-events-none shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          >
            {/* Avatar / Icon */}
            <div className="absolute -top-12">
              {isSeller ? (
                <motion.div
                  animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                >
                  <img
                    src={seller!.photoUrl}
                    alt={seller!.name}
                    className="w-24 h-24 rounded-full border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.5)] object-cover bg-zinc-800"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src.includes('ui-avatars')) return;
                      
                      const firstName = seller!.name.split(' ')[0];
                      const localPath = `/img/${firstName}.png`;
                      
                      if (img.src !== window.location.origin + localPath) {
                        img.src = localPath;
                      } else {
                        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller!.name)}&background=3f3f46&color=fff`;
                      }
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="w-24 h-24 rounded-full border-4 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.6)] bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-4xl"
                >
                  🏆
                </motion.div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter text-center mt-10 mb-1 italic leading-tight">
              {isSeller ? (
                <>
                  META BATIDA:{" "}
                  <span className="text-yellow-400 block lg:inline">{seller!.name}</span>!
                </>
              ) : (
                <>
                  🏆 300 MIL ALCANÇADOS!
                  <br />
                  <span className="text-yellow-400">
                    {team300k?.teamName}
                  </span>
                </>
              )}
            </h1>

            {/* Sales value */}
            <div className="flex flex-col items-center gap-0">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                {isSeller ? "Valor Vendido Hoje" : "Total da Equipe"}
              </span>
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: "spring" }}
                className="text-emerald-400 font-mono text-4xl lg:text-5xl font-black tracking-tight drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
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
