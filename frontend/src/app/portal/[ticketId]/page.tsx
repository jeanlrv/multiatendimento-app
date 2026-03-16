'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Message = {
    id: string;
    content: string;
    sentAt: string;
    fromMe: boolean;
    messageType: string;
};

type PublicTicket = {
    id: string;
    publicToken: string;
    status: string;
    subject: string | null;
    createdAt: string;
    resolvedAt: string | null;
    csatPending: boolean;
    contact: { name: string } | null;
    department: { name: string } | null;
    company: { name: string; logoUrl: string | null; primaryColor: string } | null;
    messages: Message[];
};

const STATUS_LABEL: Record<string, string> = {
    OPEN: 'Aberto',
    RESOLVED: 'Resolvido',
    PENDING: 'Aguardando',
    PAUSED: 'Pausado',
};

const STATUS_COLOR: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700 border-blue-200',
    RESOLVED: 'bg-green-100 text-green-700 border-green-200',
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    PAUSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function downloadTranscript(ticket: PublicTicket) {
    const lines: string[] = [
        `HISTÓRICO DE ATENDIMENTO`,
        `Protocolo: ${ticket.id.slice(0, 8).toUpperCase()}`,
        `Status: ${STATUS_LABEL[ticket.status] ?? ticket.status}`,
        ticket.subject ? `Assunto: ${ticket.subject}` : '',
        ticket.contact ? `Cliente: ${ticket.contact.name}` : '',
        ticket.department ? `Departamento: ${ticket.department.name}` : '',
        `Aberto em: ${formatDate(ticket.createdAt)}`,
        ticket.resolvedAt ? `Resolvido em: ${formatDate(ticket.resolvedAt)}` : '',
        '',
        '--- MENSAGENS ---',
        '',
        ...ticket.messages.map(m =>
            `[${formatDate(m.sentAt)}] ${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content || '[Mídia/Arquivo]'}`
        ),
    ].filter(l => l !== undefined);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atendimento-${ticket.id.slice(0, 8).toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function CsatForm({ ticketId, primaryColor }: { ticketId: string; primaryColor: string }) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!rating) return;
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/evaluations/customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, rating, feedback: feedback || undefined }),
            });
            if (!res.ok) throw new Error('Erro ao enviar avaliação');
            setSubmitted(true);
        } catch {
            setError('Não foi possível enviar a avaliação. Tente novamente.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="font-semibold text-slate-800 mb-1">Obrigado pelo seu feedback!</h3>
                <p className="text-sm text-slate-500">Sua avaliação nos ajuda a melhorar continuamente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Como foi seu atendimento?</h2>
            <p className="text-xs text-slate-400 mb-4">Sua avaliação é anônima e leva menos de 1 minuto.</p>

            {/* Stars */}
            <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                        aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                    >
                        <span style={{ color: star <= (hover || rating) ? '#FBBF24' : '#D1D5DB' }}>★</span>
                    </button>
                ))}
            </div>

            {rating > 0 && (
                <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Comentário opcional (ex: o que poderia melhorar?)"
                    rows={3}
                    maxLength={500}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3"
                />
            )}

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <button
                type="button"
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: primaryColor || '#3B82F6' }}
            >
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
            </button>
        </div>
    );
}

export default function PortalTicketPage() {
    const params = useParams();
    const ticketId = params?.ticketId as string;

    const [ticket, setTicket] = useState<PublicTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ticketId) return;
        const controller = new AbortController();
        fetch(`${API_URL}/tickets/public/${ticketId}`, { signal: controller.signal })
            .then(res => {
                if (!res.ok) throw new Error('Ticket não encontrado');
                return res.json();
            })
            .then(setTicket)
            .catch(err => { if (err.name !== 'AbortError') setError(err.message); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [ticketId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Carregando informações do atendimento...</p>
                </div>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center max-w-md w-full">
                    <div className="text-5xl mb-4">🔍</div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Atendimento não encontrado</h2>
                    <p className="text-slate-500 text-sm">{error || 'O link pode estar incorreto ou o atendimento foi removido.'}</p>
                </div>
            </div>
        );
    }

    const statusLabel = STATUS_LABEL[ticket.status] ?? ticket.status;
    const statusClass = STATUS_COLOR[ticket.status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
    const primaryColor = ticket.company?.primaryColor ?? '#3B82F6';
    const companyName = ticket.company?.name ?? 'KSZap';
    const companyLogo = ticket.company?.logoUrl;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header com branding da empresa */}
            <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center gap-3">
                {companyLogo ? (
                    <img src={companyLogo} alt={companyName} className="h-8 w-auto object-contain" />
                ) : (
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {companyName.charAt(0).toUpperCase()}
                    </div>
                )}
                <span className="font-semibold text-slate-800">{companyName}</span>
                <span className="text-slate-300 ml-1">·</span>
                <span className="text-slate-500 text-sm">Portal do Cliente</span>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                {/* Ticket info card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h1 className="text-lg font-semibold text-slate-800">
                                {ticket.subject || 'Atendimento sem título'}
                            </h1>
                            {ticket.contact && (
                                <p className="text-sm text-slate-500 mt-0.5">Cliente: {ticket.contact.name}</p>
                            )}
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusClass} whitespace-nowrap`}>
                            {statusLabel}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        {ticket.department && (
                            <div>
                                <span className="text-slate-400 block mb-0.5">Departamento</span>
                                <span className="font-medium text-slate-700">{ticket.department.name}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-slate-400 block mb-0.5">Aberto em</span>
                            <span className="font-medium text-slate-700">{formatDate(ticket.createdAt)}</span>
                        </div>
                        {ticket.resolvedAt && (
                            <div>
                                <span className="text-slate-400 block mb-0.5">Resolvido em</span>
                                <span className="font-medium text-slate-700">{formatDate(ticket.resolvedAt)}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-slate-400 block mb-0.5">Protocolo</span>
                            <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{ticket.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Download button */}
                    {ticket.messages.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => downloadTranscript(ticket)}
                                className="text-xs font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Baixar histórico (.txt)
                            </button>
                        </div>
                    )}
                </div>

                {/* Status timeline */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-slate-700 mb-4">Status do Atendimento</h2>
                    <div className="flex items-center gap-2">
                        {['OPEN', 'PENDING', 'RESOLVED'].map((s, i) => {
                            const steps = ['OPEN', 'PENDING', 'RESOLVED'];
                            const currentIdx = steps.indexOf(ticket.status);
                            const stepIdx = steps.indexOf(s);
                            const isActive = stepIdx <= currentIdx;
                            const isCurrent = s === ticket.status;
                            return (
                                <div key={s} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center flex-1">
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${isCurrent ? 'text-white' : isActive ? 'text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                                            style={isCurrent ? { backgroundColor: primaryColor, borderColor: primaryColor } : isActive ? { backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}80` } : {}}
                                        >
                                            {isActive ? '✓' : i + 1}
                                        </div>
                                        <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-semibold' : isActive ? 'text-slate-600' : 'text-slate-400'}`}
                                            style={isCurrent ? { color: primaryColor } : {}}>
                                            {STATUS_LABEL[s]}
                                        </span>
                                    </div>
                                    {i < 2 && (
                                        <div className={`h-0.5 flex-1 mx-1 rounded ${stepIdx < currentIdx ? 'bg-blue-300' : 'bg-slate-200'}`}
                                            style={stepIdx < currentIdx ? { backgroundColor: `${primaryColor}60` } : {}} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* CSAT inline — apenas se pendente e ticket resolvido */}
                {ticket.csatPending && ticket.status === 'RESOLVED' && (
                    <CsatForm ticketId={ticket.id} primaryColor={primaryColor} />
                )}

                {/* Messages */}
                {ticket.messages.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-sm font-semibold text-slate-700 mb-4">
                            Histórico de Mensagens ({ticket.messages.length})
                        </h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {ticket.messages.map(msg => (
                                <div key={msg.id} className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0 mt-0.5">
                                        {msg.fromMe ? '🤖' : '👤'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-400 mb-0.5">
                                            {msg.fromMe ? 'Atendente' : 'Cliente'} · {formatDate(msg.sentAt)}
                                        </p>
                                        <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 break-words">
                                            {msg.content || <span className="text-slate-400 italic">Mídia / Arquivo</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-center text-xs text-slate-400 pb-4">
                    Powered by {companyName} · Este portal é somente leitura
                </p>
            </main>
        </div>
    );
}
