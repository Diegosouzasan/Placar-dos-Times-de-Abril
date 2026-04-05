import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  fetchPlacarData, 
  updateSellerSales, 
  toggleTeamMode, 
  addSeller, 
  deleteSeller, 
  moveSeller,
  type DashboardData,
  type TeamData,
  type RankedSeller
} from '../services/SupabaseService';
import { Plus, Trash2, Users, ArrowLeftRight, Save, X } from 'lucide-react';

export default function Controller() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSeller, setEditingSeller] = useState<number | null>(null);
  const [newValue, setNewValue] = useState("");
  const [newSellerName, setNewSellerName] = useState("");
  const [selectedTeamForNewSeller, setSelectedTeamForNewSeller] = useState<number | null>(null);

  useEffect(() => {
    loadData();

    // Configurar Realtime
    const channel = supabase
      .channel('controller-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, async () => {
        console.log("Mudança detectada em sellers, atualizando...");
        await loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, async () => {
        console.log("Mudança detectada em teams, atualizando...");
        await loadData();
      })
      .subscribe((status) => {
        console.log("Status da inscrição no Controller:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    try {
      const dashboardData = await fetchPlacarData();
      setData(dashboardData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function sanitizeNumber(val: string): number {
    // Remove R$, espaços, pontos de milhar, e transforma vírgula em ponto
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
    
    // Atualização otimista imediata
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
    await loadData(); // Garante sincronia final
  }

  async function handleToggleMode(team: TeamData) {
    const nextMode = !team.isManualMode;
    
    // Atualização otimista
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
    
    // Atualização otimista
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
    await addSeller(newSellerName, teamId);
    setNewSellerName("");
    setSelectedTeamForNewSeller(null);
    await loadData(); // Atualização manual imediata
  }

  async function handleDeleteSeller(sellerId: number) {
    if (confirm("Deseja realmente excluir este vendedor?")) {
      await deleteSeller(sellerId);
      await loadData(); // Atualização manual imediata
    }
  }

  async function handleMoveSeller(sellerId: number, currentTeamId: number, otherTeamId: number) {
      // Atualização otimista
      if (data) {
        const sellerToMove = data.teams.flatMap(t => t.sellers).find(s => s.id === sellerId);
        if (sellerToMove) {
          const updatedTeams = data.teams.map(t => {
            if (t.id === currentTeamId) {
              return { ...t, sellers: t.sellers.filter(s => s.id !== sellerId) };
            }
            if (t.id === otherTeamId) {
              return { ...t, sellers: [...t.sellers, sellerToMove] };
            }
            return t;
          });
          setData({ ...data, teams: updatedTeams });
        }
      }

      await moveSeller(sellerId, otherTeamId);
      await loadData();
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white">Carregando Controle...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
          Controller Placar
        </h1>
        <p className="text-gray-400">Gerenciamento de Vendas e Equipes em Tempo Real</p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {data?.teams.map((team) => {
          const otherTeam = data.teams.find(t => t.id !== team.id);
          
          return (
            <div key={team.id} className="bg-[#151515] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
              {/* Header do Time */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <img 
                    src={team.leader.photoUrl} 
                    alt={team.leader.name} 
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(team.leader.name)}&background=3b82f6&color=fff`;
                    }}
                    className="w-16 h-16 rounded-2xl border-2 border-blue-500/50 object-cover" 
                  />
                  <div>
                    <h2 className="text-2xl font-black italic">{team.teamName}</h2>
                    <p className="text-blue-400 text-sm font-bold uppercase tracking-wider">Líder: {team.leader.name}</p>
                  </div>
                </div>
                
                {/* Toggle Modo Geral */}
                <div className="flex flex-col items-end gap-2">
                   <span className="text-[10px] text-gray-500 font-bold uppercase">Modo Geral</span>
                   <button 
                    onClick={() => handleToggleMode(team)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${team.isManualMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                   >
                     <div className={`w-4 h-4 bg-white rounded-full transition-transform ${team.isManualMode ? 'translate-x-6' : ''}`} />
                   </button>
                </div>
              </div>

              {/* Input Valor Geral */}
              {team.isManualMode && (
                <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
                   <label className="text-xs text-blue-400 font-bold uppercase mb-2 block">Valor Total da Equipe (Modo Geral)</label>
                   <input 
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 50.000,00"
                    defaultValue={team.manualTotal > 0 ? team.manualTotal : ""}
                    onBlur={(e) => handleUpdateManualTotal(team.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateManualTotal(team.id, (e.target as HTMLInputElement).value); }}
                    className="w-full bg-black/40 border border-blue-500/30 rounded-xl p-3 text-2xl font-bold focus:outline-none focus:border-blue-500 text-blue-300 transition-all"
                   />
                </div>
              )}

              {/* Lista de Vendedores */}
              <div className="space-y-3">
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" /> Vendedores do Time
                </h3>
                
                {team.sellers.map((seller) => (
                  <div key={seller.id} className="group bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={seller.photoUrl} 
                        alt={seller.name} 
                        onError={(e) => {
                          const img = e.currentTarget;
                          // Tenta .png se o original (do banco ou fallback .jpg) falhar
                          if (img.src.includes('.jpg')) {
                            img.src = `/img/${encodeURIComponent(seller.name)}.png`;
                          } else if (!img.src.includes('ui-avatars.com')) {
                            // Tenta a versão sem espaços se falhar (.png ou original)
                            const nameNoSpaces = seller.name.replace(/\s+/g, "");
                            img.src = `/img/${encodeURIComponent(nameNoSpaces)}.png`;
                            
                            // Se ainda falhar, vai pro fallback final
                            img.onerror = () => {
                              img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.name)}&background=3f3f46&color=fff`;
                              img.onerror = null;
                            };
                          }
                        }}
                        className="w-10 h-10 rounded-xl object-cover" 
                      />
                      <div>
                        <p className="font-bold text-sm">{seller.name}</p>
                        <p className="text-xs text-gray-500">R$ {seller.sales.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {editingSeller === seller.id ? (
                          <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
                             <input 
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                placeholder="Valor"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateSales(seller.id); }}
                                className="bg-blue-900/40 border border-blue-500/50 rounded-lg p-2 w-28 text-sm focus:outline-none"
                             />
                             <button onClick={() => handleUpdateSales(seller.id)} title="Salvar" className="p-2 bg-green-600 rounded-lg hover:bg-green-500 transition-colors"><Save className="w-4 h-4" /></button>
                             <button onClick={() => setEditingSeller(null)} title="Cancelar" className="p-2 bg-red-600 rounded-lg hover:bg-red-500 transition-colors"><X className="w-4 h-4" /></button>
                          </div>
                       ) : (
                         <>
                            <button 
                             onClick={() => { setEditingSeller(seller.id); setNewValue(seller.sales > 0 ? seller.sales.toString() : ""); }}
                             className="p-2 hover:bg-white/5 rounded-xl text-blue-400 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button 
                             onClick={() => otherTeam && handleMoveSeller(seller.id, team.id, otherTeam.id)}
                             title="Mudar de Time"
                             className="p-2 hover:bg-white/5 rounded-xl text-yellow-400 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                            </button>
                            <button 
                             onClick={() => handleDeleteSeller(seller.id)}
                             title="Excluir Vendedor"
                             className="p-2 hover:bg-white/5 rounded-xl text-red-500 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </>
                       )}
                    </div>
                  </div>
                ))}

                {/* Adicionar Vendedor */}
                {selectedTeamForNewSeller === team.id ? (
                  <div className="bg-blue-600/10 border border-blue-600/30 rounded-2xl p-4 mt-4 space-y-3">
                     <p className="text-xs font-bold uppercase text-blue-400">Novo Vendedor</p>
                     <input 
                      autoFocus
                      type="text" 
                      placeholder="Nome do Vendedor"
                      value={newSellerName}
                      onChange={(e) => setNewSellerName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-sm"
                     />
                     <div className="flex gap-2">
                        <button onClick={() => handleAddSeller(team.id)} className="flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded-xl text-sm font-bold">Criar Vendedor</button>
                        <button onClick={() => setSelectedTeamForNewSeller(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl"><X className="w-4 h-4" /></button>
                     </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setSelectedTeamForNewSeller(team.id)}
                    className="w-full border border-dashed border-white/10 p-4 rounded-2xl hover:bg-white/5 hover:border-white/20 transition-all text-sm text-gray-400 font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Vendedor
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
