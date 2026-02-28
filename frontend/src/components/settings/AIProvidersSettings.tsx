'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Eye, EyeOff, Save, Trash2, CheckCircle2, XCircle,
    ChevronDown, ChevronUp, Link, Server, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

// ─── Metadados dos providers ──────────────────────────────────────────────────
const LLM_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', icon: '🤖', color: '#10a37f', hasBaseUrl: false, description: 'GPT-4o, GPT-4.1, O3 Mini' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: '#d97706', hasBaseUrl: false, description: 'Claude Sonnet 4, Claude 3.5' },
    { id: 'gemini', name: 'Google Gemini', icon: '✨', color: '#4285f4', hasBaseUrl: false, description: 'Gemini 2.0 Flash, Gemini 1.5 Pro' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍', color: '#6366f1', hasBaseUrl: false, description: 'DeepSeek Chat V3, Reasoner R1' },
    { id: 'groq', name: 'Groq', icon: '⚡', color: '#f59e0b', hasBaseUrl: false, description: 'Llama 3.3 70B, Mixtral 8x7B (ultra rápido)' },
    { id: 'openrouter', name: 'OpenRouter', icon: '🔀', color: '#8b5cf6', hasBaseUrl: false, description: 'Acesso a 200+ modelos' },
    { id: 'mistral', name: 'Mistral AI', icon: '🌀', color: '#06b6d4', hasBaseUrl: false, description: 'Mistral Large, Codestral' },
    { id: 'azure', name: 'Azure OpenAI', icon: '☁️', color: '#0078d4', hasBaseUrl: true, baseUrlLabel: 'Endpoint Azure', baseUrlPlaceholder: 'https://meu-recurso.openai.azure.com', description: 'GPT-4o via Microsoft Azure' },
    { id: 'together', name: 'Together AI', icon: '🤝', color: '#ec4899', hasBaseUrl: false, description: 'Llama, Mixtral, DeepSeek open-source' },
    { id: 'lmstudio', name: 'LM Studio / LocalAI', icon: '💻', color: '#64748b', hasBaseUrl: true, baseUrlLabel: 'URL do servidor local', baseUrlPlaceholder: 'http://localhost:1234/v1', description: 'Modelos locais via LM Studio' },
    { id: 'perplexity', name: 'Perplexity AI', icon: '🔎', color: '#14b8a6', hasBaseUrl: false, description: 'Sonar (busca online em tempo real)' },
    { id: 'xai', name: 'xAI Grok', icon: '🚀', color: '#1d1d1d', color2: '#e2e8f0', hasBaseUrl: false, description: 'Grok 2, Grok 2 Vision' },
    { id: 'cohere', name: 'Cohere', icon: '🌐', color: '#0ea5e9', hasBaseUrl: false, description: 'Command R+ com RAG nativo' },
    { id: 'huggingface', name: 'HuggingFace', icon: '🤗', color: '#fbbf24', hasBaseUrl: false, description: 'Llama, Mistral, Phi-3 open-source' },
    { id: 'ollama', name: 'Ollama (Local)', icon: '🦙', color: '#84cc16', hasBaseUrl: true, baseUrlLabel: 'URL do Ollama', baseUrlPlaceholder: 'http://localhost:11434/v1', description: 'Rode modelos LLM localmente', noApiKey: true },
    { id: 'anythingllm', name: 'AnythingLLM', icon: '📦', color: '#3b82f6', hasBaseUrl: true, baseUrlLabel: 'URL do AnythingLLM', baseUrlPlaceholder: 'http://localhost:3001/api/v1', description: 'IA full-stack via AnythingLLM Desktop/Docker' },
] as const;

const EMBEDDING_PROVIDERS = [
    { id: 'openai', name: 'OpenAI Embeddings', icon: '🤖', color: '#10a37f', hasBaseUrl: false, description: 'text-embedding-3-small/large' },
    { id: 'gemini', name: 'Google Embeddings', icon: '✨', color: '#4285f4', hasBaseUrl: false, description: 'text-embedding-004' },
    { id: 'cohere', name: 'Cohere Embeddings', icon: '🌐', color: '#0ea5e9', hasBaseUrl: false, description: 'embed-multilingual-v3.0 (PT-BR)' },
    { id: 'azure', name: 'Azure Embeddings', icon: '☁️', color: '#0078d4', hasBaseUrl: true, baseUrlLabel: 'Endpoint Azure', baseUrlPlaceholder: 'https://meu-recurso.openai.azure.com', description: 'text-embedding via Azure' },
    { id: 'voyage', name: 'Voyage AI', icon: '🚢', color: '#7c3aed', hasBaseUrl: false, description: 'voyage-multilingual-2 (PT-BR)' },
    { id: 'ollama', name: 'Ollama Embeddings', icon: '🦙', color: '#84cc16', hasBaseUrl: true, baseUrlLabel: 'URL do Ollama', baseUrlPlaceholder: 'http://localhost:11434/v1', description: 'nomic-embed-text local', noApiKey: true },
    { id: 'anythingllm', name: 'AnythingLLM RAG', icon: '📦', color: '#3b82f6', hasBaseUrl: true, baseUrlLabel: 'URL do AnythingLLM', baseUrlPlaceholder: 'http://localhost:3001/api/v1', description: 'Nativo do AnythingLLM' },
] as const;

// Combinar providers únicos (sem duplicatas de id)
const ALL_PROVIDERS = [
    ...LLM_PROVIDERS,
    ...EMBEDDING_PROVIDERS.filter(ep => !LLM_PROVIDERS.find(lp => lp.id === ep.id)),
];

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProviderConfig {
    id: string;
    provider: string;
    category: string;
    apiKey: string | null;
    baseUrl: string | null;
    extraConfig: any;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ProviderCardProps {
    meta: typeof ALL_PROVIDERS[number];
    config: ProviderConfig | undefined;
    onSave: (provider: string, data: { apiKey?: string; baseUrl?: string; isEnabled: boolean; extraConfig?: any }) => Promise<void>;
    onDelete: (provider: string) => Promise<void>;
}

// ─── Card individual de provider ─────────────────────────────────────────────
function ProviderCard({ meta, config, onSave, onDelete }: ProviderCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [customModel, setCustomModel] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const isConfigured = !!config;
    const noApiKey = (meta as any).noApiKey === true;

    // Ao expandir, preenche a URL atual se houver
    useEffect(() => {
        if (expanded) {
            setApiKey(''); // nunca preenche key (segurança)
            setBaseUrl(config?.baseUrl || '');
            setCustomModel(config?.extraConfig?.model || '');
        }
    }, [expanded, config]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(meta.id, {
                apiKey: noApiKey ? undefined : (apiKey || undefined),
                baseUrl: (meta as any).hasBaseUrl ? (baseUrl || undefined) : undefined,
                isEnabled: true,
                extraConfig: customModel ? { model: customModel } : (config?.extraConfig || {}),
            });
            setApiKey('');
            setExpanded(false);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await onDelete(meta.id);
        } finally {
            setDeleting(false);
        }
    };

    const isLLM = LLM_PROVIDERS.some(p => p.id === meta.id);
    const isEmbed = EMBEDDING_PROVIDERS.some(p => p.id === meta.id);

    return (
        <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isConfigured
            ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
            : 'border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5'
            }`}>
            {/* Header */}
            <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(v => !v)}
            >
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}44` }}
                >
                    {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900 dark:text-white">{meta.name}</span>
                        {isLLM && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">LLM</span>}
                        {isEmbed && !isLLM && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Embedding</span>}
                        {isLLM && isEmbed && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Embedding</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{meta.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isConfigured ? (
                        <span className="flex items-center gap-1 text-[10px] font-black text-green-600 dark:text-green-400">
                            <CheckCircle2 size={14} /> Ativo
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                            <XCircle size={14} /> Não configurado
                        </span>
                    )}
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </div>

            {/* Form expandido */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-white/10 pt-3">
                            {/* API Key */}
                            {!noApiKey && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                                        API Key {isConfigured && <span className="text-green-600 dark:text-green-400 normal-case tracking-normal font-semibold">(já configurada — preencha para alterar)</span>}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type={showKey ? 'text' : 'password'}
                                                value={apiKey}
                                                onChange={e => setApiKey(e.target.value)}
                                                placeholder={isConfigured ? '••••••••••••••••••••••••••••••••' : 'sk-... ou equivalente'}
                                                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(v => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                                            >
                                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Base URL (providers locais/Azure) */}
                            {(meta as any).hasBaseUrl && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                                        {(meta as any).baseUrlLabel || 'Base URL'}
                                    </label>
                                    <div className="relative">
                                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="url"
                                            value={baseUrl}
                                            onChange={e => setBaseUrl(e.target.value)}
                                            placeholder={(meta as any).baseUrlPlaceholder || 'https://...'}
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Campo de Modelo Customizado p/ AnythingLLM, Ollama, LMStudio, etc */}
                            {isLLM && ['anythingllm', 'ollama', 'lmstudio'].includes(meta.id) && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                                        Modelo Específico <span className="text-primary normal-case tracking-normal font-semibold">(ex: llama3, deepseek-r1)</span>
                                    </label>
                                    <div className="relative">
                                        <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary shadow-sm" />
                                        <input
                                            type="text"
                                            value={customModel}
                                            onChange={e => setCustomModel(e.target.value)}
                                            placeholder="Nome do modelo no provider"
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Ações */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || (!noApiKey && !apiKey && !isConfigured)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    <Save size={13} />
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                                {isConfigured && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-all"
                                    >
                                        <Trash2 size={13} />
                                        {deleting ? 'Removendo...' : 'Remover'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function AIProvidersSettings() {
    const [loading, setLoading] = useState(true);
    const [configs, setConfigs] = useState<ProviderConfig[]>([]);
    const [activeSection, setActiveSection] = useState<'llm' | 'embedding'>('llm');

    const fetchConfigs = useCallback(async () => {
        try {
            const res = await api.get('/settings/ai-providers');
            setConfigs(res.data);
        } catch {
            toast.error('Erro ao carregar configurações de providers.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

    const handleSave = async (provider: string, data: { apiKey?: string; baseUrl?: string; isEnabled: boolean }) => {
        try {
            const res = await api.put(`/settings/ai-providers/${provider}`, data);
            setConfigs(prev => {
                const idx = prev.findIndex(c => c.provider === provider);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = res.data;
                    return updated;
                }
                return [...prev, res.data];
            });
            toast.success(`Provider ${provider} configurado com sucesso!`);
        } catch {
            toast.error(`Erro ao salvar configuração do provider ${provider}.`);
            throw new Error('save failed');
        }
    };

    const handleDelete = async (provider: string) => {
        try {
            await api.delete(`/settings/ai-providers/${provider}`);
            setConfigs(prev => prev.filter(c => c.provider !== provider));
            toast.success(`Configuração do provider ${provider} removida.`);
        } catch {
            toast.error(`Erro ao remover configuração do provider ${provider}.`);
            throw new Error('delete failed');
        }
    };

    const getConfig = (providerId: string) => configs.find(c => c.provider === providerId);

    const llmProviders = LLM_PROVIDERS;
    const embeddingOnlyProviders = EMBEDDING_PROVIDERS.filter(ep => !LLM_PROVIDERS.find(lp => lp.id === ep.id));

    if (loading) return (
        <div className="text-center p-10 font-black animate-pulse text-primary tracking-widest uppercase text-xs">
            Carregando Configurações de Providers...
        </div>
    );

    const configuredCount = configs.length;

    return (
        <div className="space-y-6">
            {/* Cabeçalho */}
            <div className="flex items-center gap-6 mb-10">
                <div className="p-5 bg-primary/10 text-primary rounded-[1.5rem] border border-primary/20 shadow-inner">
                    <Brain size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                        Providers de IA
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">
                        Configure suas chaves de API — somente providers ativos aparecerão nos agentes
                    </p>
                </div>
                {configuredCount > 0 && (
                    <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                        <CheckCircle2 size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{configuredCount} ativo{configuredCount !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <Sparkles size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Configure abaixo os providers que deseja utilizar. As chaves são armazenadas de forma criptografada no banco de dados.
                    <strong className="font-black"> Somente os providers configurados aqui serão listados</strong> nas páginas de Agentes de IA e Base de Conhecimento.
                </p>
            </div>

            {/* Tabs LLM / Embedding */}
            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
                {[
                    { id: 'llm' as const, label: 'Modelos LLM', icon: <Brain size={14} />, count: llmProviders.filter(p => getConfig(p.id)).length },
                    { id: 'embedding' as const, label: 'Embeddings', icon: <Server size={14} />, count: embeddingOnlyProviders.filter(p => getConfig(p.id)).length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === tab.id
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                    >
                        {tab.icon} {tab.label}
                        {tab.count > 0 && (
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${activeSection === tab.id ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Grid de providers */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 gap-3"
                >
                    {activeSection === 'llm' && llmProviders.map(meta => (
                        <ProviderCard
                            key={meta.id}
                            meta={meta as any}
                            config={getConfig(meta.id)}
                            onSave={handleSave}
                            onDelete={handleDelete}
                        />
                    ))}
                    {activeSection === 'embedding' && embeddingOnlyProviders.map(meta => (
                        <ProviderCard
                            key={meta.id}
                            meta={meta as any}
                            config={getConfig(meta.id)}
                            onSave={handleSave}
                            onDelete={handleDelete}
                        />
                    ))}
                </motion.div>
            </AnimatePresence>

            {/* Nota sobre providers compartilhados */}
            {activeSection === 'embedding' && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    * OpenAI, Google Gemini, Cohere e Azure são configurados na aba LLM Modelos e também ficam disponíveis como providers de embedding automaticamente.
                </p>
            )}
        </div>
    );
}
