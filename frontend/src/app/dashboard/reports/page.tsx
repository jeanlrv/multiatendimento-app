'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import {
    Download, FileText, Table as TableIcon, Calendar,
    Filter, Search, ArrowUpRight, MessageSquare,
    CheckCircle, BarChart3, ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
    const [stats, setStats] = useState<any>(null);
    const [performance, setPerformance] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [auditQuery, setAuditQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        const params = { ...dateRange };
        const [statsResult, perfResult, auditResult] = await Promise.allSettled([
            api.get('/reports/stats', { params }),
            api.get('/reports/performance', { params }),
            api.get('/reports/audit/internal-chat', { params: { ...params, query: auditQuery } }),
        ]);

        if (statsResult.status === 'fulfilled') setStats(statsResult.value.data);
        else toast.error('Erro ao carregar estatísticas');

        if (perfResult.status === 'fulfilled') setPerformance(perfResult.value.data);
        else toast.error('Erro ao carregar dados de performance');

        if (auditResult.status === 'fulfilled') setAuditLogs(auditResult.value.data);
        else setAuditLogs([]);

        setLoading(false);
    };

    const exportPDF = () => {
        const doc = new jsPDF() as any;
        doc.text('Relatório de Produtividade - KSZap', 14, 15);

        const tableData = performance.map(p => [p.name, p.resolvedCount]);
        doc.autoTable({
            head: [['Atendente', 'Tickets Resolvidos']],
            body: tableData,
            startY: 20
        });

        doc.save('relatorio-kszap.pdf');
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(performance);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Performance");
        XLSX.writeFile(wb, "relatorio-kszap.xlsx");
    };

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="liquid-glass aurora min-h-0 md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-8 max-w-[1600px] mx-auto">
            {/* Header com Filtros */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-3">
                        <BarChart3 className="text-primary w-10 h-10" />
                        Intelligence HUB
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Visão geral e auditoria da operação</p>
                </div>

                <div className="flex items-center gap-3 bg-white/50 dark:bg-white/5 p-2 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-xl">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <Calendar size={14} className="text-primary" />
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest"
                            value={dateRange.startDate}
                            onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest"
                            value={dateRange.endDate}
                            onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                    </div>
                    <button
                        onClick={exportPDF}
                        className="p-3 bg-rose-500/10 text-rose-600 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10"
                    >
                        <Download size={18} />
                    </button>
                    <button
                        onClick={exportExcel}
                        className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                    >
                        <TableIcon size={18} />
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Tickets', value: stats?.totalTickets, icon: MessageSquare, color: 'text-primary bg-primary/10' },
                    { label: 'Resolvidos', value: stats?.resolvedTickets, icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10' },
                    { label: 'Msgs Enviadas', value: stats?.messagesCount, icon: ArrowUpRight, color: 'text-amber-500 bg-amber-500/10' },
                    { label: 'Taxa Resolução', value: `${stats?.resolutionRate?.toFixed(1)}%`, icon: BarChart3, color: 'text-purple-500 bg-purple-500/10' },
                ].map((item, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={item.label}
                        className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl relative overflow-hidden group"
                    >
                        <div className={`p-4 rounded-3xl ${item.color} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                            <item.icon size={24} />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{item.label}</h3>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {loading ? '...' : item.value}
                        </p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Performance Chart */}
                <div className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black italic tracking-tighter">Performance por Agente</h3>
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Resolvidos</span>
                        </div>
                    </div>
                    <div className="h-[350px]">
                        {loading ? (
                            <div className="w-full h-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-2xl" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={performance}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: 900 }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                                    />
                                    <Bar dataKey="resolvedCount" radius={[10, 10, 0, 0]}>
                                        {performance.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Audit Logs */}
                <div className="p-8 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldAlert className="text-rose-500" />
                            <h3 className="text-xl font-black italic tracking-tighter">Auditoria de Chats Internos</h3>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Filtrar conteúdo..."
                                value={auditQuery}
                                onChange={e => setAuditQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchData()}
                                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-white/5 rounded-2xl text-[10px] font-bold outline-none border border-transparent focus:border-primary/30"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                        {loading ? (
                            [1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)
                        ) : auditLogs.length === 0 ? (
                            <div className="text-center py-20 opacity-30 font-black uppercase text-[10px] tracking-widest">Nenhum registro encontrado</div>
                        ) : (
                            auditLogs.map(log => (
                                <div key={log.id} className="p-4 bg-slate-100/50 dark:bg-white/5 rounded-3xl border border-transparent hover:border-primary/20 transition-all group">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
                                                {log.sender.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black">{log.sender.name}</p>
                                                <p className="text-[8px] font-bold uppercase tracking-widest opacity-50">{log.chat.name || 'Chat Direto'}</p>
                                            </div>
                                        </div>
                                        <span className="text-[8px] font-black opacity-40">{new Date(log.sentAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-gray-400 italic">"{log.content}"</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
