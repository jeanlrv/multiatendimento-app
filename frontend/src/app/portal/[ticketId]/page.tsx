'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Message = {
    id: string;
    content: string;
    sentAt: string;
    fromMe: boolean;
    type: string;
};

type PublicTicket = {
    id: string;
    status: string;
    subject: string | null;
    createdAt: string;
    resolvedAt: string | null;
    contact: { name: string } | null;
    department: { name: string } | null;
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

export default function PortalTicketPage() {
    const params = useParams();
    const ticketId = params?.ticketId as string;

    const [ticket, setTicket] = useState<PublicTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ticketId) return;
        fetch(`${API_URL}/tickets/public/${ticketId}`)
            .then(res => {
                if (!res.ok) throw new Error('Ticket não encontrado');
                return res.json();
            })
            .then(setTicket)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
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

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    K
                </div>
                <span className="font-semibold text-slate-800">Portal do Cliente</span>
                <span className="text-slate-300 ml-1">·</span>
                <span className="text-slate-500 text-sm">KSZap</span>
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
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${isCurrent
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : isActive
                                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                                : 'bg-slate-100 border-slate-200 text-slate-400'
                                            }`}>
                                            {isActive ? '✓' : i + 1}
                                        </div>
                                        <span className={`text-xs mt-1 text-center ${isCurrent ? 'text-blue-600 font-semibold' : isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {STATUS_LABEL[s]}
                                        </span>
                                    </div>
                                    {i < 2 && (
                                        <div className={`h-0.5 flex-1 mx-1 rounded ${stepIdx < currentIdx ? 'bg-blue-300' : 'bg-slate-200'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

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
                    Powered by KSZap · Este portal é somente leitura
                </p>
            </main>
        </div>
    );
}
