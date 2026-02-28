'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, TrendingUp, TrendingDown, Minus, User, Calendar, Bot } from 'lucide-react';

interface Evaluation {
    id: string;
    customerRating: number | null;
    customerFeedback: string | null;
    aiSentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    aiSentimentScore: number;
    aiJustification: string;
    createdAt: string;
    ticket: {
        subject: string;
        contact: { name: string };
        department: { name: string };
        assignedUser: { name: string } | null;
    };
}

export default function EvaluationsPage() {
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvaluations();
    }, []);

    const fetchEvaluations = async () => {
        try {
            const response = await api.get('/evaluations');
            setEvaluations(response.data);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro ao buscar avaliações';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'POSITIVE': return <TrendingUp className="text-green-500" size={18} />;
            case 'NEGATIVE': return <TrendingDown className="text-red-500" size={18} />;
            default: return <Minus className="text-gray-400" size={18} />;
        }
    };

    const getSentimentBadge = (sentiment: string) => {
        const styles: Record<string, string> = {
            POSITIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            NEGATIVE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            NEUTRAL: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
        };
        const labels: Record<string, string> = {
            POSITIVE: 'Positivo',
            NEGATIVE: 'Negativo',
            NEUTRAL: 'Neutro',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[sentiment] || styles.NEUTRAL}`}>
                {labels[sentiment] || sentiment}
            </span>
        );
    };

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Qualidade & Satisfação</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Monitore o desempenho da equipe e o sentimento dos clientes via IA.</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-3xl" />
                    ))}
                </div>
            ) : evaluations.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Star size={32} />
                    </div>
                    <h3 className="text-lg font-bold">Nenhuma avaliação ainda</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-2">As avaliações aparecerão aqui assim que os tickets forem encerrados e analisados pela IA.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {evaluations.map((ev, index) => (
                            <motion.div
                                key={ev.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        {getSentimentIcon(ev.aiSentiment)}
                                        {getSentimentBadge(ev.aiSentiment)}
                                    </div>
                                    <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-lg">
                                        <Star size={14} className="text-yellow-500 fill-yellow-500" />
                                        <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">{ev.customerRating ?? 'N/A'}</span>
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{ev.ticket.subject || 'Sem assunto'}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                                    <User size={12} /> {ev.ticket.contact.name} • {ev.ticket.department.name}
                                </p>

                                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl relative">
                                    <Bot size={14} className="absolute -top-2 -left-2 text-blue-600 p-0.5 bg-white dark:bg-gray-900 rounded-full border border-blue-100 dark:border-blue-900" />
                                    <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-3">
                                        "{ev.aiJustification}"
                                    </p>
                                </div>

                                {ev.customerFeedback && (
                                    <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                        <MessageSquare size={14} className="shrink-0 text-blue-500" />
                                        <p>"{ev.customerFeedback}"</p>
                                    </div>
                                )}

                                <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-[10px] uppercase font-bold">
                                            {ev.ticket.assignedUser?.name.charAt(0) || '?'}
                                        </div>
                                        <span className="text-[10px] text-gray-500 font-medium">{ev.ticket.assignedUser?.name || 'Não atribuído'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                        <Calendar size={10} />
                                        {new Date(ev.createdAt).toLocaleDateString()}
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
