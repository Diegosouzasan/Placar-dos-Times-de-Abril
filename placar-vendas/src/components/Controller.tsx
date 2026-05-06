import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  fetchPlacarData, 
  updateSellerSales, 
  toggleTeamMode, 
  addSeller, 
  deleteSeller, 
  moveSeller,
  updateSettings,
  finalizeWeeklyMeta,
  resetDailySales,
  uploadFile,
  updateTeam,
  type DashboardData,
  type TeamData
} from '../services/SupabaseService';
import { Plus, Trash2, Users, ArrowLeftRight, Save, X, Zap, Monitor, CheckCircle2, RotateCcw, Upload, Image as ImageIcon, ChevronLeft, Edit3 } from 'lucide-react';

interface ControllerProps {
  category: 'INSS' | 'CLT';
}

export default function Controller({ category }: ControllerProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSeller, setEditingSeller] = useState<number | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerPhoto, setNewSellerPhoto] = useState<File | null>(null);
  const [selectedTeamForNewSeller, setSelectedTeamForNewSeller] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomTv, setIsCustomTv] = useState(false);

  useEffect(() => {
    loadData();

    // Configurar Realtime filtrado por categoria
    const channel = supabase
      .channel(`controller-realtime-${category}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async () => {
        await loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        await loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'placar_settings' }, async () => {
        await loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [category]);

  async function loadData() {
    try {
      const dashboardData = await fetchPlacarData(category);
      if (dashboardData) {
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  function isVideo(url: string | undefined): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  function sanitizeNumber(val: string): number {
    const cleaned = val
      .replace(/R\$/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  async function handleUpdateSales(sellerId: number) {
    const numericValue = sanitizeNumber(newValue);
    if (data) {
      const updatedTeams = data.teams.map(team => ({
        ...team,
        sellers: team.sellers.map(s => 
          s.id === sellerId ? { ...s, sales: numericValue } : s
        )
      }));
      setData({ ...data, teams: updatedTeams });
    }
    await updateSellerSales(sellerId, numericValue);
    setEditingSeller(null);
    setNewValue("");
    await loadData();
  }

  async function handleToggleMode(team: TeamData) {
    const nextMode = !team.isManualMode;
    if (data) {
      const updatedTeams = data.teams.map(t => 
        t.id === team.id ? { ...t, isManualMode: nextMode } : t
      );
      setData({ ...data, teams: updatedTeams });
    }
    await toggleTeamMode(team.id, nextMode, team.manualTotal);
    await loadData();
  }

  async function handleUpdateManualTotal(teamId: number, val: string) {
    const numericValue = sanitizeNumber(val);
    if (data) {
      const updatedTeams = data.teams.map(t => 
        t.id === teamId ? { ...t, manualTotal: numericValue, totalSales: numericValue } : t
      );
      setData({ ...data, teams: updatedTeams });
    }
    await toggleTeamMode(teamId, true, numericValue);
    await loadData();
  }

  async function handleAddSeller(teamId: number) {
    if (!newSellerName) return;
    
    let photoUrl = "";
    if (newSellerPhoto) {
      setIsUploading(true);
      try {
        photoUrl = await uploadFile(newSellerPhoto, 'sellers');
      } catch (error) {
        console.error("Erro ao subir foto:", error);
        alert("Erro ao subir foto do vendedor.");
      } finally {
        setIsUploading(false);
      }
    }

    await addSeller(newSellerName, teamId, photoUrl || undefined);
    setNewSellerName("");
    setNewSellerPhoto(null);
    setSelectedTeamForNewSeller(null);
    await loadData();
  }

  async function handleDeleteSeller(sellerId: number) {
    if (confirm("Deseja realmente excluir este vendedor?")) {
      await deleteSeller(sellerId);
      await loadData();
    }
  }

  async function handleMoveSeller(sellerId: number, currentTeamId: number, otherTeamId: number) {
      if (data) {
        const sellerToMove = data.teams.flatMap(t => t.sellers).find(s => s.id === sellerId);
        if (sellerToMove) {
          const updatedTeams = data.teams.map(t => {
            if (t.id === currentTeamId) return { ...t, sellers: t.sellers.filter(s => s.id !== sellerId) };
            if (t.id === otherTeamId) return { ...t, sellers: [...t.sellers, sellerToMove] };
            return t;
          });
          setData({ ...data, teams: updatedTeams });
        }
      }
      await moveSeller(sellerId, otherTeamId);
      await loadData();
  }

  // --- SETTINGS HANDLERS ---
  async function handleUpdateGlobalGoal(type: 'daily' | 'weekly', val: string) {
    const numericValue = sanitizeNumber(val);
    try {
      await updateSettings(category, type === 'daily' ? { daily_goal: numericValue } : { weekly_goal: numericValue });
      await loadData();
    } catch (error) {
      console.error("Erro ao atualizar meta global:", error);
    }
  }

  async function handleUpdateTeamDetails(teamId: number, data: { name?: string, leader_name?: string, leader_photo?: string }) {
    await updateTeam(teamId, data);
    await loadData();
  }

  async function handleFileUploadTeam(teamId: number, file: File, field: 'leader_photo') {
    setIsUploading(true);
    try {
      const url = await uploadFile(file, 'teams');
      await handleUpdateTeamDetails(teamId, { [field]: url });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleToggleMetaStatus() {
    if (!data?.settings) return;
    const nextStatus = !data.settings.is_meta_active;
    await updateSettings(category, { is_meta_active: nextStatus });
  }

  async function handleFinalizeMeta() {
    if (confirm("ATENÇÃO: Ao finalizar a meta, todos os valores de vendas (diários e semanais) serão ZERADOS. Deseja continuar?")) {
      await finalizeWeeklyMeta(category);
      await loadData();
    }
  }

  async function handleResetDaily() {
    if (confirm("Deseja realmente ZERAR apenas as vendas diárias? Os valores semanais serão mantidos.")) {
      await resetDailySales(category);
      await loadData();
    }
  }

  async function handleToggleDay(day: string) {
    if (!data?.settings) return;
    const currentDays = (data.settings.meta_days || "").split(',').filter(Boolean);
    let newDays;
    if (currentDays.includes(day)) {
      newDays = currentDays.filter(d => d !== day);
    } else {
      newDays = [...currentDays, day];
    }
    await updateSettings(category, { meta_days: newDays.join(',') });
  }

  let overlayData = { media: [] as string[], index: 0, targetTv: "Todas", registeredTvs: [] as string[] };
  try {
    if (data?.settings?.overlay_url?.startsWith('{')) {
       overlayData = { ...overlayData, ...JSON.parse(data.settings.overlay_url) };
    } else if (data?.settings?.overlay_url) {
       overlayData.media = [data.settings.overlay_url];
    }
  } catch(e) {}

  async function saveOverlay(newData: Partial<typeof overlayData>) {
    const updated = { ...overlayData, ...newData };
    try {
      await updateSettings(category, { overlay_url: JSON.stringify(updated) });
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar overlay:", error);
    }
  }

  async function handleFileUploadOverlay(file: File) {
    setIsUploading(true);
    try {
      const url = await uploadFile(file, 'overlays');
      await saveOverlay({ media: [...overlayData.media, url] });
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao carregar arquivo. Verifique se o bucket 'media' existe e é público.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleToggleOverlay() {
    if (!data?.settings) return;
    try {
       await updateSettings(category, { is_overlay_active: !data.settings.is_overlay_active });
       await loadData();
    } catch (error) {
       console.error("Erro ao alternar overlay:", error);
    }
  }

  function handleRemoveMedia(idx: number) {
     const newMedia = [...overlayData.media];
     newMedia.splice(idx, 1);
     let newIndex = overlayData.index;
     if (newIndex >= newMedia.length) newIndex = Math.max(0, newMedia.length - 1);
     saveOverlay({ media: newMedia, index: newIndex });
  }

  function handleClearMedia() {
     saveOverlay({ media: [], index: 0 });
     if (data?.settings?.is_overlay_active) {
        updateSettings(category, { is_overlay_active: false });
     }
  }
  
  useEffect(() => {
    if (!data?.settings?.is_overlay_active || overlayData.media.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Impede múltiplas chamadas rápidas ou comportamento em inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowRight') {
         const nextIdx = (overlayData.index + 1) % overlayData.media.length;
         saveOverlay({ index: nextIdx });
      } else if (e.key === 'ArrowLeft') {
         const prevIdx = (overlayData.index - 1 + overlayData.media.length) % overlayData.media.length;
         saveOverlay({ index: prevIdx });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data?.settings?.is_overlay_active, overlayData.media, overlayData.index]);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white bg-[#0a0a0a]">Carregando Controle...</div>;
  if (!data) return <div className="flex items-center justify-center min-h-screen text-white bg-[#0a0a0a]">Erro ao carregar dados. Tente atualizar a página.</div>;

  const ALL_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-10 relative">
        <button 
          onClick={() => window.location.hash = `#/${category.toLowerCase()}`}
          className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar ao Placar
        </button>
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent mb-2">
            Controle {category}
          </h1>
          <p className="text-gray-400">Gerenciamento de Vendas e Equipes - {category}</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* SEÇÃO DE METAS GLOBAIS E OVERLAY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* GESTÃO DE METAS */}
           <div className="lg:col-span-2 bg-[#151515] rounded-3xl p-6 border border-white/5 relative bg-gradient-to-br from-[#151515] to-[#1a1a1a]">
              <div className="flex items-center gap-2 mb-6">
                 <Zap className="w-5 h-5 text-yellow-400" />
                 <h2 className="text-xl font-bold uppercase tracking-tight">Gestor de Metas</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Meta Diária (Individual)</label>
                    <input 
                      type="text" 
                      defaultValue={data?.settings?.daily_goal}
                      placeholder="Ex: 20.000,00"
                      onBlur={(e) => handleUpdateGlobalGoal('daily', e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-2xl font-black text-yellow-400 focus:border-yellow-400/50 transition-all outline-none"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Meta Semanal (Individual)</label>
                    <input 
                      type="text" 
                      defaultValue={data?.settings?.weekly_goal}
                      placeholder="Ex: 100.000,00"
                      onBlur={(e) => handleUpdateGlobalGoal('weekly', e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-2xl font-black text-blue-400 focus:border-blue-400/50 transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="mb-8">
                 <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1 mb-4 block">Dias da Meta Semanal</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DAYS.map(day => {
                      const isActive = data?.settings?.meta_days?.split(',').includes(day);
                      return (
                        <button 
                          key={day}
                          onClick={() => handleToggleDay(day)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={handleToggleMetaStatus}
                   className={`flex-1 flex items-center justify-center gap-2 p-5 rounded-2xl font-black uppercase tracking-widest transition-all ${data?.settings?.is_meta_active ? 'bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}
                 >
                    {data?.settings?.is_meta_active ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    {data?.settings?.is_meta_active ? 'Parar Meta' : 'Iniciar Meta'}
                 </button>
                  <button 
                    onClick={handleResetDaily}
                    className="flex-1 flex items-center justify-center gap-2 p-5 rounded-2xl bg-zinc-800 text-zinc-300 border border-white/10 font-black uppercase tracking-widest transition-all hover:bg-zinc-700"
                  >
                     <RotateCcw className="w-5 h-5" />
                     Zerar Diário
                  </button>
                  <button 
                    onClick={handleFinalizeMeta}
                    className="flex-1 flex items-center justify-center gap-2 p-5 rounded-2xl bg-red-600 font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                  >
                     <CheckCircle2 className="w-5 h-5" />
                     Encerrar Meta
                  </button>
              </div>
           </div>

           {/* METAS AVULSAS (OVERLAY) */}
           <div className="bg-[#151515] rounded-3xl p-6 border border-white/5 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                 <Monitor className="w-5 h-5 text-blue-400" />
                 <h2 className="text-xl font-bold uppercase tracking-tight">Metas Avulsas (Slides)</h2>
              </div>
              
              <div className="flex-1 space-y-4">
                 <div className="space-y-4">
                    <div 
                      className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3 group overflow-hidden ${isUploading ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5'}`}
                    >
                       <input 
                         type="file" 
                         accept="image/*,video/*"
                         onChange={(e) => e.target.files?.[0] && handleFileUploadOverlay(e.target.files[0])}
                         className="absolute inset-0 opacity-0 cursor-pointer z-10"
                       />
                       
                       {isUploading ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                       ) : (
                          <>
                             <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-blue-500/10 transition-colors">
                                <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-400" />
                             </div>
                             <div className="text-center">
                                <p className="text-sm font-bold">Adicionar Mídia (Slide)</p>
                                <p className="text-[10px] text-gray-500">Imagem ou Vídeo (Upload Local)</p>
                             </div>
                          </>
                       )}
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">Selecionar TV Alvo</label>
                       
                       {!isCustomTv ? (
                         <select
                           value={overlayData.registeredTvs?.includes(overlayData.targetTv) || data?.teams.some(t => t.teamName === overlayData.targetTv) || overlayData.targetTv === "Todas" || overlayData.targetTv === "Todas as TVs" ? (overlayData.targetTv === "Todas" ? "Todas as TVs" : overlayData.targetTv) : (overlayData.targetTv ? "___CUSTOM___" : "Todas as TVs")}
                           onChange={(e) => {
                             if (e.target.value === "___CUSTOM___") {
                               setIsCustomTv(true);
                             } else {
                               saveOverlay({ targetTv: e.target.value });
                             }
                           }}
                           className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none"
                         >
                           <option value="Todas as TVs">Todas as TVs</option>
                           <optgroup label="Times (Líderes)">
                             {data?.teams.map(t => (
                               <option key={`team-${t.id}`} value={t.teamName}>{t.teamName}</option>
                             ))}
                           </optgroup>
                           {overlayData.registeredTvs && overlayData.registeredTvs.length > 0 && (
                             <optgroup label="TVs/Grupos Cadastrados">
                               {overlayData.registeredTvs.map((tv, i) => (
                                 <option key={`reg-${i}`} value={tv}>{tv}</option>
                               ))}
                             </optgroup>
                           )}
                           <option value="___CUSTOM___">+ Digitar outro nome...</option>
                         </select>
                       ) : (
                         <div className="flex gap-2">
                           <input
                             type="text"
                             value={overlayData.targetTv === "Todas" ? "" : overlayData.targetTv}
                             onChange={(e) => saveOverlay({ targetTv: e.target.value })}
                             placeholder="Digite o nome exato da TV..."
                             className="flex-1 bg-black/40 border border-blue-500/50 rounded-xl p-3 text-sm focus:border-blue-400 outline-none"
                             autoFocus
                           />
                           <button 
                             onClick={() => {
                               setIsCustomTv(false);
                               if (!overlayData.targetTv) saveOverlay({ targetTv: "Todas as TVs" });
                             }}
                             className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                             title="Voltar para lista"
                           >
                             <X className="w-5 h-5 text-gray-400" />
                           </button>
                         </div>
                       )}
                       <p className="text-[10px] text-gray-500 pl-1 mt-1">A apresentação só aparecerá em TVs configuradas com este exato nome.</p>
                    </div>
                 </div>

                 {overlayData.media.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-1">
                        Ordem dos Slides ({overlayData.index + 1} de {overlayData.media.length})
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                         {overlayData.media.map((url, idx) => (
                           <div 
                             key={idx} 
                             onClick={() => saveOverlay({ index: idx })}
                             className={`relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group ${idx === overlayData.index ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10' : 'border-white/10 hover:border-white/30'}`}
                           >
                             {isVideo(url) ? (
                               <video src={url} className="w-full h-full object-cover" />
                             ) : (
                               <img src={url} className="w-full h-full object-cover" />
                             )}
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleRemoveMedia(idx); }}
                               className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               <X className="w-3 h-3 text-white" />
                             </button>
                             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                               <span className="text-[10px] font-bold text-white uppercase">Slide {idx + 1}</span>
                             </div>
                           </div>
                         ))}
                      </div>
                      <p className="text-[10px] text-yellow-500/80 font-bold pl-1 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Use as setas ⬅️ ➡️ do teclado para passar os slides
                      </p>
                    </div>
                 )}

                 <div className="flex flex-col gap-2">
                   {overlayData.media.length > 0 && (
                     <button 
                       onClick={handleToggleOverlay}
                       className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg ${
                         data?.settings?.is_overlay_active 
                           ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40' 
                           : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
                       }`}
                     >
                        {data?.settings?.is_overlay_active ? (
                          <>
                            <X className="w-5 h-5 text-white" />
                            Terminar Apresentação
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 text-white" />
                            Apresentar ({overlayData.targetTv})
                          </>
                        )}
                     </button>
                   )}
                   {overlayData.media.length > 0 && (
                     <button 
                       onClick={handleClearMedia}
                       className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-zinc-800 text-red-400 hover:bg-red-950/50 hover:text-red-300 font-bold text-sm uppercase transition-all border border-red-500/10"
                     >
                       <Trash2 className="w-4 h-4" />
                       Limpar Metas Avulsas
                     </button>
                   )}
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {data?.teams.map((team) => {
            const otherTeam = data.teams.find(t => t.id !== team.id);
            
            return (
              <div key={team.id} className="bg-[#151515] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
                {/* Header do Time */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="relative group/photo">
                      <img 
                        src={team.leader.photoUrl} 
                        alt={team.leader.name} 
                        className="w-16 h-16 rounded-2xl border-2 border-emerald-500/50 object-cover group-hover/photo:opacity-50 transition-opacity" 
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src.includes('avatar')) return;
                          img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(team.leader.name)}&background=10b981&color=fff`;
                        }}
                      />
                      <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 cursor-pointer transition-opacity">
                        <Upload className="w-5 h-5 text-white" />
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUploadTeam(team.id, e.target.files[0], 'leader_photo')}
                        />
                      </label>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 group/title">
                        <h2 className="text-2xl font-black italic">{team.teamName}</h2>
                        <button className="opacity-0 group-hover/title:opacity-100 p-1 hover:text-emerald-400 transition-all">
                          <Edit3 className="w-4 h-4" onClick={() => {
                            const newName = prompt("Novo nome da equipe:", team.teamName);
                            if (newName) handleUpdateTeamDetails(team.id, { name: newName });
                          }} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 group/leader">
                        <p className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Líder: {team.leader.name}</p>
                        <button className="opacity-0 group-hover/leader:opacity-100 p-1 hover:text-white transition-all">
                          <Edit3 className="w-3 h-3" onClick={() => {
                            const newLeader = prompt("Novo nome do líder:", team.leader.name);
                            if (newLeader) handleUpdateTeamDetails(team.id, { leader_name: newLeader });
                          }} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                     <span className="text-[10px] text-gray-500 font-bold uppercase">Modo Geral</span>
                     <button onClick={() => handleToggleMode(team)} className={`w-12 h-6 rounded-full p-1 transition-colors ${team.isManualMode ? 'bg-blue-600' : 'bg-gray-700'}`} >
                       <div className={`w-4 h-4 bg-white rounded-full transition-transform ${team.isManualMode ? 'translate-x-6' : ''}`} />
                     </button>
                  </div>
                </div>

                {team.isManualMode && (
                  <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
                     <label className="text-xs text-blue-400 font-bold uppercase mb-2 block">Valor Total da Equipe (Geral)</label>
                     <input type="text" defaultValue={team.manualTotal > 0 ? team.manualTotal : ""} onBlur={(e) => handleUpdateManualTotal(team.id, e.target.value)} className="w-full bg-black/40 border border-blue-500/30 rounded-xl p-3 text-2xl font-bold focus:outline-none focus:border-blue-500 text-blue-300 transition-all" />
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3 h-3" /> Vendedores
                  </h3>
                  
                  {team.sellers.map((seller) => (
                    <div key={seller.id} className="group bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={seller.photoUrl} 
                          alt={seller.name} 
                          className="w-10 h-10 rounded-xl object-cover" 
                          onError={(e) => {
                            const img = e.currentTarget;
                            // Tentar /img/ dinâmico se a URL primária falhar
                            if (img.src.includes('http') && !img.src.includes('ui-avatars')) {
                              img.src = `/img/${encodeURIComponent(seller.name.split(' ')[0])}.png`;
                            } else if (img.src.endsWith('.png')) {
                              img.src = img.src.replace('.png', '.jpg');
                            } else {
                              img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
                            }
                          }} 
                        />
                        <div>
                          <p className="font-bold text-sm">{seller.name}</p>
                          <div className="flex gap-2 text-[10px] font-mono leading-none mt-1">
                             <span className="text-emerald-500">D: R$ {seller.sales.toLocaleString('pt-BR')}</span>
                             <span className="text-blue-400">S: R$ {(seller.weeklySales || 0).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                         {editingSeller === seller.id ? (
                            <div className="flex items-center gap-1">
                               <input autoFocus type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateSales(seller.id); }} className="bg-blue-900/40 border border-blue-500/50 rounded-lg p-2 w-28 text-sm outline-none" />
                               <button onClick={() => handleUpdateSales(seller.id)} className="p-2 bg-green-600 rounded-lg hover:bg-green-500"><Save className="w-4 h-4" /></button>
                               <button onClick={() => setEditingSeller(null)} className="p-2 bg-red-600 rounded-lg hover:bg-red-500"><X className="w-4 h-4" /></button>
                            </div>
                         ) : (
                           <>
                              <button onClick={() => { setEditingSeller(seller.id); setNewValue(seller.sales > 0 ? seller.sales.toString() : ""); }} className="p-2 hover:bg-white/5 rounded-xl text-blue-400 transition-opacity" ><Plus className="w-4 h-4" /></button>
                              <button onClick={() => otherTeam && handleMoveSeller(seller.id, team.id, otherTeam.id)} className="p-2 hover:bg-white/5 rounded-xl text-yellow-400 transition-opacity" ><ArrowLeftRight className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteSeller(seller.id)} className="p-2 hover:bg-white/5 rounded-xl text-red-500 transition-opacity" ><Trash2 className="w-4 h-4" /></button>
                           </>
                         )}
                      </div>
                    </div>
                  ))}

                  <button onClick={() => setSelectedTeamForNewSeller(team.id)} className="w-full border border-dashed border-white/10 p-4 rounded-2xl hover:bg-white/5 hover:border-white/20 transition-all text-sm text-gray-400 font-medium flex items-center justify-center gap-2" >
                    <Plus className="w-4 h-4" /> Adicionar Vendedor
                  </button>

                  {selectedTeamForNewSeller === team.id && (
                    <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4 mt-4 space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] text-blue-400 font-bold uppercase tracking-widest pl-1">Nome Completo</label>
                          <input autoFocus type="text" placeholder="Nome do Vendedor" value={newSellerName} onChange={(e) => setNewSellerName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none" />
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] text-blue-400 font-bold uppercase tracking-widest pl-1">Foto do Vendedor</label>
                          <div className="relative border border-white/10 rounded-xl p-3 bg-black/40 flex items-center gap-3">
                             <input 
                               type="file" 
                               accept="image/*"
                               onChange={(e) => setNewSellerPhoto(e.target.files?.[0] || null)}
                               className="absolute inset-0 opacity-0 cursor-pointer"
                             />
                             <div className="p-2 bg-white/5 rounded-lg">
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                             </div>
                             <span className="text-xs text-gray-500 truncate">
                                {newSellerPhoto ? newSellerPhoto.name : "Selecionar imagem..."}
                             </span>
                          </div>
                       </div>

                       <div className="flex gap-2 pt-2">
                          <button 
                            disabled={isUploading}
                            onClick={() => handleAddSeller(team.id)} 
                            className="flex-1 bg-blue-600 hover:bg-blue-500 p-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                          >
                             {isUploading ? 'Enviando...' : 'Criar Vendedor'}
                          </button>
                          <button onClick={() => { setSelectedTeamForNewSeller(null); setNewSellerPhoto(null); }} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
