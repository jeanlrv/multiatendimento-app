'use client';

import { useState, useEffect, useRef } from 'react';
import { AIAgentsService } from '@/services/ai-agents';
import { AIKnowledgeService } from '@/services/ai-knowledge';
import { motion } from 'framer-motion';
import { Search, Loader2, Database, FileText, Globe, FileUp, FileCode, Zap, MessageSquare, Bot, Send, History, X } from 'lucide-react';

export default function AISearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [agents, setAgents] = useState<any[]>([]);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [chatMode, setChatMode] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const data = await AIAgentsService.findAll();
                setAgents(data);
                if (data.length > 0) {
                    setSelectedAgent(data[0].id);
                }
            } catch (error) {
                console.error('Erro ao buscar agentes:', error);
            }
        };

        fetchAgents();

        // Carregar histórico de buscas do localStorage
        const history = localStorage.getItem('aiSearchHistory');
        if (history) {
            setSearchHistory(JSON.parse(history));
        }
    }, []);

    const handleSearch = async (searchQuery: string = query) => {
        if (!searchQuery.trim() || !selectedAgent) return;

        try {
            setLoading(true);
            setQuery(searchQuery);

            // Adicionar ao histórico
            const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10);
            setSearchHistory(newHistory);
            localStorage.setItem('aiSearchHistory', JSON.stringify(newHistory));

            // TODO: Implementar busca semântica real usando o endpoint de chat
            // Por enquanto, vamos simular resultados
            const mockResults = [
                {
                    id: '1',
                    title: 'Política de Atendimento',
                    content: 'O atendimento deve ser realizado em até 5 minutos durante o horário comercial...',
                    sourceType: 'PDF',
                    relevance: 0.95
                },
                {
                    id: '2',
                    title: 'Procedimentos de Suporte',
                    content: 'Para resolver problemas técnicos, siga os passos: 1. Identificar o problema...',
                    sourceType: 'DOCX',
                    relevance: 0.87
                },
                {
                    id: '3',
                    title: 'FAQ - Perguntas Frequentes',
                    content: 'P: Qual o horário de atendimento? R: Seg a Sex, das 8h às 18h...',
                    sourceType: 'TEXT',
                    relevance: 0.72
                }
            ];

            setResults(mockResults);
        } catch (error) {
            console.error('Erro na busca:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChat = async () => {
        if (!query.trim() || !selectedAgent) return;

        try {
            setIsTyping(true);
            setChatHistory(prev => [...prev, { role: 'user', content: query }]);

            // Chamar o endpoint de chat
            const response = await AIAgentsService.chat(selectedAgent, query, chatHistory);

            setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
            setQuery('');
        } catch (error) {
            console.error('Erro no chat:', error);
        } finally {
            setIsTyping(false);
        }
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('aiSearchHistory');
    };

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-0 md:min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Search className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Busca <span className="text-primary italic">Inteligente</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Zap size={14} className="text-primary" />
                        RAG Semântico com IA
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setChatMode(false)}
                        className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${!chatMode ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white dark:bg-white/5 text-slate-500'}`}
                    >
                        <Search size={16} className="inline mr-2" />
                        Buscar
                    </button>
                    <button
                        onClick={() => setChatMode(true)}
                        className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${chatMode ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white dark:bg-white/5 text-slate-500'}`}
                    >
                        <MessageSquare size={16} className="inline mr-2" />
                        Chat
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 px-4">
                {/* Área de Busca/Chat */}
                <div className="lg:col-span-8">
                    <div className="glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 shadow-xl overflow-hidden">
                        {!chatMode ? (
                            <>
                                <div className="p-8 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="flex-1 relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                                placeholder="Digite sua pergunta..."
                                                className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleSearch()}
                                            disabled={loading || !query.trim()}
                                            className="px-8 py-4 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                            Buscar
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Agente:</label>
                                        <select
                                            value={selectedAgent}
                                            onChange={(e) => setSelectedAgent(e.target.value)}
                                            className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none"
                                        >
                                            {agents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-8">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-64">
                                            <Loader2 className="animate-spin text-primary" size={48} />
                                        </div>
                                    ) : results.length > 0 ? (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">
                                                {results.length} resultados encontrados
                                            </h3>
                                            {results.map((result, index) => (
                                                <motion.div
                                                    key={result.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 hover:shadow-lg transition-all"
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${result.sourceType === 'PDF' ? 'bg-rose-100 text-rose-600' :
                                                                result.sourceType === 'DOCX' ? 'bg-blue-100 text-blue-600' :
                                                                    result.sourceType === 'URL' ? 'bg-emerald-100 text-emerald-600' :
                                                                        'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {result.sourceType === 'PDF' ? <FileUp size={16} /> :
                                                                    result.sourceType === 'DOCX' ? <FileCode size={16} /> :
                                                                        result.sourceType === 'URL' ? <Globe size={16} /> :
                                                                            <FileText size={16} />}
                                                            </div>
                                                            <h4 className="font-bold text-slate-900 dark:text-white">{result.title}</h4>
                                                        </div>
                                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                                                            {(result.relevance * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                                        {result.content}
                                                    </p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-center">
                                            <Database size={48} className="text-primary/20 mb-4" />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                                                Faça uma busca para encontrar conhecimento
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-8 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-4 mb-6">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Agente:</label>
                                        <select
                                            value={selectedAgent}
                                            onChange={(e) => setSelectedAgent(e.target.value)}
                                            className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none"
                                        >
                                            {agents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="p-8 h-[500px] overflow-y-auto">
                                    {chatHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center">
                                            <Bot size={48} className="text-primary/20 mb-4" />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                                                Inicie uma conversa com o agente de IA
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {chatHistory.map((msg, index) => (
                                                <motion.div
                                                    key={index}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                                        ? 'bg-primary text-white'
                                                        : 'bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10'
                                                        }`}>
                                                        <p className="text-sm">{msg.content}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                            {isTyping && (
                                                <div className="flex justify-start">
                                                    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                                        <Loader2 className="animate-spin text-primary" size={20} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                                                placeholder="Digite sua mensagem..."
                                                className="w-full px-4 py-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                        <button
                                            onClick={handleChat}
                                            disabled={loading || !query.trim() || isTyping}
                                            className="px-6 py-4 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Histórico de Buscas */}
                <div className="lg:col-span-4">
                    <div className="glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 shadow-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black uppercase tracking-tight italic flex items-center gap-2">
                                <History size={18} className="text-primary" />
                                Histórico
                            </h3>
                            {searchHistory.length > 0 && (
                                <button
                                    onClick={clearHistory}
                                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-500 transition-all"
                                    title="Limpar histórico"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {searchHistory.length === 0 ? (
                            <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase tracking-widest">
                                Sem histórico
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {searchHistory.map((item, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setQuery(item);
                                            handleSearch(item);
                                        }}
                                        className="w-full p-3 text-left rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-primary/10 transition-all text-sm font-bold text-slate-700 dark:text-slate-300 truncate"
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}