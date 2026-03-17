'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star, MessageSquare, TrendingUp, TrendingDown, Minus, User, Calendar, Bot,
    Eye, X, Hash, Phone, Building2, UserCheck, Clock, BarChart2, Smile, Meh, Frown,
    MessageCircle, ChevronDown, ChevronUp, Download, Filter
} from 'lucide-react';

interface Evaluation {
    id: string;
    customerRating: number | null;
    customerFeedback: string | null;
    aiSentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    aiSentimentScore: number;
    aiJustification: string;
    aiSummary: string;
    createdAt: string;
    ticket: {
        id: string;
        subject: string;
        summary: string | null;
        status: string;
        resolvedAt: string | null;
        closedAt: string | null;
        contact: { name: string; phoneNumber: string };
        department: { name: string; emoji: string; color: string };
        assignedUser: { name: string; avatar: string | null } | null;
    };
}

interface Message {
    id: string;
    content: string;
    transcription?: string;
    fromMe: boolean;
    sentAt: string;
    type: string;
}

const SENTIMENT_CONFIG = {
    POSITIVE: { label: 'Positivo', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', bar: 'bg-emerald-500', icon: Smile },
    NEUTRAL:  { label: 'Neutro',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30',   bar: 'bg-amber-500',   icon: Meh   },
    NEGATIVE: { label: 'Negativo', color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30',       bar: 'bg-red-500',     icon: Frown },
};

function ScoreMeter({ score }: { score: number }) {
    const pct = Math.max(0, Math.min(100, (score / 10) * 100));
    const color = score >= 7 ? 'bg-emerald-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
            <span className={`text-xs font-black tabular-nums ${score >= 7 ? 'text-emerald-600 dark:text-emerald-400' : score >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {score?.toFixed(1) ?? '—'}<span className="font-normal text-gray-400">/10</span>
            </span>
        </div>
    );
}

function StarRating({ rating, size = 14 }: { rating: number | null; size?: number }) {
    if (!rating) return <span className="text-xs text-gray-400">Sem avaliação</span>;
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    size={size}
                    className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                />
            ))}
            <span className="ml-1 text-xs font-bold text-gray-700 dark:text-gray-300">{rating}/5</span>
        </div>
    );
}

function DiagnosticModal({ ev, onClose }: { ev: Evaluation; onClose: () => void }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMsgs, setLoadingMsgs] = useState(true);
    const [showMessages, setShowMessages] = useState(false);
    const sentCfg = SENTIMENT_CONFIG[ev.aiSentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
    const SentimentIcon = sentCfg.icon;

    useEffect(() => {
        const ctrl = new AbortController();
        api.get(`/chat/${ev.ticket.id}/messages`, { signal: ctrl.signal })
            .then(r => setMessages(r.data?.messages || r.data || []))
            .catch(err => { if (err?.code === 'ERR_CANCELED') return; })
            .finally(() => setLoadingMsgs(false));
        return () => ctrl.abort();
    }, [ev.ticket.id]);

    const closedAt = ev.ticket.closedAt || ev.ticket.resolvedAt;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-start justify-between rounded-t-3xl">
                        <div>
                            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Diagnóstico do Atendimento</h2>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <Hash size={11} />#{ev.ticket.id.slice(-8).toUpperCase()} · {ev.ticket.subject || 'Sem assunto'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Ticket Meta */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <Phone size={14} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cliente</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{ev.ticket.contact.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{ev.ticket.contact.phoneNumber}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <Building2 size={14} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Departamento</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                        {ev.ticket.department.emoji} {ev.ticket.department.name}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <UserCheck size={14} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Atendente</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{ev.ticket.assignedUser?.name || 'Não atribuído'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                                <Clock size={14} className="text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Encerrado em</p>
                                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                                        {closedAt ? new Date(closedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* AI Sentiment Score */}
                        <div className={`rounded-2xl p-4 border ${sentCfg.bg} ${ev.aiSentiment === 'POSITIVE' ? 'border-emerald-200 dark:border-emerald-800' : ev.aiSentiment === 'NEGATIVE' ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <SentimentIcon size={18} className={sentCfg.color} />
                                    <span className={`text-sm font-bold ${sentCfg.color}`}>{sentCfg.label}</span>
                                </div>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${sentCfg.bg} ${sentCfg.color}`}>
                                    Score IA: {ev.aiSentimentScore?.toFixed(1) ?? '—'}/10
                                </span>
                            </div>
                            <ScoreMeter score={ev.aiSentimentScore} />
                        </div>

                        {/* AI Justification */}
                        <div className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                            <div className="flex items-center gap-2 mb-2">
                                <Bot size={15} className="text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Análise da IA</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                                "{ev.aiJustification || 'Sem análise disponível.'}"
                            </p>
                        </div>

                        {/* Ticket AI Summary */}
                        {ev.ticket.summary && (
                            <div className="rounded-2xl p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <BarChart2 size={15} className="text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">Resumo do Atendimento</span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {ev.ticket.summary}
                                </p>
                            </div>
                        )}

                        {/* CSAT Rating */}
                        <div className="rounded-2xl p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                            <div className="flex items-center gap-2 mb-3">
                                <Star size={15} className="text-yellow-500" />
                                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">Avaliação do Cliente (CSAT)</span>
                            </div>
                            <StarRating rating={ev.customerRating} size={18} />
                            {ev.customerFeedback && (
                                <div className="mt-3 flex items-start gap-2">
                                    <MessageSquare size={13} className="text-yellow-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{ev.customerFeedback}"</p>
                                </div>
                            )}
                            {!ev.customerRating && !ev.customerFeedback && (
                                <p className="text-xs text-gray-400 italic">Cliente não avaliou este atendimento.</p>
                            )}
                        </div>

                        {/* Messages collapsible */}
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                            <button
                                onClick={() => setShowMessages(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                                <div className="flex items-center gap-2">
                                    <MessageCircle size={15} className="text-gray-500" />
                                    Histórico de Mensagens
                                    {!loadingMsgs && (
                                        <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full font-bold">{messages.length}</span>
                                    )}
                                </div>
                                {showMessages ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            <AnimatePresence>
                                {showMessages && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                                            {loadingMsgs ? (
                                                <div className="space-y-2">
                                                    {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
                                                </div>
                                            ) : messages.length === 0 ? (
                                                <p className="text-xs text-gray-400 text-center py-4">Sem mensagens disponíveis.</p>
                                            ) : (
                                                messages.map(msg => (
                                                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                                                            msg.fromMe
                                                                ? 'bg-primary text-white rounded-br-sm'
                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                                                        }`}>
                                                            <p className="leading-relaxed whitespace-pre-line">{msg.transcription || msg.content}</p>
                                                            <p className={`text-[9px] mt-1 ${msg.fromMe ? 'text-white/60' : 'text-gray-400'}`}>
                                                                {new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default function EvaluationsPage() {
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Evaluation | null>(null);
    const [filterSentiment, setFilterSentiment] = useState('');
    const [filterRating, setFilterRating] = useState('');

    useEffect(() => {
        const ctrl = new AbortController();
        fetchEvaluations(ctrl.signal);
        return () => ctrl.abort();
    }, []);

    const fetchEvaluations = async (signal?: AbortSignal) => {
        try {
            const response = await api.get('/evaluations', { signal });
            setEvaluations(response.data);
        } catch (error: any) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
            toast.error(error.response?.data?.message || 'Erro ao buscar avaliações');
        } finally {
            setLoading(false);
        }
    };

    // Stats (always from full list)
    const total = evaluations.length;
    const withRating = evaluations.filter(e => e.customerRating);
    const avgCsat = withRating.length ? (withRating.reduce((s, e) => s + (e.customerRating ?? 0), 0) / withRating.length) : null;
    const avgScore = total ? (evaluations.reduce((s, e) => s + (e.aiSentimentScore ?? 0), 0) / total) : null;
    const positiveCount = evaluations.filter(e => e.aiSentiment === 'POSITIVE').length;
    const negativeCount = evaluations.filter(e => e.aiSentiment === 'NEGATIVE').length;
    const neutralCount = evaluations.filter(e => e.aiSentiment === 'NEUTRAL').length;

    // Filtered list for the cards grid
    const filteredEvaluations = evaluations.filter(e => {
        if (filterSentiment && e.aiSentiment !== filterSentiment) return false;
        if (filterRating && e.customerRating !== parseInt(filterRating)) return false;
        return true;
    });

    const exportCSV = () => {
        const rows = [
            ['ID Ticket', 'Assunto', 'Contato', 'Telefone', 'Agente', 'Departamento', 'Sentimento', 'Score IA', 'Rating CSAT', 'Feedback', 'Data'],
            ...filteredEvaluations.map(e => [
                e.ticket.id,
                e.ticket.subject || '',
                e.ticket.contact.name,
                e.ticket.contact.phoneNumber,
                e.ticket.assignedUser?.name || '',
                e.ticket.department.name,
                e.aiSentiment,
                e.aiSentimentScore?.toFixed(2) || '',
                e.customerRating?.toString() || '',
                (e.customerFeedback || '').replace(/"/g, '""'),
                new Date(e.createdAt).toLocaleDateString('pt-BR'),
            ]),
        ];
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `avaliacoes_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-8">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Qualidade & Satisfação</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Monitore o desempenho da equipe e o sentimento dos clientes via IA.</p>
                </div>
                {!loading && total > 0 && (
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-500/20"
                    >
                        <Download size={14} />
                        Exportar CSV
                    </button>
                )}
            </div>

            {/* Stats bar */}
            {!loading && total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="col-span-2 md:col-span-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Total</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{total}</p>
                        <p className="text-xs text-gray-400">avaliações</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">CSAT Médio</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className="text-2xl font-black text-yellow-500">{avgCsat?.toFixed(1) ?? '—'}</p>
                            <p className="text-sm text-gray-400">/5</p>
                        </div>
                        <p className="text-xs text-gray-400">{withRating.length} respostas</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Score IA Médio</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className="text-2xl font-black text-blue-500">{avgScore?.toFixed(1) ?? '—'}</p>
                            <p className="text-sm text-gray-400">/10</p>
                        </div>
                        <p className="text-xs text-gray-400">sentimento IA</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                        <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Positivos</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{positiveCount}</p>
                        <p className="text-xs text-gray-400">{total ? Math.round((positiveCount / total) * 100) : 0}% do total</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-red-100 dark:border-red-900/30 shadow-sm">
                        <p className="text-[10px] text-red-500 uppercase tracking-widest font-bold">Negativos</p>
                        <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{negativeCount}</p>
                        <p className="text-xs text-gray-400">{total ? Math.round((negativeCount / total) * 100) : 0}% do total</p>
                    </div>
                </div>
            )}

            {/* Filter bar */}
            {!loading && total > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                        <Filter size={13} />Filtros
                    </div>
                    <select
                        value={filterSentiment}
                        onChange={e => setFilterSentiment(e.target.value)}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                    >
                        <option value="">Sentimento (todos)</option>
                        <option value="POSITIVE">Positivo</option>
                        <option value="NEUTRAL">Neutro</option>
                        <option value="NEGATIVE">Negativo</option>
                    </select>
                    <select
                        value={filterRating}
                        onChange={e => setFilterRating(e.target.value)}
                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none"
                    >
                        <option value="">Rating CSAT (todos)</option>
                        {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} estrela{r !== 1 ? 's' : ''}</option>)}
                    </select>
                    {(filterSentiment || filterRating) && (
                        <button
                            onClick={() => { setFilterSentiment(''); setFilterRating(''); }}
                            className="text-[11px] font-bold text-rose-500 hover:opacity-70 transition-opacity"
                        >
                            Limpar
                        </button>
                    )}
                    {(filterSentiment || filterRating) && (
                        <span className="ml-auto text-[11px] text-gray-400 font-medium">
                            {filteredEvaluations.length} de {total} avaliações
                        </span>
                    )}
                </div>
            )}

            {/* Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3.5 w-20" />
                                </div>
                                <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
                            </div>
                            <div className="flex gap-1">
                                {[1,2,3,4,5].map(s => <Skeleton key={s} className="h-6 w-6 rounded" />)}
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                            <Skeleton className="h-px w-full" />
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-3.5 w-24" />
                                <Skeleton className="h-7 w-20 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredEvaluations.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Star size={32} />
                    </div>
                    <h3 className="text-lg font-bold">{total === 0 ? 'Nenhuma avaliação ainda' : 'Nenhuma avaliação para os filtros selecionados'}</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-2">
                        {total === 0
                            ? 'As avaliações aparecerão aqui assim que os tickets forem encerrados e analisados pela IA.'
                            : 'Tente outros filtros para ver mais resultados.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {filteredEvaluations.map((ev, index) => {
                            const sentCfg = SENTIMENT_CONFIG[ev.aiSentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
                            const SentimentIcon = sentCfg.icon;
                            return (
                                <motion.div
                                    key={ev.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all group flex flex-col"
                                >
                                    {/* Top row: sentiment + CSAT stars */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${sentCfg.bg} ${sentCfg.color}`}>
                                            <SentimentIcon size={13} />
                                            {sentCfg.label}
                                        </div>
                                        <StarRating rating={ev.customerRating} size={13} />
                                    </div>

                                    {/* Subject + contact */}
                                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{ev.ticket.subject || 'Sem assunto'}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                                        <User size={11} className="shrink-0" />
                                        <span className="truncate">{ev.ticket.contact.name}</span>
                                        <span className="text-gray-300 dark:text-gray-600">·</span>
                                        <span className="truncate">{ev.ticket.department.emoji} {ev.ticket.department.name}</span>
                                    </p>

                                    {/* Score meter */}
                                    <div className="mt-3">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                                            <Bot size={10} />Score IA
                                        </p>
                                        <ScoreMeter score={ev.aiSentimentScore} />
                                    </div>

                                    {/* AI Justification snippet */}
                                    <div className="mt-3 flex-1">
                                        <p className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2 leading-relaxed">
                                            "{ev.aiJustification || 'Sem análise.'}"
                                        </p>
                                    </div>

                                    {/* Customer feedback snippet */}
                                    {ev.customerFeedback && (
                                        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-500 bg-blue-50/50 dark:bg-blue-900/10 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                            <MessageSquare size={12} className="shrink-0 text-blue-500 mt-0.5" />
                                            <p className="line-clamp-1">"{ev.customerFeedback}"</p>
                                        </div>
                                    )}

                                    {/* Footer: agent + date + view button */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-[9px] uppercase font-black shrink-0">
                                                {ev.ticket.assignedUser?.name.charAt(0) || '?'}
                                            </div>
                                            <span className="text-[10px] text-gray-500 truncate">{ev.ticket.assignedUser?.name || 'Não atribuído'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Calendar size={9} />
                                                {new Date(ev.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                            <button
                                                onClick={() => setSelected(ev)}
                                                className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-[10px] font-bold transition-colors"
                                            >
                                                <Eye size={11} />
                                                Ver
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Diagnostic modal */}
            {selected && <DiagnosticModal ev={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
