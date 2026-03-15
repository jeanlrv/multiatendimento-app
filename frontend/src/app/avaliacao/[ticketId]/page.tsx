'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, CheckCircle, MessageSquare, Building2, User, Loader, ArrowRight, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '');

type TicketInfo = {
    id: string;
    status: string;
    contact: { name: string };
    assignedUser?: { name: string; avatar?: string };
    department: { name: string; emoji?: string };
    company: { name: string; logoUrl?: string };
    evaluation?: { customerRating?: number; customerFeedback?: string };
};

const STAR_LABELS = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];
const STAR_COLORS = ['', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'];

const NPS_COLORS: Record<number, string> = {
    0: '#ef4444', 1: '#ef4444', 2: '#f97316', 3: '#f97316', 4: '#f97316',
    5: '#f97316', 6: '#f59e0b', 7: '#f59e0b', 8: '#84cc16', 9: '#22c55e', 10: '#22c55e',
};

function getNpsLabel(score: number): string {
    if (score <= 6) return 'Detrator';
    if (score <= 8) return 'Neutro';
    return 'Promotor';
}

export default function AvaliacaoPage() {
    const { ticketId } = useParams<{ ticketId: string }>();
    const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [submitError, setSubmitError] = useState(false);

    // Step: 1 = estrelas, 2 = comentário + NPS, 3 = confirmação
    const [step, setStep] = useState(1);
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [nps, setNps] = useState<number | null>(null);
    const [npsHover, setNpsHover] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
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
                    setStep(3);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));
    }, [ticketId]);

    const handleSubmit = async () => {
        if (!rating) return;
        setSubmitting(true);
        try {
            const combinedFeedback = [
                feedback.trim(),
                nps !== null ? `[NPS: ${nps}/10]` : '',
            ].filter(Boolean).join('\n\n');

            await fetch(`${API_URL}/api/evaluations/customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId,
                    customerRating: rating,
                    customerFeedback: combinedFeedback || undefined,
                }),
            });
            setStep(3);
        } catch {
            setSubmitError(true);
        } finally {
            setSubmitting(false);
        }
    };

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
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="w-full max-w-md bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 shadow-2xl p-8 space-y-6"
            >
                {/* Header */}
                <div className="text-center space-y-3">
                    {ticketInfo?.company.logoUrl ? (
                        <img
                            src={ticketInfo.company.logoUrl}
                            alt={ticketInfo.company.name}
                            className="h-12 mx-auto object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
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

                {/* Step indicator (só quando há form) */}
                {step < 3 && (
                    <div className="flex items-center gap-2 justify-center">
                        {[1, 2].map(s => (
                            <div
                                key={s}
                                className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-blue-400' : s < step ? 'w-4 bg-blue-400/60' : 'w-4 bg-white/20'}`}
                            />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* Step 1: Estrelas */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-6"
                        >
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
                                <AnimatePresence>
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
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!rating}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2"
                            >
                                Continuar <ArrowRight size={16} />
                            </button>
                        </motion.div>
                    )}

                    {/* Step 2: Comentário + NPS */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-5"
                        >
                            {/* Comentário */}
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

                            {/* NPS */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                                    Você nos indicaria a um amigo? (opcional)
                                </p>
                                <div className="flex justify-between gap-1">
                                    {Array.from({ length: 11 }, (_, i) => i).map(n => {
                                        const active = npsHover !== null ? n <= npsHover : nps !== null ? n <= nps : false;
                                        const isSelected = nps === n;
                                        return (
                                            <motion.button
                                                key={n}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.9 }}
                                                onMouseEnter={() => setNpsHover(n)}
                                                onMouseLeave={() => setNpsHover(null)}
                                                onClick={() => setNps(prev => prev === n ? null : n)}
                                                className={`flex-1 h-8 rounded-lg text-xs font-black transition-all border ${isSelected ? 'border-transparent scale-110' : active ? 'border-transparent' : 'border-white/10 bg-white/5 text-slate-400'}`}
                                                style={active || isSelected ? {
                                                    backgroundColor: NPS_COLORS[n] + '40',
                                                    color: NPS_COLORS[n],
                                                    borderColor: NPS_COLORS[n] + '60',
                                                } : {}}
                                            >
                                                {n}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
                                    <span>Nada provável</span>
                                    <span>Extremamente provável</span>
                                </div>
                                <AnimatePresence>
                                    {nps !== null && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center text-xs font-black"
                                            style={{ color: NPS_COLORS[nps] }}
                                        >
                                            {nps}/10 — {getNpsLabel(nps)}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Botões */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-5 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black text-sm transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <button
                                    onClick={() => { setSubmitError(false); handleSubmit(); }}
                                    disabled={submitting}
                                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/30"
                                >
                                    {submitting ? 'Enviando...' : 'Enviar Avaliação'}
                                </button>
                                {submitError && (
                                    <p className="w-full text-center text-xs text-red-400 mt-1">
                                        Erro ao enviar. Tente novamente.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Confirmação */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="text-center py-4 space-y-4"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                            >
                                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
                            </motion.div>
                            <h2 className="text-xl font-black text-white">
                                {alreadyRated ? 'Você já avaliou!' : 'Obrigado!'}
                            </h2>
                            <p className="text-slate-300 text-sm font-bold">
                                {alreadyRated
                                    ? `Sua avaliação de ${rating} estrela${rating > 1 ? 's' : ''} já foi registrada.`
                                    : 'Sua avaliação foi enviada com sucesso. Isso nos ajuda a melhorar!'}
                            </p>
                            <div className="flex justify-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} className={`w-7 h-7 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                                ))}
                            </div>
                            {nps !== null && (
                                <p className="text-xs font-bold" style={{ color: NPS_COLORS[nps] }}>
                                    NPS: {nps}/10 — {getNpsLabel(nps)}
                                </p>
                            )}
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
