'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, CheckCircle, MessageSquare, Building2, User, Loader } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

type TicketInfo = {
    id: string;
    status: string;
    contact: { name: string };
    assignedUser?: { name: string; avatar?: string };
    department: { name: string; emoji?: string };
    company: { name: string; logoUrl?: string };
    evaluation?: { customerRating?: number; customerFeedback?: string };
};

export default function AvaliacaoPage() {
    const { ticketId } = useParams<{ ticketId: string }>();
    const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [alreadyRated, setAlreadyRated] = useState(false);

    useEffect(() => {
        if (!ticketId) return;
        fetch(`${API_URL}/api/evaluations/public/${ticketId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) { setNotFound(true); return; }
                setTicketInfo(data);
                if (data.evaluation?.customerRating) {
                    setRating(data.evaluation.customerRating);
                    setFeedback(data.evaluation.customerFeedback || '');
                    setAlreadyRated(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [ticketId]);

    const handleSubmit = async () => {
        if (!rating) return;
        setSubmitting(true);
        try {
            await fetch(`${API_URL}/api/evaluations/customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, customerRating: rating, customerFeedback: feedback }),
            });
            setSubmitted(true);
        } catch {
            alert('Erro ao enviar avaliação. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    const STAR_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];
    const STAR_COLORS = ['', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'];

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
                <Loader className="text-white w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
                <div className="text-center text-white">
                    <p className="text-6xl mb-4">🔍</p>
                    <h1 className="text-2xl font-black">Atendimento não encontrado</h1>
                    <p className="text-slate-400 mt-2 text-sm">Verifique o link enviado a você.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="w-full max-w-md bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 shadow-2xl p-8 space-y-8"
            >
                {/* Logo e header */}
                <div className="text-center space-y-3">
                    {ticketInfo?.company.logoUrl ? (
                        <img src={ticketInfo.company.logoUrl} alt={ticketInfo.company.name} className="h-12 mx-auto object-contain" />
                    ) : (
                        <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto border border-white/10">
                            <Building2 className="text-blue-300 w-7 h-7" />
                        </div>
                    )}
                    <h1 className="text-2xl font-black text-white tracking-tight">{ticketInfo?.company.name}</h1>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300">Avaliação de Atendimento</p>
                </div>

                {/* Ticket info */}
                <div className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-xl">{ticketInfo?.department.emoji || '💬'}</span>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Departamento</p>
                            <p className="text-sm font-black text-white">{ticketInfo?.department.name}</p>
                        </div>
                    </div>
                    {ticketInfo?.assignedUser && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                {ticketInfo.assignedUser.avatar
                                    ? <img src={ticketInfo.assignedUser.avatar} className="w-full h-full rounded-full object-cover" alt="" />
                                    : <User className="w-4 h-4 text-blue-300" />}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Atendente</p>
                                <p className="text-sm font-black text-white">{ticketInfo.assignedUser.name}</p>
                            </div>
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {submitted || alreadyRated ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-6 space-y-3"
                        >
                            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
                            <h2 className="text-xl font-black text-white">
                                {alreadyRated && !submitted ? 'Você já avaliou!' : 'Obrigado!'}
                            </h2>
                            <p className="text-slate-300 text-sm font-bold">
                                {alreadyRated && !submitted
                                    ? `Sua avaliação de ${rating} estrela${rating > 1 ? 's' : ''} foi registrada.`
                                    : 'Sua avaliação foi enviada com sucesso. Isso nos ajuda a melhorar!'}
                            </p>
                            {/* Mostrar a nota atual */}
                            <div className="flex justify-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} className={`w-7 h-7 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            {/* Stars */}
                            <div className="space-y-3">
                                <p className="text-center text-sm font-black text-white uppercase tracking-widest">
                                    Como foi seu atendimento?
                                </p>
                                <div className="flex justify-center gap-3">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <motion.button
                                            key={s}
                                            whileHover={{ scale: 1.3 }}
                                            whileTap={{ scale: 0.9 }}
                                            onMouseEnter={() => setHover(s)}
                                            onMouseLeave={() => setHover(0)}
                                            onClick={() => setRating(s)}
                                        >
                                            <Star
                                                className={`w-10 h-10 transition-all ${s <= (hover || rating) ? 'fill-amber-400 text-amber-400 drop-shadow-lg' : 'text-slate-600'}`}
                                            />
                                        </motion.button>
                                    ))}
                                </div>
                                {(hover || rating) > 0 && (
                                    <motion.p
                                        key={hover || rating}
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-center text-sm font-black"
                                        style={{ color: STAR_COLORS[hover || rating] }}
                                    >
                                        {STAR_LABELS[hover || rating]}
                                    </motion.p>
                                )}
                            </div>

                            {/* Feedback */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <MessageSquare size={12} /> Comentário (opcional)
                                </label>
                                <textarea
                                    value={feedback}
                                    onChange={e => setFeedback(e.target.value)}
                                    placeholder="Conte-nos mais sobre sua experiência..."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={!rating || submitting}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/30"
                            >
                                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                    Powered by KSZap • Atendimento Inteligente
                </p>
            </motion.div>
        </div>
    );
}
