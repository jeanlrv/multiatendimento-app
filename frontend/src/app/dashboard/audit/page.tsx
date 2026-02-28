'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScrollText,
    Search,
    Filter,
    User,
    Clock,
    History,
    Activity,
    ChevronDown,
    Calendar,
    ArrowRight
} from 'lucide-react';

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    changes: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('ALL');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const response = await api.get('/audit');
            setLogs(response.data);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro ao buscar logs de auditoria';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEntity = selectedEntity === 'ALL' || log.entity === selectedEntity;
        return matchesSearch && matchesEntity;
    });

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-green-600 bg-green-100 dark:bg-green-500/10';
            case 'UPDATE': return 'text-blue-600 bg-blue-100 dark:bg-blue-500/10';
            case 'DELETE': return 'text-red-600 bg-red-100 dark:bg-red-500/10';
            case 'RESOLVE': return 'text-purple-600 bg-purple-100 dark:bg-purple-500/10';
            default: return 'text-gray-600 bg-gray-100 dark:bg-gray-500/10';
        }
    };

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-8 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                        <History className="text-blue-600" size={32} /> Histórico de Auditoria
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium italic">Rastreabilidade completa de todas as ações e mudanças no sistema</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar logs..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total de Logs', value: logs.length, icon: ScrollText, color: 'blue' },
                    { label: 'Alterações Hoje', value: logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, icon: Activity, color: 'green' },
                    { label: 'Entidades Ativas', value: new Set(logs.map(l => l.entity)).size, icon: Filter, color: 'purple' },
                    { label: 'Ações de Admin', value: logs.filter(l => l.action === 'UPDATE' || l.action === 'CREATE').length, icon: User, color: 'orange' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card p-6 rounded-3xl border border-white/20 shadow-sm"
                    >
                        <stat.icon className={`text-${stat.color}-500 mb-2`} size={24} />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Logs Table Area */}
            <div className="glass-card rounded-[2.5rem] border border-white/20 shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blur-3xl -z-10" />

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Usuário / Ação</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Entidade / ID</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Data & Hora</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Mudanças</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-8 py-10"><div className="h-4 bg-gray-200 dark:bg-white/5 rounded w-full" /></td>
                                    </tr>
                                ))
                            ) : (
                                filteredLogs.map((log) => (
                                    <motion.tr
                                        key={log.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors group"
                                    >
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-lg">
                                                    {log.user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{log.user.name}</p>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter mt-1 inline-block ${getActionColor(log.action)}`}>
                                                        {log.action}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{log.entity}</span>
                                                <span className="text-[10px] font-medium text-gray-400 mt-1 font-mono truncate max-w-[150px]">{log.entityId}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={14} className="text-gray-400" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                        {new Date(log.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-gray-400">
                                                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="max-w-[250px] overflow-hidden">
                                                    <pre className="text-[9px] font-mono text-gray-500 bg-gray-50 dark:bg-white/5 p-2 rounded-lg truncate">
                                                        {JSON.stringify(log.changes, null, 2)}
                                                    </pre>
                                                </div>
                                                <button className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-full transition-all text-gray-400 group-hover:text-blue-600 group-hover:scale-110">
                                                    <ArrowRight size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
