'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Zap,
    Settings,
    Play,
    Copy,
    Trash2,
    Eye,
    MoreVertical,
    Activity,
    Clock,
    CheckCircle2,
    AlertCircle,
    TestTube,
    Globe
} from 'lucide-react';
import { WorkflowRule, WorkflowStats } from '@/app/dashboard/workflows/types/workflow.types';

interface WorkflowCardProps {
    rule: WorkflowRule;
    stats?: WorkflowStats;
    onEdit: (rule: WorkflowRule) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onRun: (id: string) => void;
    onToggle: (id: string, active: boolean) => void;
    onSimulate: (id: string) => void;
}

export default function WorkflowCard({
    rule,
    stats,
    onEdit,
    onDuplicate,
    onDelete,
    onRun,
    onToggle,
    onSimulate
}: WorkflowCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="liquid-glass dark:bg-transparent p-8 rounded-[3.5rem] relative overflow-hidden group hover:scale-[1.02] transition-all border border-slate-200 dark:border-white/10 shadow-2xl"
        >
            {/* Status & Environment Badges */}
            <div className="absolute top-8 right-8 flex gap-2">
                <div className={`px-4 py-2 rounded-2xl text-[9px] font-black tracking-widest uppercase border flex items-center gap-2 ${rule.environment === 'PRODUCTION'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                    {rule.environment === 'PRODUCTION' ? <Globe size={10} /> : <TestTube size={10} />}
                    {rule.environment}
                </div>
                <button
                    onClick={() => onToggle(rule.id, !rule.isActive)}
                    className={`px-4 py-2 rounded-2xl text-[9px] font-black tracking-widest uppercase border transition-all ${rule.isActive
                        ? 'bg-primary/20 text-primary border-primary/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                        }`}
                >
                    {rule.isActive ? 'Live' : 'Off'}
                </button>
            </div>

            {/* Icon & Name */}
            <div className="flex items-center gap-6 mb-8">
                <div className="h-16 w-16 bg-primary text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40 group-hover:rotate-12 transition-all">
                    <Zap size={32} fill="currentColor" stroke="none" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter">
                        {rule.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority:</span>
                        <span className={`text-[9px] font-black uppercase ${rule.priority > 50 ? 'text-red-500' : 'text-primary'}`}>{rule.priority}</span>
                        <span className="text-slate-300 dark:text-white/10 mx-1">|</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">v{rule.version}</span>
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-8 line-clamp-2 italic opacity-60">
                {rule.description || 'Nenhuma descrição fornecida.'}
            </p>

            {/* Micro Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8 pt-6 border-t border-slate-100 dark:border-white/5">
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Taxa de Sucesso</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{stats?.successRate || 0}%</span>
                        <div className="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${(stats?.successRate || 0) > 80 ? 'bg-emerald-500' : (stats?.successRate || 0) > 50 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${stats?.successRate || 0}%` }}
                            />
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Última Execução</span>
                    <span className="text-[10px] font-black text-slate-900 dark:text-white italic">
                        {stats?.lastExecution ? new Date(stats.lastExecution).toLocaleDateString() : 'Nunca'}
                    </span>
                </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex gap-4">
                <button
                    onClick={() => onRun(rule.id)}
                    className="flex-1 py-4 bg-primary text-white font-black text-[9px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Play size={14} fill="currentColor" /> Executar
                </button>
                <button
                    onClick={() => onEdit(rule)}
                    className="px-5 py-4 liquid-glass border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white rounded-2xl hover:bg-white dark:hover:bg-white/5 transition-all"
                >
                    <Settings size={18} />
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="px-5 py-4 liquid-glass border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white rounded-2xl hover:bg-white dark:hover:bg-white/5 transition-all"
                    >
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute bottom-full right-0 mb-4 w-48 liquid-glass dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-3 z-20 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                <button
                                    onClick={() => { onSimulate(rule.id); setShowMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 text-primary rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    <TestTube size={14} /> Simular
                                </button>
                                <button
                                    onClick={() => { onDuplicate(rule.id); setShowMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    <Copy size={14} /> Duplicar
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />
                                <button
                                    onClick={() => { onDelete(rule.id); setShowMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    <Trash2 size={14} /> Excluir
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
