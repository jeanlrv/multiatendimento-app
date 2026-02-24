'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Terminal, Database, Code, CheckCircle2, AlertCircle, TestTube } from 'lucide-react';

interface SimulateModalProps {
    isOpen: boolean;
    onClose: () => void;
    ruleId: string;
    ruleName: string;
    onSimulate: (data: { payload: any; event: string }) => Promise<any>;
}

export default function SimulateModal({ isOpen, onClose, ruleId, ruleName, onSimulate }: SimulateModalProps) {
    const [payload, setPayload] = useState('{\n  "ticketId": "123",\n  "type": "ticket.created",\n  "customer": "Jean",\n  "message": "Olá, preciso de ajuda"\n}');
    const [event, setEvent] = useState('ticket.created');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleSimulate = async () => {
        setLoading(true);
        try {
            const parsedPayload = JSON.parse(payload);
            const data = await onSimulate({ payload: parsedPayload, event });
            setResult(data);
        } catch (e: any) {
            alert('Erro no JSON ou na simulação: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-4xl bg-white dark:bg-[#0B0F17] rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10"
                >
                    <div className="flex h-[600px]">
                        {/* Form Side */}
                        <div className="flex-1 p-10 flex flex-col">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-14 w-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/5">
                                    <TestTube size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                                        Simulador <span className="text-primary">Aero</span>
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regra: {ruleName}</p>
                                </div>
                            </div>

                            <div className="space-y-6 flex-1">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Database size={10} /> Gatilho do Evento
                                    </label>
                                    <input
                                        type="text"
                                        value={event}
                                        onChange={(e) => setEvent(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold text-xs"
                                        placeholder="ex: ticket.created"
                                    />
                                </div>

                                <div className="space-y-2 flex-1 flex flex-col">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Code size={10} /> Simular Payload (JSON)
                                    </label>
                                    <textarea
                                        value={payload}
                                        onChange={(e) => setPayload(e.target.value)}
                                        className="flex-1 w-full px-6 py-4 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/10 rounded-[2rem] outline-none focus:ring-2 focus:ring-primary/20 font-mono text-[11px] text-primary no-scrollbar resize-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="px-8 py-4 liquid-glass border border-slate-200 dark:border-white/10 text-slate-500 rounded-2xl font-black text-[9px] uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSimulate}
                                    disabled={loading}
                                    className="flex-1 py-4 bg-primary text-white font-black text-[9px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Simulando...' : <><Play size={14} fill="currentColor" /> Disparar Teste</>}
                                </button>
                            </div>
                        </div>

                        {/* Result Side */}
                        <div className="w-[350px] bg-slate-50 dark:bg-white/5 border-l border-slate-200 dark:border-white/10 p-10 overflow-y-auto no-scrollbar">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2 italic">
                                <Terminal size={14} /> Resultado da Simulação
                            </h3>

                            {result ? (
                                <div className="space-y-8">
                                    <div className={`p-6 rounded-3xl border ${result.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
                                        }`}>
                                        <div className="flex items-center gap-3 mb-2 font-black text-xs">
                                            {result.success ? <CheckCircle2 className="text-emerald-500" /> : <AlertCircle className="text-red-500" />}
                                            {result.success ? 'SUCESSO' : 'FALHA'}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 italic">
                                            {result.conditionsMet ? 'Todas as condições foram atendidas.' : 'Gatilho ignorado: condições não atendidas.'}
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações Previstas:</span>
                                        {result.actions?.map((action: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 p-4 liquid-glass rounded-2xl border border-white/10">
                                                <div className={`h-2 rounded-full ${action.status === 'would_execute' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                                                    {action.type}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                    <TestTube size={48} className="mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Aguardando disparo...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
