'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { motion } from 'framer-motion';
import {
    Users,
    MessageSquare,
    Zap,
    Star,
    Clock,
    TrendingUp,
    Activity,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Download,
    Mail,
    LineChart as ChartIcon,
    Trophy,
    Flame
} from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import {
    STATUS_TRANSLATIONS,
    translateStatus,
    getStatusColor as getStatusColorUtil
} from '@/lib/translations';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';


interface DashboardStats {
    tickets: {
        active: number;
        resolved: number;
    };
    messages: number;
    satisfaction: string;
    sentimentDistribution: {
        POSITIVE: number;
        NEUTRAL: number;
        NEGATIVE: number;
    };
    recentActivity: {
        id: string;
        contactName: string;
        userName: string;
        status: string;
        updatedAt: string;
    }[];
    history: {
        date: string;
        opened: number;
        resolved: number;
        sentiment: number;
    }[];
    ticketsByDepartment: {
        name: string;
        value: number;
    }[];
    ticketsByStatus: {
        status: string;
        value: number;
    }[];
    ticketsByPriority: {
        priority: string;
        value: number;
    }[];
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [agentRanking, setAgentRanking] = useState<any[]>([]);
    const [heatmapData, setHeatmapData] = useState<any[]>([]);
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [agents, setAgents] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        period: '30',
        departmentId: 'ALL',
        assignedUserId: 'ALL',
        startDate: '',
        endDate: ''
    });

    const fetchStats = async () => {
        try {
            const params: any = {
                departmentId: filters.departmentId,
                assignedUserId: filters.assignedUserId
            };

            if (filters.period !== 'CUSTOM') {
                const start = new Date();
                start.setDate(start.getDate() - parseInt(filters.period));
                params.startDate = start.toISOString();
            } else if (filters.startDate && filters.endDate) {
                params.startDate = filters.startDate;
                params.endDate = filters.endDate;
            }

            const [statsRes, rankingRes, heatmapRes] = await Promise.allSettled([
                api.get('/dashboard/stats', { params }),
                api.get('/dashboard/agent-ranking', { params }),
                api.get('/dashboard/heatmap', { params }),
            ]);

            if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
            else toast.error('Erro ao carregar estatísticas gerais.');

            if (rankingRes.status === 'fulfilled') setAgentRanking(rankingRes.value.data);
            if (heatmapRes.status === 'fulfilled') setHeatmapData(heatmapRes.value.data);
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            toast.error('Não foi possível carregar o dashboard. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                const [depsResult, agentsResult] = await Promise.allSettled([
                    api.get('/departments'),
                    api.get('/users'),
                ]);
                if (depsResult.status === 'fulfilled') setDepartments(depsResult.value.data);
                if (agentsResult.status === 'fulfilled') setAgents(agentsResult.value.data);
            } catch (error) {
                console.error('Erro ao buscar dados dos filtros:', error);
            }
        };

        fetchFiltersData();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [filters]);

    const cards = [
        {
            label: 'Tickets Ativos',
            value: stats?.tickets.active || 0,
            icon: <Users className="h-5 w-5" />,
            color: 'text-blue-600',
            bg: 'bg-blue-100 dark:bg-blue-900/30'
        },
        {
            label: 'Mensagens Totais',
            value: stats?.messages || 0,
            icon: <MessageSquare className="h-5 w-5" />,
            color: 'text-green-600',
            bg: 'bg-green-100 dark:bg-green-900/30'
        },
        {
            label: 'Satisfação Recente',
            value: stats?.satisfaction || '100%',
            icon: <Star className="h-5 w-5" />,
            color: 'text-yellow-600',
            bg: 'bg-yellow-100 dark:bg-yellow-900/30'
        },
        {
            label: 'Resolvidos',
            value: stats?.tickets.resolved || 0,
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'text-indigo-600',
            bg: 'bg-indigo-100 dark:bg-indigo-900/30'
        },
    ];

    const handleExport = () => {
        if (!stats) return;

        // Exportar histórico formatado
        const exportData = stats.history.map(day => ({
            Data: day.date,
            Abertos: day.opened,
            Resolvidos: day.resolved,
            Sentimento: day.sentiment
        }));

        exportToCSV(exportData, `kszap-dashboard-report-${filters.period}dias`);
    };

    const handleSendEmail = async () => {
        if (!user?.email) return;
        try {
            await api.post('/dashboard/send-report', { email: user.email });
            toast.success('Relatório enviado com sucesso!');
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro ao enviar relatório.';
            toast.error(msg);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-8 max-w-7xl mx-auto">
            {/* Hero Section Redesenhada */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/40 dark:bg-[#050505]/40 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-2xl relative overflow-hidden group"
            >
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2 flex flex-wrap items-center gap-2 md:gap-3 tracking-tighter">
                            Atendimento KSZap <span className="text-primary italic">Ao Vivo</span>
                        </h2>
                        <p className="text-slate-500 dark:text-gray-400 font-bold text-sm max-w-md uppercase tracking-widest">
                            Olá, {user?.name.split(' ')[0]} • Seu ecossistema está <span className="text-primary">otimizado</span>.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={handleExport}
                            className="w-full sm:w-auto bg-white/50 dark:bg-white/5 backdrop-blur-md text-slate-900 dark:text-white px-8 py-3 rounded-2xl border border-white/80 dark:border-white/10 font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Relatórios
                        </button>
                        <button
                            onClick={handleSendEmail}
                            className="w-full sm:w-auto bg-primary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                        >
                            <Mail size={16} /> Compartilhar
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Global BI Filters Bar */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col lg:flex-row items-center justify-between gap-6 liquid-glass p-6 rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] z-20"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 text-primary rounded-2xl shadow-inner">
                        <ChartIcon size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">Inteligência de Segurança</h4>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mt-1">Filtros Globais de Análise KSZap</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-black/20 p-2 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-inner">
                    <select
                        value={filters.departmentId}
                        onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value }))}
                        className="bg-transparent text-[10px] font-black tracking-widest outline-none px-4 py-2 border-r border-gray-200 dark:border-white/10"
                    >
                        <option value="ALL">TODOS DEPTOS</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>
                        ))}
                    </select>

                    <select
                        value={filters.assignedUserId}
                        onChange={(e) => setFilters(prev => ({ ...prev, assignedUserId: e.target.value }))}
                        className="bg-transparent text-[10px] font-black tracking-widest outline-none px-4 py-2 border-r border-gray-200 dark:border-white/10"
                    >
                        <option value="ALL">TODOS OPERADORES</option>
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name.toUpperCase()}</option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1 ml-2">
                        {[
                            { label: 'Hoje', value: '1' },
                            { label: '7 Dias', value: '7' },
                            { label: '30 Dias', value: '30' },
                            { label: 'Personalizado', value: 'CUSTOM' }
                        ].map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setFilters(prev => ({ ...prev, period: p.value }))}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${filters.period === p.value
                                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {p.label.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {filters.period === 'CUSTOM' && (
                        <div className="flex items-center gap-2 px-4 border-l border-gray-200 dark:border-white/10 animate-in fade-in slide-in-from-left-2">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="bg-transparent text-[10px] font-bold outline-none border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1"
                            />
                            <span className="text-[10px] text-gray-400 font-bold">ATÉ</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="bg-transparent text-[10px] font-bold outline-none border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1"
                            />
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Stats Grid - Glass Aero Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass-heavy p-8 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl group hover:scale-[1.02] transition-all"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl bg-primary/10 text-primary shadow-inner`}>
                                {card.icon}
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-[0.2em] leading-none mb-2">
                            {card.label}
                        </p>
                        <h4 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                            {card.value}
                        </h4>
                    </motion.div>
                ))}
            </div>

            {/* Performance Chart */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="liquid-glass p-8 rounded-[3rem] shadow-xl relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blur-3xl -z-10" />

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            <TrendingUp className="text-blue-600" size={20} /> Desempenho Operacional
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Evolução de tickets e resoluções no período selecionado</p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.history || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradientOpened" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradientResolved" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                minTickGap={30}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '24px',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                    padding: '12px 20px',
                                    fontWeight: 'bold',
                                    fontSize: '12px'
                                }}
                                itemStyle={{ padding: '4px 0' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="opened"
                                name="Tickets Abertos"
                                stroke="#3B82F6"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#gradientOpened)"
                                animationDuration={2000}
                            />
                            <Area
                                type="monotone"
                                dataKey="resolved"
                                name="Resolvidos"
                                stroke="#10B981"
                                strokeWidth={4}
                                fillOpacity={1}
                                fill="url(#gradientResolved)"
                                animationDuration={2500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Tickets per Department */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="liquid-glass p-8 rounded-[3rem] shadow-xl"
                >
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-6 flex items-center gap-2">
                        <Users className="text-blue-600" size={20} /> Distribuição por Departamento
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats?.ticketsByDepartment || []}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    animationDuration={1500}
                                >
                                    {(stats?.ticketsByDepartment || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                        backdropFilter: 'blur(12px)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)',
                                    }}
                                />
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Tickets per Status */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="liquid-glass p-8 rounded-[3rem] shadow-xl"
                >
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-6 flex items-center gap-2">
                        <Activity className="text-blue-600" size={20} /> Tickets por Situação
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={(stats?.ticketsByStatus || []).map(s => ({ ...s, statusPt: STATUS_TRANSLATIONS[s.status] || s.status }))}
                                layout="vertical"
                                margin={{ left: 20, right: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} strokeOpacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="statusPt"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fontWeight: 'bold', fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                        backdropFilter: 'blur(12px)',
                                        borderRadius: '16px',
                                        border: '1px solid rgba(255, 255, 255, 0.4)',
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    name="Quantidade"
                                    fill="#3B82F6"
                                    radius={[0, 10, 10, 0]}
                                    barSize={40}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={16} /> Atividade Recente
                        </h3>
                    </div>

                    <div className="liquid-glass rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl overflow-hidden backdrop-blur-md">
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                                stats.recentActivity.map((activity, i) => (
                                    <div key={i} onClick={() => router.push(`/dashboard/tickets?id=${activity.id}`)} className="p-5 flex items-center justify-between hover:bg-white/60 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-primary text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shadow-primary/20">
                                                {activity.contactName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{activity.contactName}</p>
                                                <p className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">Responsável: {activity.userName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${activity.status === 'OPEN' ? 'bg-primary/20 text-primary' :
                                                    activity.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-500' :
                                                        activity.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-200/40 text-slate-500 dark:text-gray-400'
                                                    }`}>
                                                    {STATUS_TRANSLATIONS[activity.status] || activity.status}
                                                </span>
                                                <p className="text-[9px] font-bold text-slate-400 mt-2 italic">
                                                    {new Date(activity.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-20 text-center opacity-30">
                                    <Activity className="h-12 w-12 mx-auto mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest">Nenhuma atividade detectada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sentiment Breakdown */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">Análise Sentimental</h3>
                    <div className="glass-heavy rounded-[2rem] border border-white/80 dark:border-white/10 p-8 shadow-xl space-y-6">
                        <div className="space-y-4">
                            {[
                                { label: 'Positivo', key: 'POSITIVE', color: 'bg-emerald-500', icon: '😊' },
                                { label: 'Neutro', key: 'NEUTRAL', color: 'bg-primary', icon: '😐' },
                                { label: 'Negativo', key: 'NEGATIVE', color: 'bg-rose-500', icon: '☹️' },
                            ].map((s) => {
                                const count = stats?.sentimentDistribution[s.key as keyof typeof stats.sentimentDistribution] || 0;
                                const total = Object.values(stats?.sentimentDistribution || {}).reduce((a, b) => a + b, 0) || 1;
                                const percent = Math.round((count / total) * 100);

                                return (
                                    <div key={s.key} className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-gray-300">
                                            <span className="flex items-center gap-2">{s.icon} {s.label}</span>
                                            <span>{percent}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percent}%` }}
                                                className={`h-full ${s.color} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>


                    </div>
                </div>
            </div>

            {/* ─── Ranking de Agentes + Heatmap ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Ranking de Agentes */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="liquid-glass p-8 rounded-[3rem] shadow-xl"
                >
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-6 flex items-center gap-2">
                        <Trophy className="text-amber-500" size={20} /> Ranking de Agentes
                    </h3>
                    <div className="space-y-3">
                        {agentRanking.length === 0 ? (
                            <div className="text-center py-10 opacity-30">
                                <Trophy size={32} className="mx-auto mb-2" strokeWidth={1} />
                                <p className="text-[10px] font-black uppercase tracking-widest">Sem dados no período</p>
                            </div>
                        ) : agentRanking.slice(0, 5).map((agent, i) => {
                            const maxResolved = agentRanking[0]?.resolved || 1;
                            const pct = Math.round((agent.resolved / maxResolved) * 100);
                            const medals = ['🥇', '🥈', '🥉'];
                            return (
                                <div key={agent.userId} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/50 dark:hover:bg-white/5 transition-all">
                                    <span className="text-xl w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                        {agent.avatar ? <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full object-cover" /> : agent.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 dark:text-white truncate">{agent.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ delay: i * 0.1, duration: 0.8 }}
                                                    className="h-full bg-primary rounded-full"
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-primary tabular-nums">{agent.resolved}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Heatmap de Volume */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="liquid-glass p-8 rounded-[3rem] shadow-xl"
                >
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-6 flex items-center gap-2">
                        <Flame className="text-orange-500" size={20} /> Pico de Atendimento
                    </h3>
                    {heatmapData.length === 0 ? (
                        <div className="text-center py-10 opacity-30">
                            <Flame size={32} className="mx-auto mb-2" strokeWidth={1} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Sem dados no período</p>
                        </div>
                    ) : (() => {
                        const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                        const PEAK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
                        const maxCount = Math.max(...heatmapData.map(d => d.count), 1);
                        return (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[9px] font-black">
                                    <thead>
                                        <tr>
                                            <th className="w-8 text-slate-400 text-left pb-2">Dia</th>
                                            {PEAK_HOURS.map(h => (
                                                <th key={h} className="text-slate-400 pb-2 font-bold text-center">{h}h</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS.map(day => (
                                            <tr key={day}>
                                                <td className="text-slate-500 pr-2 py-1 font-black uppercase tracking-tighter">{day}</td>
                                                {PEAK_HOURS.map(h => {
                                                    const cell = heatmapData.find(d => d.day === day && d.hour === h);
                                                    const count = cell?.count || 0;
                                                    const intensity = count / maxCount;
                                                    return (
                                                        <td key={h} className="p-0.5">
                                                            <div
                                                                className="w-full aspect-square rounded-md transition-all hover:scale-125 cursor-default"
                                                                style={{ backgroundColor: `rgba(59,130,246,${Math.max(0.05, intensity)})` }}
                                                                title={`${day} ${h}h: ${count} tickets`}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex items-center justify-end gap-2 mt-3 text-[9px] font-black text-slate-400">
                                    <div className="flex gap-1 items-center">
                                        {[0.1, 0.3, 0.6, 0.9].map(i => (
                                            <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: `rgba(59,130,246,${i})` }} />
                                        ))}
                                    </div>
                                    <span>Baixo → Alto</span>
                                </div>
                            </div>
                        );
                    })()}
                </motion.div>
            </div>

            {/* ─── NPS Score ──────────────────────────────────────────────── */}
            {stats && (() => {
                const pos = stats.sentimentDistribution.POSITIVE;
                const neg = stats.sentimentDistribution.NEGATIVE;
                const total = Object.values(stats.sentimentDistribution).reduce((a, b) => a + b, 0) || 1;
                const nps = Math.round(((pos - neg) / total) * 100);
                const npsColor = nps >= 50 ? 'text-emerald-500' : nps >= 0 ? 'text-amber-500' : 'text-red-500';
                const npsLabel = nps >= 75 ? 'Excelente 🚀' : nps >= 50 ? 'Bom 👍' : nps >= 0 ? 'Neutro 😐' : 'Crítico ⚠️';
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 }}
                        className="liquid-glass p-8 rounded-[3rem] shadow-xl flex items-center gap-8"
                    >
                        <div className="text-center flex-shrink-0 w-40">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">NPS Score</p>
                            <p className={`text-7xl font-black tracking-tighter ${npsColor}`}>{nps}</p>
                            <p className="text-xs font-black text-slate-500 mt-1">{npsLabel}</p>
                        </div>
                        <div className="flex-1 space-y-4">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Pesquisa de Satisfação</h3>
                            <p className="text-xs text-slate-500 font-bold">
                                NPS calculado com base nos {total} feedbacks coletados no período.
                                Um NPS acima de 50 indica excelente satisfação dos clientes.
                            </p>
                            <div className="flex gap-4">
                                {[
                                    { label: 'Promotores', count: pos, color: 'bg-emerald-500' },
                                    { label: 'Neutros', count: stats.sentimentDistribution.NEUTRAL, color: 'bg-amber-400' },
                                    { label: 'Detratores', count: neg, color: 'bg-red-500' },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${item.color}`} />
                                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.label}: <strong>{item.count}</strong></span>
                                    </div>
                                ))}
                            </div>
                            <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                                {[
                                    { count: pos, color: 'bg-emerald-500' },
                                    { count: stats.sentimentDistribution.NEUTRAL, color: 'bg-amber-400' },
                                    { count: neg, color: 'bg-red-500' },
                                ].map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(item.count / total) * 100}%` }}
                                        transition={{ duration: 1, delay: 1 + i * 0.2 }}
                                        className={`h-full ${item.color}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                );
            })()}
        </div>
    );
}
