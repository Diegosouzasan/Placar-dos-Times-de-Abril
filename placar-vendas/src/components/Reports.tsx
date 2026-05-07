import React, { useState, useEffect, useMemo } from 'react';
import { fetchSalesHistory, resetSalesHistory, fetchAllMetadata } from '../services/SupabaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { Download, Filter, ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, DollarSign, Calendar, BarChart3 } from 'lucide-react';

export default function Reports({ onBack }: { onBack: () => void }) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [leaderFilter, setLeaderFilter] = useState<string>("");
  const [sellerFilter, setSellerFilter] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const history = await fetchSalesHistory(startDate, endDate);
      const metadata = await fetchAllMetadata();
      
      setAllTeams(metadata.teams);
      setAllSellers(metadata.sellers);
      setRawData(history);
    } catch (error) {
      console.error("Error loading report data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const filteredData = useMemo(() => {
    // 1. Create a map of sales per seller from history
    const salesPerSeller: Record<number, number> = {};
    rawData.forEach(item => {
      salesPerSeller[item.seller_id] = (salesPerSeller[item.seller_id] || 0) + Number(item.amount);
    });

    // 2. Map all sellers to their data
    return allSellers.map(s => {
      const team = allTeams.find(t => t.id === s.team_id);
      return {
        id: s.id,
        seller_name: s.name,
        team_name: team?.name || "Sem Time",
        category: team?.category || "N/A",
        leader_name: team?.leader_name || "N/A",
        amount: salesPerSeller[s.id] || 0,
        live_amount: s.total_sales || 0,
        last_sale: rawData.filter(h => h.seller_id === s.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
      };
    }).filter(item => {
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      const matchLeader = !leaderFilter || item.leader_name === leaderFilter;
      const matchSeller = !sellerFilter || item.seller_name === sellerFilter;
      return matchCategory && matchLeader && matchSeller;
    }).sort((a, b) => b.amount - a.amount);
  }, [rawData, allSellers, allTeams, categoryFilter, leaderFilter, sellerFilter]);

  const chartData = useMemo(() => {
    const dailyMap = new Map<string, number>();
    
    rawData.forEach(item => {
      const dateStr = format(parseISO(item.created_at), 'dd/MM/yyyy');
      const amount = Number(item.amount);
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + amount);
    });

    const arr = Array.from(dailyMap.entries()).map(([date, total]) => ({
       date,
       total,
       rawDate: parseISO(date.split('/').reverse().join('-'))
    }));
    
    arr.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    return arr;
  }, [rawData]);

  const totalSalesAmount = filteredData.reduce((acc, curr) => acc + curr.amount, 0);
  const totalLiveAmount = filteredData.reduce((acc, curr) => acc + curr.live_amount, 0);

  const categories = useMemo(() => [...new Set(allTeams.map(t => t.category))].filter(Boolean), [allTeams]);
  const leaders = useMemo(() => [...new Set(allTeams.map(t => t.leader_name))].filter(Boolean), [allTeams]);
  const sellers = useMemo(() => [...new Set(allSellers.map(s => s.name))].filter(Boolean), [allSellers]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }
    const exportData = filteredData.map(item => ({
      'Vendedor': item.seller_name,
      'Time': item.team_name,
      'Líder': item.leader_name,
      'Departamento': item.category,
      'Placar Atual (R$)': Number(item.live_amount),
      'Total no Período (R$)': Number(item.amount),
      'Última Venda': item.last_sale ? format(parseISO(item.last_sale), 'dd/MM/yyyy HH:mm') : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Geral");
    XLSX.writeFile(workbook, `Relatorio_Geral_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  const handleMonthlyReset = async () => {
    const confirmed = window.confirm("ATENÇÃO: Deseja deletar todo o histórico de vendas? Esta ação é permanente.");
    if (confirmed) {
       await resetSalesHistory();
       loadData();
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10 font-sans selection:bg-emerald-500/30" translate="no">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-emerald-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
                Central de Relatórios
              </h1>
              <p className="text-zinc-400 text-sm">Desempenho total de todos os vendedores e times</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            <button 
              onClick={handleMonthlyReset}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-lg transition-all"
            >
              <AlertTriangle className="w-4 h-4" /> Limpar Tudo
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2 mb-4 text-emerald-400 font-bold">
            <Filter className="w-5 h-5" /> Filtros
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative group">
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Início</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  onClick={(e) => (e.target as any).showPicker?.()}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 pl-9 text-sm focus:border-emerald-500 outline-none transition-colors appearance-none cursor-pointer" 
                />
                <Calendar className="w-4 h-4 text-emerald-500/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
            <div className="relative group">
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Fim</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  onClick={(e) => (e.target as any).showPicker?.()}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 pl-9 text-sm focus:border-emerald-500 outline-none transition-colors appearance-none cursor-pointer" 
                />
                <Calendar className="w-4 h-4 text-emerald-500/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Departamento</label>
              <select value={categoryFilter} onChange={e => {setCategoryFilter(e.target.value); setLeaderFilter(""); setSellerFilter("");}} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none transition-colors cursor-pointer">
                <option value="">Todos</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Líder / Time</label>
              <select value={leaderFilter} onChange={e => {setLeaderFilter(e.target.value); setSellerFilter("");}} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none transition-colors cursor-pointer">
                <option value="">Todos</option>
                {leaders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Vendedor</label>
              <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-emerald-500 outline-none transition-colors cursor-pointer">
                <option value="">Todos</option>
                {sellers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-emerald-400 font-bold text-sm">Total do Placar Atual</span>
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{formatCurrency(totalLiveAmount)}</h2>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 font-bold text-sm">Total no Período</span>
                  <DollarSign className="w-5 h-5 text-zinc-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{formatCurrency(totalSalesAmount)}</h2>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 font-bold text-sm">Vendedores</span>
                  <BarChart3 className="w-5 h-5 text-zinc-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{filteredData.length}</h2>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 font-bold text-sm">Média (Placar)</span>
                  <TrendingUp className="w-5 h-5 text-zinc-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{formatCurrency(filteredData.length > 0 ? totalLiveAmount / filteredData.length : 0)}</h2>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl h-[400px]">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" /> 
                Curva de Vendas Global
              </h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#000000dd', border: '1px solid #10b98150', borderRadius: '8px', color: '#fff' }}
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Total Vendido']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  Nenhuma venda registrada no histórico para gerar gráfico.
                </div>
              )}
            </div>

            {/* Detailed Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" /> 
                  Ranking Geral e Desempenho
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest border-b border-white/10">
                      <th className="p-4 font-semibold">Vendedor</th>
                      <th className="p-4 font-semibold">Time / Líder</th>
                      <th className="p-4 font-semibold">Departamento</th>
                      <th className="p-4 font-semibold text-right">Placar Atual</th>
                      <th className="p-4 font-semibold text-right text-emerald-400">Total no Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredData.map((item, index) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={item.id} 
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:text-emerald-400 transition-colors shadow-inner">
                              {index + 1}
                            </div>
                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">{item.seller_name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-300">{item.team_name}</span>
                            <span className="text-xs text-zinc-500">Líder: {item.leader_name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                            item.category === 'INSS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-teal-500/20 text-teal-400 border border-teal-500/20'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-white text-lg">
                          {formatCurrency(item.live_amount)}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-400">
                          {formatCurrency(item.amount)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
