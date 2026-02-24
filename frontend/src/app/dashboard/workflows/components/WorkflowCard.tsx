'use client';

import { motion } from 'framer-motion';
import {
    Play,
    Copy,
    Trash2,
    Power,
    PowerOff,
    Activity,
    Clock,
    Download
} from 'lucide-react';
import { WorkflowRule } from '../types/workflow.types';

interface WorkflowCardProps {
    rule: WorkflowRule;
    stats?: {
        totalExecutions: number;
        totalFailures: number;
        successRate: number;
        lastExecution: string | null;
    };
    onEdit: () => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onRun: (id: string) => void;
    onToggle: (id: string, status: boolean) => void;
    onSimulate: () => void;
    onExport: (rule: WorkflowRule) => void;
}

export default function WorkflowCard({
    rule,
    stats,
    onEdit,
    onDuplicate,
    onDelete,
    onRun,
    onToggle,
    onSimulate,
    onExport
}: WorkflowCardProps) {

    const successRate = stats?.successRate ?? 0;

    return (
        <motion.div
            whileHover={{ y: -6 }}
            transition={{ duration: 0.2 }}
            className="
                relative p-8 rounded-3xl 
                bg-white dark:bg-slate-900
                border border-slate-200 dark:border-white/10
                shadow-xl hover:shadow-2xl
                transition-all duration-300
                flex flex-col justify-between
                min-h-[260px]
            "
        >
            {/* STATUS BADGE */}
            <div className="absolute top-6 right-6">
                <span className={`
                    px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest
                    ${rule.isActive
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500'}
                `}>
                    {rule.isActive ? 'Ativa' : 'Inativa'}
                </span>
            </div>

            {/* HEADER */}
            <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                    {rule.name}
                </h3>

                <p className="text-xs text-slate-500 font-medium line-clamp-2">
                    {rule.description || 'Sem descrição definida'}
                </p>
            </div>

            {/* MÉTRICAS */}
            <div className="mt-6 space-y-3">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Execuções</span>
                    <span>{stats?.totalExecutions ?? 0}</span>
                </div>

                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Taxa de Sucesso</span>
                    <span className={successRate >= 80 ? 'text-emerald-500' : 'text-amber-500'}>
                        {successRate.toFixed(1)}%
                    </span>
                </div>

                {stats?.lastExecution && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Clock size={12} />
                        Última execução: {new Date(stats.lastExecution).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* ACTIONS */}
            <div className="mt-8 flex flex-wrap gap-2">

                <button
                    onClick={() => onRun(rule.id)}
                    className="flex-1 bg-primary text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                    <Play size={14} />
                    Executar
                </button>

                <button
                    onClick={() => onEdit()}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all"
                >
                    Editar
                </button>

                <button
                    onClick={() => onDuplicate(rule.id)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all"
                    title="Duplicar"
                >
                    <Copy size={14} />
                </button>

                <button
                    onClick={() => onExport(rule)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:scale-105 transition-all"
                    title="Exportar JSON"
                >
                    <Download size={14} />
                </button>

                <button
                    onClick={() => onToggle(rule.id, !rule.isActive)}
                    className={`
                        px-3 py-2 rounded-xl transition-all
                        ${rule.isActive
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-emerald-500/10 text-emerald-500'}
                    `}
                >
                    {rule.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                </button>

                <button
                    onClick={() => onDelete(rule.id)}
                    className="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 hover:scale-105 transition-all"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </motion.div>
    );
}
