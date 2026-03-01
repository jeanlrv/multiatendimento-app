'use client';

import { useState, useEffect } from 'react';
import { AIAgentsService, AIAgent, AIProviderModels } from '@/services/ai-agents';
import { AIKnowledgeService, KnowledgeBase } from '@/services/ai-knowledge';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Trash2, CheckCircle, Settings, X, RefreshCcw, Save, Shield, Activity, Brain, Database, MessageSquare, Zap, Cpu, Globe, Key, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import WidgetConfigTab from './components/WidgetConfigTab';
import ApiKeysSection from './components/ApiKeysSection';

export default function AIAgentsPage() {
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
    const [availableModels, setAvailableModels] = useState<AIProviderModels[]>([]);
    const [embeddingProviders, setEmbeddingProviders] = useState<{ id: string; name: string; models: { id: string; name: string; dimensions: number }[] }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentAgent, setCurrentAgent] = useState<Partial<AIAgent> | null>(null);
    const [originalAgent, setOriginalAgent] = useState<Partial<AIAgent> | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'cognitive' | 'knowledge' | 'playground' | 'widget' | 'api'>('basic');
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
    const [chatLoading, setChatLoading] = useState(false);

    const isDirty = JSON.stringify(currentAgent) !== JSON.stringify(originalAgent);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [agentsData, kbData, modelsData, embProviders] = await Promise.all([
                AIAgentsService.findAll(),
                AIKnowledgeService.findAllBases(),
                AIAgentsService.getModels().catch((e) => {
                    console.error('Falha crítica ao buscar Modelos LLMs:', e);
                    toast.error('Erro ao listar opções de modelos de IA.');
                    return [];
                }),
                AIAgentsService.getEmbeddingProviders().catch((e) => {
                    console.error('Falha crítica ao buscar Embedding Providers:', e);
                    toast.error('Erro ao listar providers de embedding.');
                    // Garante que o fallback do Native no mínimo seja gerado em falhas severas
                    return [{ id: 'native', name: 'Nativo (built-in CPU)', models: [{ id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', dimensions: 384 }] }];
                }),
            ]);
            setAgents(agentsData);
            setKnowledgeBases(kbData);
            setAvailableModels(modelsData);
            setEmbeddingProviders(embProviders);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModal = (agent: Partial<AIAgent>) => {
        setCurrentAgent(agent);
        setOriginalAgent(agent);
        setActiveTab('basic');
        setChatHistory([]);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (isDirty) {
            toast('Descartar alterações não salvas?', {
                action: { label: 'Descartar', onClick: () => setIsModalOpen(false) },
                cancel: { label: 'Continuar editando', onClick: () => { } },
                duration: 5000,
            });
        } else {
            setIsModalOpen(false);
        }
    };

    const handleChatTest = async () => {
        if (!chatMessage || !currentAgent?.id) return;

        setChatLoading(true);
        const userMsg = { role: 'user', content: chatMessage };
        const updatedHistory = [...chatHistory, userMsg];
        setChatHistory(updatedHistory);
        setChatMessage('');

        try {
            const response = await AIAgentsService.chat(currentAgent.id, userMsg.content, updatedHistory.slice(0, -1));
            setChatHistory(prev => [...prev, { role: 'assistant', content: typeof response === 'string' ? response : (response as any)?.textResponse || 'Sem resposta' }]);
        } catch {
            setChatHistory(prev => [...prev, { role: 'assistant', content: 'Erro ao processar mensagem.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            if (currentAgent?.id) {
                // Remover campos não pertencentes ao DTO (retornados pelo Prisma mas não aceitos na atualização)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: _id, companyId: _co, createdAt: _cr, updatedAt: _up, embedId: _ei, allowModelDowngrade: _amd, limitTokensPerDay: _ltd, ...payload } = currentAgent as any;
                await AIAgentsService.update(currentAgent.id, payload);
                toast.success('Agente atualizado com sucesso');
            } else {
                await AIAgentsService.create(currentAgent!);
                toast.success('Agente criado com sucesso');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Erro ao salvar agente:', error);
            toast.error('Erro ao salvar agente');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        toast('Excluir este agente de IA?', {
            action: {
                label: 'Excluir', onClick: async () => {
                    try {
                        await AIAgentsService.remove(id);
                        fetchData();
                        toast.success('Agente excluído');
                    } catch (error) {
                        console.error('Erro ao excluir agente:', error);
                        toast.error('Erro ao excluir agente');
                    }
                }
            },
            cancel: { label: 'Cancelar', onClick: () => { } },
            duration: 5000,
        });
    };

    const getModelDisplayName = (modelId?: string) => {
        if (!modelId) return 'Não configurado';

        for (const provider of availableModels) {
            const model = provider.models.find(m => m.id === modelId);
            if (model) return model.name;
        }

        // Se não encontrar no mapping, tenta limpar o ID (remover prefixo provider:)
        const parts = modelId.split(':');
        return parts.length > 1 ? parts[1] : modelId;
    };

    const getProviderName = (modelId?: string) => {
        if (!modelId) return availableModels[0]?.providerName || '—';
        for (const provider of availableModels) {
            if (provider.models.some(m => m.id === modelId)) return provider.providerName;
        }
        return modelId.split(':')[0] || 'Desconhecido';
    };

    const currentEmbeddingProvider = (currentAgent as any)?.embeddingProvider || 'native';
    const embeddingModelsForProvider = embeddingProviders.find(p => p.id === currentEmbeddingProvider)?.models
        || (embeddingProviders.find(p => p.id === 'native')?.models)
        || (embeddingProviders.length > 0 ? embeddingProviders[0].models : []);

    // Garantir que um modelo padrão esteja selecionado ao mudar o provider
    useEffect(() => {
        if (isModalOpen && currentAgent) {
            const currentModels = embeddingProviders.find(p => p.id === currentEmbeddingProvider)?.models || [];
            if (currentModels.length > 0 && !(currentAgent as any).embeddingModel) {
                setCurrentAgent(prev => ({ ...prev, embeddingModel: currentModels[0].id } as any));
            }
        }
    }, [currentEmbeddingProvider, embeddingProviders, isModalOpen]);

    if (!isModalOpen) return (
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
                        onClick={() => openModal({ name: '', modelId: 'gpt-4o-mini', temperature: 0.7, isActive: true, embeddingProvider: 'native', embeddingModel: 'Xenova/all-MiniLM-L6-v2' })}
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

    return (
        <div className="w-full relative z-10 p-4 transition-all">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-5xl mx-auto liquid-glass dark:bg-slate-900/95 rounded-[3rem] shadow-2xl overflow-hidden border border-white/80 dark:border-white/10 flex flex-col min-h-[calc(100vh-8rem)]"
            >
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-4">
                        <button onClick={closeModal} className="p-3 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all shadow-sm text-slate-500 mr-2">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg">
                            <Bot size={24} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-2">
                                {currentAgent?.id ? 'Calibrar' : 'Criar'} <span className="text-primary">Agente</span>
                                {isDirty && <span className="text-amber-500 text-xl" title="Alterações não salvas">*</span>}
                            </h3>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Configuração do Motor Cognitivo</p>
                        </div>
                    </div>
                    <button onClick={closeModal} className="p-4 hover:bg-white/50 dark:hover:bg-white/10 rounded-2xl transition-all">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex px-8 mt-4 border-b border-slate-100 dark:border-white/5 overflow-x-auto no-scrollbar custom-scrollbar">
                    {[
                        { id: 'basic', label: 'Básico', icon: Bot },
                        { id: 'cognitive', label: 'Cérebro', icon: Brain },
                        { id: 'knowledge', label: 'Conhecimento', icon: Database },
                        { id: 'widget', label: 'Widget', icon: Globe },
                        { id: 'api', label: 'API', icon: Key },
                        { id: 'playground', label: 'Playground', icon: MessageSquare }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === tab.id ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    <form onSubmit={handleSave} className="space-y-8">
                        {activeTab === 'basic' && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Codinome do Agente</label>
                                    <input
                                        required
                                        value={currentAgent?.name || ''}
                                        onChange={e => setCurrentAgent({ ...currentAgent, name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400 uppercase"
                                        placeholder="Ex: Assistente Jurídico"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Descrição Curta</label>
                                    <input
                                        value={currentAgent?.description || ''}
                                        onChange={e => setCurrentAgent({ ...currentAgent, description: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400"
                                        placeholder="Breve descrição do propósito deste agente"
                                    />
                                </div>

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
                                        Agente Ativo e Operacional
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'cognitive' && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Modelo de Linguagem (LLM)</label>
                                    {availableModels.length === 0 ? (
                                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                                            <span className="text-xl flex-shrink-0">⚠️</span>
                                            <div>
                                                <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">Nenhum provider de IA configurado</p>
                                                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                                    Configure pelo menos um provider em{' '}
                                                    <a href="/dashboard/settings" className="underline font-bold">Configurações → IA &amp; Modelos</a>
                                                    {' '}para selecionar um modelo.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <select
                                                value={currentAgent?.modelId || availableModels[0]?.models[0]?.id || ''}
                                                onChange={e => setCurrentAgent({ ...currentAgent, modelId: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none transition-all dark:text-white appearance-none focus:ring-4 focus:ring-primary/10"
                                            >
                                                {availableModels.map(provider => (
                                                    <optgroup key={provider.provider} label={`🔌 ${provider.providerName}`} className="dark:bg-slate-800 dark:text-slate-300">
                                                        {provider.models.map(model => (
                                                            <option key={model.id} value={model.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{model.name}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2 mt-1">
                                                Provider: {getProviderName(currentAgent?.modelId)}
                                            </p>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Criatividade (Temperatura)</label>
                                        <span className="text-xs font-mono font-bold text-primary">{currentAgent?.temperature || 0.7}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={currentAgent?.temperature || 0.7}
                                        onChange={e => setCurrentAgent({ ...currentAgent, temperature: parseFloat(e.target.value) })}
                                        className="w-full accent-primary h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                                        Instruções Cognitivas (System Prompt) <Zap size={12} className="text-amber-500" />
                                    </label>
                                    <textarea
                                        value={currentAgent?.prompt || ''}
                                        onChange={e => setCurrentAgent({ ...currentAgent, prompt: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-4 focus:ring-primary/10 rounded-3xl px-6 py-5 text-sm font-semibold outline-none transition-all dark:text-white placeholder:text-slate-400 h-48 resize-none italic leading-relaxed"
                                        placeholder="Defina detalhadamente como o agente deve agir, tom de voz, restrições e objetivos..."
                                    />
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'knowledge' && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Vincular Base de Conhecimento (RAG)</label>
                                    <div className="grid grid-cols-1 gap-4">
                                        {knowledgeBases.length === 0 ? (
                                            <div className="p-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl text-center">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma base de conhecimento criada.</p>
                                            </div>
                                        ) : (
                                            knowledgeBases.map(kb => (
                                                <div
                                                    key={kb.id}
                                                    onClick={() => setCurrentAgent({ ...currentAgent, knowledgeBaseId: currentAgent?.knowledgeBaseId === kb.id ? undefined : kb.id })}
                                                    className={`p-6 rounded-3xl border transition-all cursor-pointer flex items-center justify-between group ${currentAgent?.knowledgeBaseId === kb.id ? 'bg-primary/10 border-primary shadow-lg' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-primary/50'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${currentAgent?.knowledgeBaseId === kb.id ? 'bg-primary text-white' : 'bg-white dark:bg-white/10 text-slate-400'}`}>
                                                            <Database size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{kb.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{kb._count?.documents || 0} Documentos Treinados</p>
                                                        </div>
                                                    </div>
                                                    {currentAgent?.knowledgeBaseId === kb.id && <CheckCircle className="text-primary" size={24} />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 block">Provedor de Embedding</label>
                                    <p className="text-[10px] text-slate-400 ml-1">Modelo usado para vetorizar documentos e consultas RAG.</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Provider</label>
                                            <select
                                                value={currentEmbeddingProvider}
                                                onChange={e => {
                                                    const firstModel = embeddingProviders.find(p => p.id === e.target.value)?.models[0]?.id || '';
                                                    setCurrentAgent({ ...currentAgent, embeddingProvider: e.target.value, embeddingModel: firstModel } as any);
                                                }}
                                                className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none dark:text-white appearance-none focus:ring-4 focus:ring-primary/10"
                                            >
                                                {embeddingProviders.length === 0 && (
                                                    <option value="" className="dark:bg-slate-800 dark:text-white">Nenhum provider configurado</option>
                                                )}
                                                {embeddingProviders.map(p => (
                                                    <option key={p.id} value={p.id} className="dark:bg-slate-800 dark:text-white">{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                                            <select
                                                value={(currentAgent as any)?.embeddingModel || embeddingModelsForProvider[0]?.id || ''}
                                                onChange={e => setCurrentAgent({ ...currentAgent, embeddingModel: e.target.value } as any)}
                                                className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none dark:text-white appearance-none focus:ring-4 focus:ring-primary/10"
                                            >
                                                {embeddingModelsForProvider.length === 0 && (
                                                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Nenhum modelo disponível</option>
                                                )}
                                                {embeddingModelsForProvider.map((m: { id: string; name: string; dimensions: number }) => (
                                                    <option key={m.id} value={m.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'widget' && (
                            <WidgetConfigTab
                                agent={currentAgent || {}}
                                onChange={(data) => setCurrentAgent({ ...currentAgent, ...data })}
                            />
                        )}

                        {activeTab === 'api' && (
                            <ApiKeysSection agentId={currentAgent?.id} />
                        )}

                        {activeTab === 'playground' && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-[400px]">
                                {!currentAgent?.id && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/30 rounded-2xl p-4 mb-4 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest text-center">
                                        Salve o agente antes de testar no Playground
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 dark:bg-black/20 rounded-3xl mb-4 border border-slate-100 dark:border-white/5 custom-scrollbar">
                                    {chatHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-sm">
                                            <MessageSquare size={32} className="mb-2" />
                                            Nenhuma mensagem trocada.
                                        </div>
                                    ) : (
                                        chatHistory.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-primary text-white ml-12 rounded-tr-none' : 'bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 mr-12 rounded-tl-none shadow-sm'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {chatLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white dark:bg-white/10 p-4 rounded-2xl rounded-tl-none animate-pulse flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={chatMessage}
                                        onChange={e => setChatMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleChatTest())}
                                        placeholder="Envie uma mensagem para testar..."
                                        disabled={!currentAgent?.id}
                                        className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:text-white disabled:opacity-50"
                                    />
                                    <button
                                        type="button"
                                        disabled={chatLoading || !currentAgent?.id}
                                        onClick={handleChatTest}
                                        className="p-4 bg-primary text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                                    >
                                        <Zap size={20} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {activeTab !== 'playground' && activeTab !== 'api' && (
                            <div className="flex gap-4 min-w-[300px] pt-8 border-t border-slate-100 dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 py-4 px-6 rounded-2xl border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-500 shadow-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-[2] py-4 px-6 rounded-2xl bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <RefreshCcw className="animate-spin h-5 w-5" />
                                    ) : (
                                        <><Save size={18} /> Sincronizar IA</>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
