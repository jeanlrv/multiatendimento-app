'use client';

import { useState, useEffect } from 'react';
import { AIAgentsService } from '@/services/ai-agents';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Database, Zap, MessageSquare, TrendingUp, Calendar, Bot, Cpu } from 'lucide-react';

export default function AIMetricsPage() {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setLoading(true);
                const data = await AIAgentsService.getMetrics();
                setMetrics(data);
            } catch (error) {
                console.error('Erro ao buscar métricas:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <p className="text-gray-500">Nenhuma métrica disponível</p>
            </div>
        );
    }

    // Preparar dados para os gráficos
    const dailyUsageData = metrics.dailyUsage.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('pt-BR'),
        tokens: parseInt(item.tokens),
        calls: parseInt(item.calls)
    }));

    const agentUsageData = metrics.agentUsage.map((item: any) => ({
        name: item.agentname,
        tokens: parseInt(item.tokens),
        calls: parseInt(item.calls)
    }));

    const modelUsageData = metrics.modelUsage.map((item: any) => ({
        name: item.model,
        tokens: parseInt(item.tokens),
        calls: parseInt(item.calls)
    }));

    // Cores para os gráficos
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <TrendingUp className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Métricas <span className="text-primary italic">Inteligência</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Zap size={14} className="text-primary" />
                        Análise de desempenho e uso da IA
                    </p>
                </div>
            </div>

            {/* Métricas Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Zap size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Tokens Totais</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                {metrics.usage.totalTokens?.toLocaleString('pt-BR') || 0}
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Chamadas</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                {metrics.usage.totalCalls?.toLocaleString('pt-BR') || 0}
                            </p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Database size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Custo Estimado</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                ${(metrics.usage.totalCost || 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 relative z-10">
                {/* Uso Diário */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight italic flex items-center gap-2">
                        <Calendar size={18} className="text-primary" /> Uso Diário (30 dias)
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyUsageData}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value) => [value.toLocaleString('pt-BR'), 'Valor']}
                                    labelFormatter={(label) => `Data: ${label}`}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="tokens"
                                    name="Tokens"
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="calls"
                                    name="Chamadas"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Uso por Agente */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl"
                >
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight italic flex items-center gap-2">
                        <Bot size={18} className="text-primary" /> Uso por Agente
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={agentUsageData}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value) => [value.toLocaleString('pt-BR'), 'Valor']}
                                />
                                <Legend />
                                <Bar dataKey="tokens" name="Tokens" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="calls" name="Chamadas" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Uso por Modelo */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-heavy p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-xl lg:col-span-2"
                >
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight italic flex items-center gap-2">
                        <Cpu size={18} className="text-primary" /> Uso por Modelo
                    </h3>
                    <div className="h-80 flex items-center justify-center">
                        <ResponsiveContainer width="50%" height="100%">
                            <PieChart>
                                <Pie
                                    data={modelUsageData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="tokens"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                    {modelUsageData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [value.toLocaleString('pt-BR'), 'Tokens']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                        <ResponsiveContainer width="50%" height="100%">
                            <PieChart>
                                <Pie
                                    data={modelUsageData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={true}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="calls"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                    {modelUsageData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [value.toLocaleString('pt-BR'), 'Chamadas']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
