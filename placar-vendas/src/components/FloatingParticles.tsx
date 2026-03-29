import { motion } from "framer-motion";
import { useMemo } from "react";

export function FloatingParticles() {
  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2, // 2px to 6px
      left: Math.random() * 100, // 0% to 100%
      top: Math.random() * 100, // 0% to 100%
      duration: Math.random() * 20 + 10, // 10s to 30s
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      // Ciclo de visibilidade: aparece, fica visível, some, fica invisível
      // Total de 4 minutos (240 segundos)
      animate={{ opacity: [0, 1, 1, 0, 0] }}
      transition={{
        duration: 240, 
        times: [0, 0.05, 0.5, 0.55, 1], // Fade in (12s), Visível (2 min), Fade out (12s), Invisível (resto)
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-emerald-400/40 blur-[1px]"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
          }}
          animate={{
            y: [0, -200, -400],
            x: [0, Math.random() * 100 - 50, Math.random() * 100 - 50],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </motion.div>
  );
}
