'use client';

import { useState, useEffect, useRef } from 'react';
import { AIAgentsService, AIAgent, AIProviderModels } from '@/services/ai-agents';
import { AIKnowledgeService, KnowledgeBase } from '@/services/ai-knowledge';
import { motion } from 'framer-motion';
import {
    Bot, Plus, Trash2, CheckCircle, X, RefreshCcw, Save,
    Brain, Database, MessageSquare, Zap, Key, Globe, ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import WidgetConfigTab from './components/WidgetConfigTab';
import ApiKeysSection from './components/ApiKeysSection';
import { AgentListView } from './_components/AgentListView';
import { PlaygroundTab } from './_components/PlaygroundTab';

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
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isDirty = JSON.stringify(currentAgent) !== JSON.stringify(originalAgent);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, chatLoading]);

    const fetchData = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const [agentsData, kbData, modelsData, embProviders] = await Promise.all([
                AIAgentsService.findAll(signal),
                AIKnowledgeService.findAllBases(signal),
                AIAgentsService.getModels(signal).catch((e) => {
                    if (e?.name === 'CanceledError' || e?.name === 'AbortError') return [];
                    console.error('Falha crítica ao buscar Modelos LLMs:', e);
                    toast.error('Erro ao listar opções de modelos de IA.');
                    return [];
                }),
                AIAgentsService.getEmbeddingProviders(signal).catch((e) => {
                    if (e?.name === 'CanceledError' || e?.name === 'AbortError') return [];
                    console.error('Falha crítica ao buscar Embedding Providers:', e);
                    toast.error('Erro ao listar providers de embedding.');
                    return [{ id: 'native', name: 'Nativo (built-in CPU)', models: [{ id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2', dimensions: 384 }] }];
                }),
            ]);
            setAgents(agentsData);
            setKnowledgeBases(kbData);
            setAvailableModels(modelsData);
            setEmbeddingProviders(embProviders);
        } catch (error: any) {
            if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
            console.error('Erro ao buscar dados:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
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
                cancel: { label: 'Continuar editando', onClick: () => {} },
                duration: 5000,
            });
        } else {
            setIsModalOpen(false);
        }
    };

    const savedModelId = originalAgent?.modelId;
    const isSavedProviderConfigured = !savedModelId || availableModels.some(p => p.models.some(m => m.id === savedModelId));

    const handleChatTest = async () => {
        if (!chatMessage && !attachedFile) return;
        if (!currentAgent?.id) return;

        if (!isSavedProviderConfigured) {
            toast.error(`Provider do modelo "${getModelDisplayName(savedModelId)}" não está configurado. Configure em Configurações → IA & Modelos ou salve o agente com outro modelo.`);
            return;
        }

        if (isDirty) {
            toast.warning('Salve as alterações antes de testar no Playground.');
            return;
        }

        setChatLoading(true);
        const file = attachedFile;
        const displayContent = file ? `📎 ${file.name}\n${chatMessage}` : chatMessage;
        const userMsg = { role: 'user', content: displayContent };
        const prevHistory = [...chatHistory];
        setChatHistory([...chatHistory, userMsg, { role: 'assistant', content: '' }]);
        setChatMessage('');
        setAttachedFile(null);

        if (file) {
            try {
                const { response } = await AIAgentsService.chatWithAttachment(
                    currentAgent.id, chatMessage, file,
                    prevHistory.map(m => ({ role: m.role, content: m.content }))
                );
                setChatHistory(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: response };
                    return updated;
                });
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || error.message || 'Erro ao processar arquivo.';
                setChatHistory(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${errorMsg}` };
                    return updated;
                });
                toast.error(errorMsg, { duration: 6000 });
            } finally {
                setChatLoading(false);
            }
            return;
        }

        try {
            for await (const event of AIAgentsService.streamChat(currentAgent.id, chatMessage, prevHistory.map(m => ({ role: m.role, content: m.content })))) {
                if (event.type === 'chunk') {
                    setChatHistory(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = { ...last, content: last.content + event.content };
                        return updated;
                    });
                } else if (event.type === 'error') {
                    setChatHistory(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${event.message || event.content}` };
                        return updated;
                    });
                }
            }
        } catch (error: any) {
            const errorMsg = error.message || 'Erro ao processar mensagem. Verifique se o provider de IA está configurado.';
            setChatHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${errorMsg}` };
                return updated;
            });
            toast.error(errorMsg, { duration: 6000 });
        } finally {
            setChatLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            if (currentAgent?.id) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: _id, companyId: _co, createdAt: _cr, updatedAt: _up, embedId: _ei, ...payload } = currentAgent as any;
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
            cancel: { label: 'Cancelar', onClick: () => {} },
            duration: 5000,
        });
    };

    const getModelDisplayName = (modelId?: string) => {
        if (!modelId) return 'Não configurado';
        for (const provider of availableModels) {
            const model = provider.models.find(m => m.id === modelId);
            if (model) return model.name;
        }
        const parts = modelId.split(':');
        const name = parts.length > 1 ? parts[1] : modelId;
        return `${name} (Não configurado)`;
    };

    const getProviderName = (modelId?: string) => {
        if (!modelId) return availableModels[0]?.providerName || '—';
        for (const provider of availableModels) {
            if (provider.models.some(m => m.id === modelId)) return provider.providerName;
        }
        const prefix = modelId.split(':')[0];
        const knownProviders: Record<string, string> = {
            'gpt': 'OpenAI', 'claude': 'Anthropic', 'gemini': 'Google',
            'deepseek': 'DeepSeek', 'mistral': 'Mistral', 'codestral': 'Mistral'
        };
        if (knownProviders[prefix]) return knownProviders[prefix];
        return prefix.charAt(0).toUpperCase() + prefix.slice(1) || 'Desconhecido';
    };

    const currentEmbeddingProvider = (currentAgent as any)?.embeddingProvider || 'native';
    const embeddingModelsForProvider = embeddingProviders.find(p => p.id === currentEmbeddingProvider)?.models
        || (embeddingProviders.find(p => p.id === 'native')?.models)
        || (embeddingProviders.length > 0 ? embeddingProviders[0].models : []);

    useEffect(() => {
        if (isModalOpen && currentAgent) {
            const isModelValid = availableModels.some(p => p.models.some(m => m.id === currentAgent.modelId));
            if (!isModelValid && availableModels.length > 0) {
                const firstModelId = availableModels[0].models[0]?.id;
                if (firstModelId && currentAgent.modelId !== firstModelId) {
                    setCurrentAgent(prev => ({ ...prev, modelId: firstModelId }));
                }
            }
            const currentModels = embeddingProviders.find(p => p.id === currentEmbeddingProvider)?.models || [];
            const isEmbValid = currentModels.some(m => m.id === (currentAgent as any).embeddingModel);
            if (!isEmbValid && currentModels.length > 0) {
                setCurrentAgent(prev => ({ ...prev, embeddingModel: currentModels[0].id } as any));
            }
        }
    }, [isModalOpen, availableModels, currentEmbeddingProvider, embeddingProviders]);

    if (!isModalOpen) {
        return (
            <AgentListView
                agents={agents}
                loading={loading}
                openModal={openModal}
                handleDelete={handleDelete}
                getModelDisplayName={getModelDisplayName}
                availableModels={availableModels}
                embeddingProviders={embeddingProviders}
            />
        );
    }

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
                        { id: 'playground', label: 'Playground', icon: MessageSquare },
                        { id: 'cognitive', label: 'Cérebro', icon: Brain },
                        { id: 'knowledge', label: 'Conhecimento', icon: Database },
                        { id: 'widget', label: 'Widget', icon: Globe },
                        { id: 'api', label: 'API', icon: Key },
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
                                        type="range" min="0" max="1" step="0.1"
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
                                                {embeddingProviders.length === 0 && <option value="" className="dark:bg-slate-800 dark:text-white">Nenhum provider configurado</option>}
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
                                                {embeddingModelsForProvider.length === 0 && <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Nenhum modelo disponível</option>}
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
                            <PlaygroundTab
                                currentAgent={currentAgent}
                                chatHistory={chatHistory}
                                chatLoading={chatLoading}
                                chatMessage={chatMessage}
                                setChatMessage={setChatMessage}
                                attachedFile={attachedFile}
                                setAttachedFile={setAttachedFile}
                                fileInputRef={fileInputRef}
                                chatEndRef={chatEndRef}
                                onSendMessage={handleChatTest}
                                isDirty={isDirty}
                                isSavedProviderConfigured={isSavedProviderConfigured}
                                savedModelId={savedModelId}
                                getModelDisplayName={getModelDisplayName}
                            />
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
