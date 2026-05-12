import { useState, useEffect, useMemo } from 'react';
import { fetchSalesHistory, resetSalesHistory, fetchAllMetadata, syncToGoogleSheets, checkAndRunMonthlySync, getLastSyncInfo } from '../services/SupabaseService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { Download, Filter, ArrowLeft, RefreshCw, AlertTriangle, TrendingUp, DollarSign, Calendar, BarChart3, X, User, Activity, CloudUpload, History } from 'lucide-react';

export default function Reports({ onBack }: { onBack: () => void }) {
  const [rawData, setRawData] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSellerForReport, setSelectedSellerForReport] = useState<any>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
    // Verificar sync automático ao abrir
    checkAndRunMonthlySync().then(res => {
      if (res?.success) {
        setLastSyncAt(res.timestamp);
        loadData();
      }
    });
    // Buscar info da última sync
    getLastSyncInfo().then(setLastSyncAt);
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
        last_sale: rawData.filter(h => h.seller_id === s.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())?.[0]?.created_at
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
    const filteredSellerIds = new Set(filteredData.map(s => s.id));
    
    rawData
      .filter(item => filteredSellerIds.has(item.seller_id))
      .forEach(item => {
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
  
  const leaders = useMemo(() => {
    const filteredTeams = categoryFilter 
      ? allTeams.filter(t => t.category === categoryFilter)
      : allTeams;
    return [...new Set(filteredTeams.map(t => t.leader_name))].filter(Boolean);
  }, [allTeams, categoryFilter]);

  const sellers = useMemo(() => {
    let filteredSellers = allSellers;
    if (categoryFilter) {
      const teamIds = allTeams.filter(t => t.category === categoryFilter).map(t => t.id);
      filteredSellers = filteredSellers.filter(s => teamIds.includes(s.team_id));
    }
    if (leaderFilter) {
      const teamIds = allTeams.filter(t => t.leader_name === leaderFilter).map(t => t.id);
      filteredSellers = filteredSellers.filter(s => teamIds.includes(s.team_id));
    }
    return [...new Set(filteredSellers.map(s => s.name))].filter(Boolean);
  }, [allSellers, allTeams, categoryFilter, leaderFilter]);

  // Efeito para auto-seleção do líder quando for CLT e houver apenas um líder
  useEffect(() => {
    if (categoryFilter === 'CLT' && leaders.length === 1) {
      setLeaderFilter(leaders[0] as string);
    }
  }, [categoryFilter, leaders]);

  const individualReportData = useMemo(() => {
    if (!selectedSellerForReport) return null;
    
    const history = rawData.filter(h => h.seller_id === selectedSellerForReport.id);
    const totalContracts = history.length;
    const totalAmount = history.reduce((acc, h) => acc + Number(h.amount), 0);
    
    const dailyMap = new Map<string, number>();
    history.forEach(item => {
      const dateStr = format(parseISO(item.created_at), 'dd/MM/yyyy');
      const amount = Number(item.amount);
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + amount);
    });

    const chart = Array.from(dailyMap.entries()).map(([date, total]) => ({
       date,
       total,
       rawDate: parseISO(date.split('/').reverse().join('-'))
    })).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    return { totalContracts, totalAmount, chart };
  }, [selectedSellerForReport, rawData]);

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

  const handleManualSync = async () => {
    const confirmed = window.confirm("Deseja subir os dados para o Google Sheets agora? Após o sucesso, os dados locais do Supabase serão limpos.");
    if (confirmed) {
      try {
        setSyncing(true);
        const res = await syncToGoogleSheets(true);
        if (res.success) {
          setLastSyncAt(res.timestamp);
          alert(`Sincronização concluída! ${res.count} registros enviados.`);
          loadData();
        }
      } catch (e) {
        alert("Erro na sincronização. Tente novamente.");
      } finally {
        setSyncing(false);
      }
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
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-3">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Download className="w-4 h-4" /> Exportar Excel
              </button>
              <button 
                onClick={handleManualSync}
                disabled={syncing}
                className={`flex items-center gap-2 px-4 py-2 ${syncing ? 'bg-zinc-800' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30'} font-bold rounded-lg transition-all`}
              >
                {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                {syncing ? 'Sincronizando...' : 'Subir Dados'}
              </button>
            </div>
            {lastSyncAt && (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <History className="w-3 h-3" />
                Última sync: {format(parseISO(lastSyncAt), 'dd/MM/yyyy HH:mm')}
              </div>
            )}
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
                  <span className="text-emerald-400 font-bold text-sm">Total no Período</span>
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{formatCurrency(totalSalesAmount)}</h2>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 font-bold text-sm">Total do Placar Atual</span>
                  <TrendingUp className="w-5 h-5 text-zinc-500" />
                </div>
                <h2 className="text-3xl font-black text-white">{formatCurrency(totalLiveAmount)}</h2>
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
                Curva de Vendas
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
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">{item.seller_name}</span>
                              <button 
                                onClick={() => setSelectedSellerForReport(item)}
                                className="p-1.5 bg-white/5 hover:bg-emerald-500/20 rounded-md transition-all text-zinc-500 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/30"
                                title="Ver Desempenho Individual"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

        <AnimatePresence>
          {selectedSellerForReport && individualReportData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-transparent">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <User className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">{selectedSellerForReport.seller_name}</h2>
                      <p className="text-zinc-400 text-xs uppercase tracking-widest">{selectedSellerForReport.team_name} • {selectedSellerForReport.category}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedSellerForReport(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5">
                      <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total em Vendas</div>
                      <div className="text-2xl font-black text-emerald-400">{formatCurrency(individualReportData.totalAmount)}</div>
                    </div>
                    {/* Temporariamente removido: Qtd. de Contratos */}
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 h-[350px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2 uppercase tracking-widest">
                        <Activity className="w-4 h-4 text-emerald-500" /> Evolução de Desempenho
                      </h3>
                      <div className="text-[10px] text-zinc-500 italic">* Baseado no período selecionado</div>
                    </div>
                    
                    {individualReportData.chart.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={individualReportData.chart}>
                          <defs>
                            <linearGradient id="colorIndiv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`} />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px' }}
                            formatter={(value: any) => [formatCurrency(Number(value)), 'Venda']}
                          />
                          <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIndiv)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                        Nenhuma atividade registrada para este vendedor no período.
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5 text-center">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Relatório de Desempenho Individual • Sistema de Placar</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
