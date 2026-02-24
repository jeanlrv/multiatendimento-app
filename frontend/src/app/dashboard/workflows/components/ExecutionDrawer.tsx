'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Clock, Terminal, ChevronRight, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { WorkflowExecution } from '@/app/dashboard/workflows/types/workflow.types';

interface ExecutionDrawerProps {
    execution: WorkflowExecution | null;
    onClose: () => void;
}

export default function ExecutionDrawer({ execution, onClose }: ExecutionDrawerProps) {
    if (!execution) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                />

                {/* Drawer Content */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="relative w-full max-w-2xl h-full bg-white dark:bg-[#0B0F17] shadow-2xl overflow-y-auto no-scrollbar border-l border-slate-200 dark:border-white/5"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0B0F17]/80 backdrop-blur-md z-10">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                                    Observabilidade <span className="text-primary">Aero</span>
                                </h2>
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${execution.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {execution.status}
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {execution.id}</p>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="p-8 space-y-10">
                        {/* Meta Grid */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="liquid-glass p-6 rounded-3xl border border-white/10">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Duração</span>
                                <div className="flex items-center gap-2 font-black text-lg text-slate-900 dark:text-white italic">
                                    <Clock size={14} className="text-primary" /> {execution.duration || 0}ms
                                </div>
                            </div>
                            <div className="liquid-glass p-6 rounded-3xl border border-white/10">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Trigger</span>
                                <div className="flex items-center gap-2 font-black text-lg text-slate-900 dark:text-white italic">
                                    <Activity size={14} className="text-emerald-500" /> Webhook
                                </div>
                            </div>
                            <div className="liquid-glass p-6 rounded-3xl border border-white/10">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target</span>
                                <div className="flex items-center gap-2 font-black text-lg text-slate-900 dark:text-white italic">
                                    <Terminal size={14} className="text-amber-500" /> {execution.entityId.slice(0, 8)}...
                                </div>
                            </div>
                        </div>

                        {/* Logs Section */}
                        <section className="space-y-6">
                            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3 italic">
                                <Terminal size={14} /> Trilha de Execução (Logs)
                            </h3>
                            <div className="space-y-4">
                                {execution.logs.map((log: any, idx: number) => (
                                    <div key={idx} className="flex gap-6 group">
                                        <div className="flex flex-col items-center">
                                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${log.level === 'info' ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-red-500/5 border-red-500/20 text-red-500'
                                                }`}>
                                                {log.level === 'info' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                            </div>
                                            {idx !== execution.logs.length - 1 && <div className="w-px flex-1 bg-slate-100 dark:bg-white/5 my-2" />}
                                        </div>
                                        <div className="flex-1 pb-8">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                                    Action: {log.action}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-400">
                                                    {log.duration ? `${log.duration}ms` : ''}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 italic">
                                                {log.message}
                                            </p>
                                            {log.error && (
                                                <div className="mt-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-[10px] font-mono text-red-500 opacity-80 overflow-x-auto whitespace-pre">
                                                    {log.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Payloads */}
                        <section className="space-y-6">
                            <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-3 italic">
                                <Terminal size={14} /> Payload & Context JSON
                            </h3>
                            <div className="liquid-glass dark:bg-black/40 p-6 rounded-[2.5rem] border border-white/10 font-mono text-[10px] text-primary overflow-x-auto max-h-[300px] no-scrollbar">
                                <pre>{JSON.stringify(execution.steps, null, 2)}</pre>
                            </div>
                        </section>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-8 border-t border-slate-100 dark:border-white/5 flex gap-4 sticky bottom-0 bg-white dark:bg-[#0B0F17]">
                        <button className="flex-1 py-4 bg-primary text-white font-black text-[9px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                            Tentar Novamente (Retry)
                        </button>
                        <button className="px-6 py-4 liquid-glass border border-slate-200 dark:border-white/10 text-red-500 rounded-2xl hover:bg-red-500/5 transition-all">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
