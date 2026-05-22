import { useState, useEffect, useMemo, Fragment } from 'react';
import { fetchLunchBreakHistory, updateLunchBreakDuration, type LunchBreakRecord } from '../services/SupabaseService';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Download, Filter, RefreshCw, Clock, ChevronDown, ChevronUp, BarChart3, Calendar, Edit2, Sunrise, Sun, Moon } from 'lucide-react';
import { WheelPicker } from './WheelPicker';

interface LunchBreakReportProps {
  allTeams: any[];
  allSellers: any[];
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationMinutes(seconds: number): string {
  return formatDuration(seconds);
}

function getPeriodOfDay(date: Date): 'Manhã' | 'Tarde' | 'Noite' {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Tarde';
  return 'Noite';
}

export default function LunchBreakReport({ allTeams, allSellers }: LunchBreakReportProps) {
  const [rawBreaks, setRawBreaks] = useState<LunchBreakRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSellers, setExpandedSellers] = useState<Set<number>>(new Set());

  // Edit Modal State
  const [editingBreak, setEditingBreak] = useState<LunchBreakRecord | null>(null);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);

  // Filters (Date Range)
  const [filterStartDate, setFilterStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [filterEndDate, setFilterEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [categoryFilter, setCategoryFilter] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Load data for a broad range that guarantees covering Month, Week, and selected Date Range
  const loadData = async () => {
    setLoading(true);
    try {
      const parsedStart = parseISO(filterStartDate);
      const parsedEnd = parseISO(filterEndDate);

      let minDate = monthStart;
      if (weekStart < minDate) minDate = weekStart;
      if (parsedStart < minDate) minDate = parsedStart;

      let maxDate = monthEnd;
      if (weekEnd > maxDate) maxDate = weekEnd;
      if (parsedEnd > maxDate) maxDate = parsedEnd;

      const start = format(minDate, 'yyyy-MM-dd');
      const end = format(maxDate, 'yyyy-MM-dd');
      
      const breaks = await fetchLunchBreakHistory(start, end);
      setRawBreaks(breaks.filter(b => b.ended_at !== null));
    } catch (err) {
      console.error('Erro ao carregar histórico de lanches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
  }, [filterStartDate, filterEndDate]);

  // Derived filter options
  const categories = useMemo(() => [...new Set(allTeams.map(t => t.category))].filter(Boolean), [allTeams]);

  const leaders = useMemo(() => {
    const teams = categoryFilter ? allTeams.filter(t => t.category === categoryFilter) : allTeams;
    return [...new Set(teams.map(t => t.leader_name))].filter(Boolean);
  }, [allTeams, categoryFilter]);

  const sellerOptions = useMemo(() => {
    let s = allSellers;
    if (categoryFilter) {
      const ids = allTeams.filter(t => t.category === categoryFilter).map(t => t.id);
      s = s.filter(x => ids.includes(x.team_id));
    }
    if (leaderFilter) {
      const ids = allTeams.filter(t => t.leader_name === leaderFilter).map(t => t.id);
      s = s.filter(x => ids.includes(x.team_id));
    }
    return [...new Set(s.map(x => x.name))].filter(Boolean);
  }, [allSellers, allTeams, categoryFilter, leaderFilter]);

  // Compute the selected day range
  const selectedRangeStart = useMemo(() => {
    const d = parseISO(filterStartDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [filterStartDate]);

  const selectedRangeEnd = useMemo(() => {
    const d = parseISO(filterEndDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [filterEndDate]);

  const sellerStats = useMemo(() => {
    return allSellers
      .map(seller => {
        const team = allTeams.find(t => t.id === seller.team_id);
        if (!team) return null;

        // Apply filters
        if (categoryFilter && team.category !== categoryFilter) return null;
        if (leaderFilter && team.leader_name !== leaderFilter) return null;
        if (sellerFilter && seller.name !== sellerFilter) return null;

        const sellerBreaks = rawBreaks.filter(b => b.seller_id === seller.id);

        // Filtered Range (substituting single day)
        const rangeBreaks = sellerBreaks.filter(b =>
          isWithinInterval(parseISO(b.started_at), { start: selectedRangeStart, end: selectedRangeEnd })
        );
        const rangeSeconds = rangeBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        // Calculate period breakdowns for rangeBreaks
        const morningBreaks = rangeBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Manhã');
        const morningSeconds = morningBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        const afternoonBreaks = rangeBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Tarde');
        const afternoonSeconds = afternoonBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        const nightBreaks = rangeBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Noite');
        const nightSeconds = nightBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        // Week
        const weekBreaks = sellerBreaks.filter(b =>
          isWithinInterval(parseISO(b.started_at), { start: weekStart, end: weekEnd })
        );
        const weekSeconds = weekBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        // Month
        const monthBreaks = sellerBreaks.filter(b =>
          isWithinInterval(parseISO(b.started_at), { start: monthStart, end: monthEnd })
        );
        const monthSeconds = monthBreaks.reduce((acc, b) => acc + (b.duration_seconds || 0), 0);

        // All breaks within selected period for detail view, sorted chronologically
        const detailBreaks = [...rangeBreaks].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

        return {
          id: seller.id,
          name: seller.name,
          teamName: team.name,
          leaderName: team.leader_name,
          category: team.category,
          dayBreakCount: rangeBreaks.length,
          daySeconds: rangeSeconds,
          morningSeconds,
          afternoonSeconds,
          nightSeconds,
          weekSeconds,
          monthSeconds,
          detailBreaks,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter(x => x.monthSeconds > 0 || x.daySeconds > 0) // only sellers with at least some break
      .sort((a, b) => b.daySeconds - a.daySeconds);
  }, [rawBreaks, allSellers, allTeams, categoryFilter, leaderFilter, sellerFilter, selectedRangeStart, selectedRangeEnd, weekStart, weekEnd, monthStart, monthEnd]);

  // Summary totals
  const totalDaySeconds = sellerStats.reduce((acc, s) => acc + s.daySeconds, 0);
  const totalWeekSeconds = sellerStats.reduce((acc, s) => acc + s.weekSeconds, 0);
  const totalMonthSeconds = sellerStats.reduce((acc, s) => acc + s.monthSeconds, 0);

  const toggleExpand = (id: number) => {
    setExpandedSellers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEditBreak = (b: LunchBreakRecord) => {
    if (!b.ended_at) {
      alert("Não é possível editar um intervalo em andamento.");
      return;
    }
    const currentTotalSeconds = b.duration_seconds || 0;
    setEditMinutes(Math.floor(currentTotalSeconds / 60));
    setEditSeconds(currentTotalSeconds % 60);
    setEditingBreak(b);
  };

  const saveEditedBreak = async () => {
    if (!editingBreak) return;
    const newTotalSeconds = (editMinutes * 60) + editSeconds;
    
    try {
      await updateLunchBreakDuration(editingBreak.id, newTotalSeconds);
      setEditingBreak(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar o tempo do intervalo.');
    }
  };

  const exportToExcel = () => {
    if (sellerStats.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    // Sheet 1: Summary
    const summaryData = sellerStats.map(s => ({
      'Vendedor': s.name,
      'Time': s.teamName,
      'Líder': s.leaderName,
      'Departamento': s.category,
      'Intervalos no Período': s.dayBreakCount,
      'Tempo Total no Período': formatDuration(s.daySeconds),
      'Tempo Manhã no Período': formatDuration(s.morningSeconds),
      'Tempo Tarde no Período': formatDuration(s.afternoonSeconds),
      'Tempo Noite no Período': formatDuration(s.nightSeconds),
      'Tempo na Semana': formatDuration(s.weekSeconds),
      'Tempo no Mês': formatDuration(s.monthSeconds),
    }));

    // Sheet 2: Detail - all individual breaks
    const detailData: any[] = [];
    sellerStats.forEach(s => {
      s.detailBreaks.forEach(b => {
        detailData.push({
          'Vendedor': s.name,
          'Time': s.teamName,
          'Departamento': s.category,
          'Data': format(parseISO(b.started_at), 'dd/MM/yyyy'),
          'Hora Início': format(parseISO(b.started_at), 'HH:mm:ss'),
          'Hora Fim': b.ended_at ? format(parseISO(b.ended_at), 'HH:mm:ss') : '-',
          'Duração': formatDuration(b.duration_seconds),
          'Duração (minutos)': Math.round((b.duration_seconds || 0) / 60),
          'Período': getPeriodOfDay(parseISO(b.started_at))
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(detailData.length > 0 ? detailData : [{ 'Info': 'Nenhum detalhe no período selecionado' }]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumo por Vendedor');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalhes dos Intervalos');
    XLSX.writeFile(wb, `Relatorio_Lanche_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  return (
    <div className="space-y-6" translate="no">

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-2 mb-4 text-orange-400 font-bold">
          <Filter className="w-5 h-5" /> Filtros — Tempo de Lanche
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* Data Início */}
          <div className="relative group">
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Início</label>
            <div className="relative">
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 pl-9 text-sm focus:border-orange-500 outline-none transition-colors appearance-none cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-orange-500/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Data Fim */}
          <div className="relative group">
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Data Fim</label>
            <div className="relative">
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 pl-9 text-sm focus:border-orange-500 outline-none transition-colors appearance-none cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-orange-500/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Departamento</label>
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setLeaderFilter(''); setSellerFilter(''); }}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-orange-500 outline-none cursor-pointer"
            >
              <option value="">Todos</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Leader / Team */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Líder / Time</label>
            <select
              value={leaderFilter}
              onChange={e => { setLeaderFilter(e.target.value); setSellerFilter(''); }}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-orange-500 outline-none cursor-pointer"
            >
              <option value="">Todos</option>
              {leaders.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Seller */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Vendedor</label>
            <select
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm focus:border-orange-500 outline-none cursor-pointer"
            >
              <option value="">Todos</option>
              {sellerOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Export + Refresh */}
          <div className="flex flex-col gap-2 justify-end">
            <button
              onClick={exportToExcel}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-black font-bold rounded-lg transition-all text-sm shadow-[0_0_15px_rgba(249,115,22,0.3)] cursor-pointer"
            >
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            <button
              onClick={loadData}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 font-bold rounded-lg transition-all text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/5 border border-orange-500/30 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 font-bold text-xs uppercase tracking-wide">Total no Período</span>
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-2xl font-black text-white font-mono">{formatDuration(totalDaySeconds)}</h2>
              <p className="text-xs text-zinc-500 mt-1">
                {filterStartDate === filterEndDate 
                  ? format(parseISO(filterStartDate), 'dd/MM/yyyy') 
                  : `${format(parseISO(filterStartDate), 'dd/MM')} a ${format(parseISO(filterEndDate), 'dd/MM')}`}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wide">Total na Semana</span>
                <BarChart3 className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-2xl font-black text-white font-mono">{formatDuration(totalWeekSeconds)}</h2>
              <p className="text-xs text-zinc-500 mt-1">{`${format(weekStart, 'dd/MM')} – ${format(weekEnd, 'dd/MM')}`}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 font-bold text-xs uppercase tracking-wide">Total no Mês</span>
                <Calendar className="w-4 h-4 text-zinc-500" />
              </div>
              <h2 className="text-2xl font-black text-white font-mono">{formatDuration(totalMonthSeconds)}</h2>
              <p className="text-xs text-zinc-500 mt-1">{format(monthStart, 'MMMM yyyy')}</p>
            </div>

          </div>

          {/* Table */}
          {sellerStats.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-zinc-500 backdrop-blur-xl">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold">Nenhum registro de lanche no período.</p>
              <p className="text-sm mt-1">Use o ícone ⏱️ no Controle para registrar intervalos.</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Detalhamento por Vendedor
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest border-b border-white/10">
                      <th className="p-4 font-semibold">Vendedor</th>
                      <th className="p-4 font-semibold">Time / Líder</th>
                      <th className="p-4 font-semibold">Dept.</th>
                      <th className="p-4 font-semibold text-center">Intervalos</th>
                      <th className="p-4 font-semibold text-right text-orange-400">Tempo Período</th>
                      <th className="p-4 font-semibold text-right text-amber-400">Tempo Semana</th>
                      <th className="p-4 font-semibold text-right text-zinc-400">Tempo Mês</th>
                      <th className="p-4 font-semibold text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sellerStats.map((item, index) => (
                      <Fragment key={`row-group-${item.id}`}>
                        <motion.tr
                          key={`row-${item.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className={`hover:bg-white/5 transition-colors group cursor-pointer ${expandedSellers.has(item.id) ? 'bg-orange-500/5' : ''}`}
                          onClick={() => item.detailBreaks.length > 0 && toggleExpand(item.id)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-orange-400">
                                {index + 1}
                              </div>
                              <span className="font-bold text-white group-hover:text-orange-400 transition-colors">{item.name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-300 text-sm">{item.teamName}</span>
                              <span className="text-xs text-zinc-500">Líder: {item.leaderName}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.category === 'INSS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-teal-500/20 text-teal-400 border border-teal-500/20'}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-lg text-xs font-black ${item.dayBreakCount > 0 ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-600'}`}>
                              {item.dayBreakCount > 0 ? item.dayBreakCount : '—'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono font-black text-orange-400 text-sm">
                            {item.daySeconds > 0 ? formatDuration(item.daySeconds) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-amber-400 text-sm">
                            {item.weekSeconds > 0 ? formatDuration(item.weekSeconds) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="p-4 text-right font-mono text-zinc-400 text-sm">
                            {item.monthSeconds > 0 ? formatDuration(item.monthSeconds) : <span className="text-zinc-700">—</span>}
                          </td>
                          <td className="p-4 text-center">
                            {item.detailBreaks.length > 0 && (
                              <span className="text-zinc-500 group-hover:text-orange-400 transition-colors">
                                {expandedSellers.has(item.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </span>
                            )}
                          </td>
                        </motion.tr>

                        {/* Expanded Detail Row */}
                        <AnimatePresence key={`expand-${item.id}`}>
                          {expandedSellers.has(item.id) && item.detailBreaks.length > 0 && (() => {
                            const morningBreaks = item.detailBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Manhã');
                            const afternoonBreaks = item.detailBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Tarde');
                            const nightBreaks = item.detailBreaks.filter(b => getPeriodOfDay(parseISO(b.started_at)) === 'Noite');

                            return (
                              <tr key={`expanded-${item.id}`}>
                                <td colSpan={8} className="bg-black/40 px-6 py-4">
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <Clock className="w-3 h-3" /> Intervalos por Período do Dia (
                                      {filterStartDate === filterEndDate 
                                        ? format(parseISO(filterStartDate), 'dd/MM/yyyy') 
                                        : `${format(parseISO(filterStartDate), 'dd/MM/yyyy')} a ${format(parseISO(filterEndDate), 'dd/MM/yyyy')}`}
                                      )
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" onClick={(e) => e.stopPropagation()}>
                                      
                                      {/* Manhã */}
                                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                          <span className="text-xs font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Sunrise className="w-4 h-4 text-orange-400" /> Manhã (06h - 12h)
                                          </span>
                                          <span className="text-xs font-mono font-bold text-zinc-300">
                                            {formatDuration(item.morningSeconds)}
                                          </span>
                                        </div>
                                        {morningBreaks.length === 0 ? (
                                          <p className="text-zinc-500 text-xs italic py-2">Nenhum intervalo</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {morningBreaks.map((b, bi) => (
                                              <div key={bi} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono">
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[10px] text-zinc-500">{format(parseISO(b.started_at), 'dd/MM/yyyy')}</span>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-zinc-300 font-semibold">{format(parseISO(b.started_at), 'HH:mm')}</span>
                                                    <span className="text-zinc-600">→</span>
                                                    <span className="text-zinc-300">{b.ended_at ? format(parseISO(b.ended_at), 'HH:mm') : '...'}</span>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-orange-400 font-bold">({formatDurationMinutes(b.duration_seconds)})</span>
                                                  {b.ended_at && (
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); handleEditBreak(b); }}
                                                      className="text-zinc-500 hover:text-orange-400 transition-colors p-1 rounded-md hover:bg-orange-400/10 cursor-pointer"
                                                      title="Editar Tempo"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Tarde */}
                                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                          <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Sun className="w-4 h-4 text-amber-400" /> Tarde (12h - 18h)
                                          </span>
                                          <span className="text-xs font-mono font-bold text-zinc-300">
                                            {formatDuration(item.afternoonSeconds)}
                                          </span>
                                        </div>
                                        {afternoonBreaks.length === 0 ? (
                                          <p className="text-zinc-500 text-xs italic py-2">Nenhum intervalo</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {afternoonBreaks.map((b, bi) => (
                                              <div key={bi} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono">
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[10px] text-zinc-500">{format(parseISO(b.started_at), 'dd/MM/yyyy')}</span>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-zinc-300 font-semibold">{format(parseISO(b.started_at), 'HH:mm')}</span>
                                                    <span className="text-zinc-600">→</span>
                                                    <span className="text-zinc-300">{b.ended_at ? format(parseISO(b.ended_at), 'HH:mm') : '...'}</span>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-orange-400 font-bold">({formatDurationMinutes(b.duration_seconds)})</span>
                                                  {b.ended_at && (
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); handleEditBreak(b); }}
                                                      className="text-zinc-500 hover:text-orange-400 transition-colors p-1 rounded-md hover:bg-orange-400/10 cursor-pointer"
                                                      title="Editar Tempo"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Noite */}
                                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                          <span className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Moon className="w-4 h-4 text-indigo-400" /> Noite (18h - 06h)
                                          </span>
                                          <span className="text-xs font-mono font-bold text-zinc-300">
                                            {formatDuration(item.nightSeconds)}
                                          </span>
                                        </div>
                                        {nightBreaks.length === 0 ? (
                                          <p className="text-zinc-500 text-xs italic py-2">Nenhum intervalo</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {nightBreaks.map((b, bi) => (
                                              <div key={bi} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono">
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[10px] text-zinc-500">{format(parseISO(b.started_at), 'dd/MM/yyyy')}</span>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-zinc-300 font-semibold">{format(parseISO(b.started_at), 'HH:mm')}</span>
                                                    <span className="text-zinc-600">→</span>
                                                    <span className="text-zinc-300">{b.ended_at ? format(parseISO(b.ended_at), 'HH:mm') : '...'}</span>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-orange-400 font-bold">({formatDurationMinutes(b.duration_seconds)})</span>
                                                  {b.ended_at && (
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); handleEditBreak(b); }}
                                                      className="text-zinc-500 hover:text-orange-400 transition-colors p-1 rounded-md hover:bg-orange-400/10 cursor-pointer"
                                                      title="Editar Tempo"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            );
                          })()}
                        </AnimatePresence>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Edição de Tempo (Wheel Picker) */}
      <AnimatePresence>
        {editingBreak && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setEditingBreak(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl w-full max-w-sm"
            >
              <h3 className="text-2xl font-black text-white mb-2 text-center uppercase tracking-wider">Editar Tempo</h3>
              <p className="text-zinc-400 text-xs text-center mb-6 font-medium">
                Intervalo de {format(parseISO(editingBreak.started_at), 'HH:mm')}
              </p>

              <div className="flex items-center justify-center gap-6 mb-8 bg-black/50 p-6 rounded-2xl border border-white/5">
                <WheelPicker 
                  value={editMinutes}
                  onChange={setEditMinutes}
                  min={0}
                  max={240}
                  label="MIN"
                />
                <div className="text-3xl font-black text-orange-500 mb-8 animate-pulse">:</div>
                <WheelPicker 
                  value={editSeconds}
                  onChange={setEditSeconds}
                  min={0}
                  max={59}
                  label="SEG"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingBreak(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-bold transition-colors border border-white/10 text-sm uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditedBreak}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black rounded-xl font-black transition-colors shadow-[0_0_20px_rgba(249,115,22,0.3)] text-sm uppercase tracking-widest cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
