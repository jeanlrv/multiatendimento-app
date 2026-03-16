'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { AIAgent } from '@/services/ai-agents';
import { Bot, Plus, Trash2, Settings, Shield, Activity, Cpu } from 'lucide-react';

type Props = {
    agents: AIAgent[];
    loading: boolean;
    openModal: (agent: Partial<AIAgent>) => void;
    handleDelete: (id: string) => void;
    getModelDisplayName: (modelId?: string) => string;
    availableModels: { provider: string; providerName: string; models: { id: string; name: string }[] }[];
    embeddingProviders: { id: string; name: string; models: { id: string; name: string; dimensions: number }[] }[];
};

export function AgentListView({ agents, loading, openModal, handleDelete, getModelDisplayName, availableModels, embeddingProviders }: Props) {
    const defaultModelId = availableModels[0]?.models[0]?.id || 'gpt-4o-mini';
    const defaultEmbProv = embeddingProviders[0]?.id || 'native';
    const defaultEmbModel = embeddingProviders[0]?.models[0]?.id || 'Xenova/all-MiniLM-L6-v2';

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Bot className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Rede <span className="text-primary italic">Neural</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        Gerenciamento de Inteligência Artificial
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => openModal({
                            name: '',
                            modelId: defaultModelId,
                            temperature: 0.7,
                            isActive: true,
                            embeddingProvider: defaultEmbProv,
                            embeddingModel: defaultEmbModel,
                        })}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest group"
                    >
                        <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                        <span className="hidden sm:inline">Criar Agente</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 px-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-heavy rounded-[2.5rem] p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-3.5 w-20" />
                                </div>
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                            <div className="flex gap-2 pt-2">
                                <Skeleton className="h-6 w-16 rounded-full" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Skeleton className="h-9 flex-1 rounded-xl" />
                                <Skeleton className="h-9 w-9 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 mx-4 relative z-10">
                    <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(2,132,199,0.2)]">
                        <Bot className="h-12 w-12 text-primary opacity-40" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">Intelecto Nulo</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-12 text-center max-w-sm leading-relaxed italic opacity-80">
                        Nenhum agente cognitivo vinculado. Crie um agente e forneça conhecimento para ele operar.
                    </p>
                    <button
                        onClick={() => openModal({ name: '', modelId: 'gpt-4o-mini', temperature: 0.7, isActive: true, embeddingProvider: 'native', embeddingModel: 'Xenova/all-MiniLM-L6-v2' })}
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
                                            onClick={() => openModal(agent)}
                                            className="h-10 w-10 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-primary hover:text-white text-primary rounded-[1.2rem] shadow-lg transition-all border border-slate-100 dark:border-white/10"
                                            title="Configurar IA"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(agent.id)}
                                            className="h-10 w-10 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-rose-500 hover:text-white text-rose-500 rounded-[1.2rem] shadow-lg transition-all border border-slate-100 dark:border-white/10"
                                            title="Excluir Agente"
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
                                            <Cpu size={14} className="text-primary/60" /> Modelo
                                        </span>
                                        <span className="font-mono text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-xl text-[11px] truncate max-w-[180px]" title={agent.modelId || 'gpt-4o-mini'}>
                                            {getModelDisplayName(agent.modelId)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={14} className={agent.isActive ? 'text-primary/60' : 'text-slate-400/60'} /> Status
                                        </span>
                                        <span className={`flex items-center gap-1.5 font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${agent.isActive ? 'text-primary bg-primary/10' : 'text-slate-500 bg-slate-100 dark:bg-white/5'}`}>
                                            {agent.isActive ? 'Operacional' : 'Inativo'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
