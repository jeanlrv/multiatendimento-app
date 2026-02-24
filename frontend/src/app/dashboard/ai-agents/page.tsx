'use client';

import { useState, useEffect } from 'react';
import { AIAgentsService, AIAgent } from '@/services/ai-agents';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Pencil, Trash2, CheckCircle, XCircle, Settings, X, RefreshCcw, Save, Shield, Activity, Share2 } from 'lucide-react';

export default function AIAgentsPage() {
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAgent, setCurrentAgent] = useState<Partial<AIAgent> | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchAgents = async () => {
        try {
            setLoading(true);
            const data = await AIAgentsService.findAll();
            setAgents(data);
        } catch (error) {
            console.error('Erro ao buscar agentes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            if (currentAgent?.id) {
                await AIAgentsService.update(currentAgent.id, currentAgent);
            } else {
                await AIAgentsService.create(currentAgent!);
            }
            setIsModalOpen(false);
            fetchAgents();
        } catch (error) {
            console.error('Erro ao salvar agente:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir o processamento cognitivo deste agente?')) {
            try {
                await AIAgentsService.remove(id);
                fetchAgents();
            } catch (error) {
                console.error('Erro ao excluir agente:', error);
            }
        }
    };

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Bot className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Rede <span className="text-primary italic">Neural</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        Gerenciamento de Inteligência Artificial KSZap
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setCurrentAgent({ name: '', anythingllmWorkspaceId: '', isActive: true });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest group"
                    >
                        <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                        <span className="hidden sm:inline">Acionar IA</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 px-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 glass-heavy rounded-[2.5rem] animate-pulse" />
                    ))}
                </div>
            ) : agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 mx-4 relative z-10">
                    <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(2,132,199,0.2)]">
                        <Bot className="h-12 w-12 text-primary opacity-40" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">Intelecto Nulo</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-12 text-center max-w-sm leading-relaxed italic opacity-80">
                        Nenhum agente cognitivo vinculado. Conecte seu workspace AnythingLLM para dar vida ao Aero.
                    </p>
                    <button
                        onClick={() => {
                            setCurrentAgent({ name: '', anythingllmWorkspaceId: '', isActive: true });
                            setIsModalOpen(true);
                        }}
                        className="px-14 py-5 bg-primary text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Criar Conexão Neural
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                    <AnimatePresence>
                        {agents.map((agent, index) => (
                            <motion.div
                                key={agent.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.4, delay: index * 0.05 }}
                                className="glass-heavy p-8 rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-2xl hover:shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] transition-all group relative overflow-hidden flex flex-col h-[280px]"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />

                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div className={`p-4 rounded-2xl ${agent.isActive ? 'bg-primary shadow-[0_10px_30px_rgba(2,132,199,0.3)]' : 'bg-slate-400 shadow-lg'} text-white`}>
                                        <Bot size={28} />
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => {
                                                setCurrentAgent(agent);
                                                setIsModalOpen(true);
                                            }}
                                            className="h-10 w-10 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-primary hover:text-white text-primary rounded-[1.2rem] shadow-lg transition-all border border-slate-100 dark:border-white/10"
                                            title="Configurar IA"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(agent.id)}
                                            className="h-10 w-10 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-rose-500 hover:text-white text-rose-500 rounded-[1.2rem] shadow-lg transition-all border border-slate-100 dark:border-white/10"
                                            title="Desativar IA"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 relative z-10">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight italic truncate flex items-center gap-2">
                                        {agent.name}
                                        {agent.isActive && <Shield size={16} className="text-primary animate-pulse" />}
                                    </h3>
                                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic opacity-80 border-l-2 border-primary/20 pl-4 mb-4">
                                        {agent.description || 'Processamento cognitivo neural em modo de espera.'}
                                    </p>
                                </div>

                                <div className="mt-auto pt-6 border-t border-slate-100 dark:border-white/5 space-y-4 relative z-10">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <Share2 size={14} className="text-primary/60" /> Workspace
                                        </span>
                                        <span className="font-mono text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-xl text-[11px] truncate max-w-[140px]" title={agent.anythingllmWorkspaceId}>
                                            {agent.anythingllmWorkspaceId}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={14} className={agent.isActive ? 'text-primary/60' : 'text-slate-400/60'} /> Status
                                        </span>
                                        <span className={`flex items-center gap-1.5 font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${agent.isActive ? 'text-primary bg-primary/10' : 'text-slate-500 bg-slate-100 dark:bg-white/5'}`}>
                                            {agent.isActive ? (
                                                <>Operacional</>
                                            ) : (
                                                <>Inativo</>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal Aero Integrado */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative w-full max-w-2xl liquid-glass dark:bg-slate-900/95 rounded-[3rem] shadow-2xl overflow-hidden border border-white/80 dark:border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-10 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-primary/5">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                                        <Bot size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                                            {currentAgent?.id ? 'Calibrar' : 'Embutir'} <span className="text-primary">IA</span>
                                        </h3>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Sintonização Neural de Workspace</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white/50 dark:hover:bg-white/10 rounded-2xl transition-all">
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-10 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Codinome do Agente</label>
                                        <input
                                            required
                                            value={currentAgent?.name || ''}
                                            onChange={e => setCurrentAgent({ ...currentAgent, name: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400 uppercase"
                                            placeholder="Ex: IA Jurídica Aero"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block flex items-center gap-2">
                                            Workspace <span className="text-[10px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full">AnythingLLM</span>
                                        </label>
                                        <input
                                            required
                                            value={currentAgent?.anythingllmWorkspaceId || ''}
                                            onChange={e => setCurrentAgent({ ...currentAgent, anythingllmWorkspaceId: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400 font-mono tracking-tight"
                                            placeholder="slug-do-workspace"
                                        />
                                    </div>

                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Diretriz de IA</label>
                                        <textarea
                                            value={currentAgent?.description || ''}
                                            onChange={e => setCurrentAgent({ ...currentAgent, description: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl px-6 py-5 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400 h-32 resize-none italic"
                                            placeholder="Especifique a função principal que esta IA deve assumir..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-4 border-t border-slate-100 dark:border-white/5 pt-8">
                                    <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setCurrentAgent({ ...currentAgent, isActive: !currentAgent?.isActive })}>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={currentAgent?.isActive}
                                                readOnly
                                                className="w-6 h-6 rounded-lg border-transparent text-primary bg-slate-200 dark:bg-white/10 focus:ring-0 pointer-events-none"
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest italic select-none">
                                            IA Disponível para Células
                                        </span>
                                    </div>

                                    <div className="flex gap-4 min-w-[300px]">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 py-4.5 rounded-2xl border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-500 shadow-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-[2] py-4.5 rounded-2xl bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {submitting ? (
                                                <RefreshCcw className="animate-spin h-5 w-5" />
                                            ) : (
                                                <>
                                                    <Save size={18} /> Sincronizar IA
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
