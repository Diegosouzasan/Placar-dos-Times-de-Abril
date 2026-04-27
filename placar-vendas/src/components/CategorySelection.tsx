import { motion } from "framer-motion";

interface CategorySelectionProps {
  onSelect: (category: 'INSS' | 'CLT') => void;
}

export function CategorySelection({ onSelect }: CategorySelectionProps) {
  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 z-10"
      >
        <h1 className="text-5xl lg:text-7xl font-black tracking-tighter uppercase mb-4 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
          Placar de Vendas
        </h1>
        <p className="text-zinc-400 text-lg lg:text-xl font-medium tracking-wide">
          Selecione o departamento para visualizar o placar
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl z-10">
        {/* INSS Card */}
        <motion.button
          whileHover={{ scale: 1.05, y: -10 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect('INSS')}
          className="group relative h-80 rounded-[2.5rem] overflow-hidden border border-white/10 glass-panel flex flex-col items-center justify-center transition-all duration-500 hover:border-emerald-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-40 h-40 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500 group-hover:border-emerald-500/50">
              <span className="text-4xl font-black text-emerald-400 tracking-tighter">INSS</span>
            </div>
            <p className="text-zinc-400 font-medium group-hover:text-emerald-400 transition-colors">Visualizar Dashboard INSS</p>
          </div>
          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
            <span className="text-3xl text-emerald-400">→</span>
          </div>
        </motion.button>

        {/* CLT Card */}
        <motion.button
          whileHover={{ scale: 1.05, y: -10 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect('CLT')}
          className="group relative h-80 rounded-[2.5rem] overflow-hidden border border-white/10 glass-panel flex flex-col items-center justify-center transition-all duration-500 hover:border-teal-500/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-40 h-40 rounded-3xl bg-teal-500/10 flex items-center justify-center mb-6 border border-teal-500/20 group-hover:scale-110 transition-transform duration-500 group-hover:border-teal-500/50">
              <span className="text-4xl font-black text-teal-400 tracking-tighter">CLT</span>
            </div>
            <p className="text-zinc-400 font-medium group-hover:text-teal-400 transition-colors">Visualizar Dashboard CLT</p>
          </div>
          <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
            <span className="text-3xl text-teal-400">→</span>
          </div>
        </motion.button>
      </div>

      {/* Footer Logo */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-30">
        <img src="/img/Logo Nosso Consignado.png" alt="Nosso Consignado" className="h-6 grayscale brightness-200" />
      </div>
    </div>
  );
}
