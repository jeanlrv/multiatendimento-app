'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Send, Users, Plus, X, Play, Pause, Trash2, CheckCircle2, XCircle, Clock, ChevronRight, MessageSquare, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';

interface Contact {
    id: string;
    name: string;
    phoneNumber: string;
}

interface Broadcast {
    id: string;
    name: string;
    message: string;
    status: string;
    totalContacts: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    _count?: { recipients: number };
}

interface Connection {
    id: string;
    name: string;
    status: string;
}

const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-500',
    RUNNING: 'bg-blue-100 text-blue-700',
    PAUSED: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    FAILED: 'bg-rose-100 text-rose-700',
};

const statusLabels: Record<string, string> = {
    DRAFT: 'Rascunho',
    RUNNING: 'Enviando',
    PAUSED: 'Pausado',
    COMPLETED: 'Concluído',
    FAILED: 'Falhou',
};

export default function BroadcastPage() {
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [showWizard, setShowWizard] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [searchContact, setSearchContact] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [connectionId, setConnectionId] = useState('');
    const [creating, setCreating] = useState(false);
    const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
    const [liveProgress, setLiveProgress] = useState<Record<string, { sent: number; failed: number; total: number; status: string }>>({});

    const fetchBroadcasts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/broadcast');
            setBroadcasts(res.data);
        } catch { toast.error('Erro ao carregar campanhas'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchBroadcasts();
        api.get('/connections').then(r => setConnections(r.data?.filter((c: Connection) => c.status === 'CONNECTED') || [])).catch(() => { });
    }, [fetchBroadcasts]);

    // Load contacts when wizard opens
    useEffect(() => {
        if (showWizard) {
            api.get('/contacts?limit=200').then(r => setContacts(r.data?.data || r.data || [])).catch(() => { });
        }
    }, [showWizard]);

    // WebSocket: real-time broadcast progress
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const socket = getSocket(token);
        const handler = (data: any) => {
            setLiveProgress(prev => ({
                ...prev,
                [data.broadcastId]: { sent: data.sentCount, failed: data.failedCount, total: data.totalContacts, status: data.status },
            }));
            if (data.status === 'COMPLETED') {
                fetchBroadcasts();
                toast.success('Broadcast concluído!');
            }
        };
        socket?.on('broadcast_progress', handler);
        return () => { socket?.off('broadcast_progress', handler); };
    }, [fetchBroadcasts]);

    const handleCreate = async () => {
        if (!name || !message || selectedContacts.length === 0) { toast.error('Preencha todos os campos'); return; }
        setCreating(true);
        try {
            await api.post('/broadcast', { name, message, connectionId: connectionId || undefined, contactIds: selectedContacts });
            toast.success('Campanha criada!');
            setShowWizard(false);
            resetWizard();
            fetchBroadcasts();
        } catch { toast.error('Erro ao criar campanha'); }
        finally { setCreating(false); }
    };

    const resetWizard = () => { setStep(1); setName(''); setMessage(''); setSelectedContacts([]); setConnectionId(''); setSearchContact(''); };

    const handleStart = async (id: string) => {
        try {
            await api.post(`/broadcast/${id}/start`);
            toast.success('Broadcast iniciado!');
            fetchBroadcasts();
        } catch { toast.error('Erro ao iniciar broadcast'); }
    };

    const handlePause = async (id: string) => {
        try {
            await api.post(`/broadcast/${id}/pause`);
            toast.success('Broadcast pausado');
            fetchBroadcasts();
        } catch { toast.error('Erro ao pausar'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Confirmar exclusão?')) return;
        try {
            await api.delete(`/broadcast/${id}`);
            toast.success('Campanha excluída');
            setBroadcasts(prev => prev.filter(b => b.id !== id));
            if (selectedBroadcast?.id === id) setSelectedBroadcast(null);
        } catch { toast.error('Erro ao excluir'); }
    };

    const filteredContacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(searchContact.toLowerCase()) ||
        c.phoneNumber?.includes(searchContact)
    );

    const progress = (b: Broadcast) => {
        const live = liveProgress[b.id];
        const sent = live?.sent ?? b.sentCount;
        const failed = live?.failed ?? b.failedCount;
        const total = live?.total ?? b.totalContacts;
        const status = live?.status ?? b.status;
        return { sent, failed, total, pct: total > 0 ? Math.round(((sent + failed) / total) * 100) : 0, status };
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Radio className="text-primary" size={24} /> Broadcast
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">Envio em massa para múltiplos contatos</p>
                </div>
                <button
                    onClick={() => { resetWizard(); setShowWizard(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 active:scale-95"
                >
                    <Plus size={16} /> Nova Campanha
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* List */}
                <div className="lg:col-span-1 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
                    ) : broadcasts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <Radio size={32} className="opacity-30" />
                            <p className="text-sm font-medium">Nenhuma campanha ainda</p>
                        </div>
                    ) : broadcasts.map(b => {
                        const p = progress(b);
                        return (
                            <button
                                key={b.id}
                                onClick={() => setSelectedBroadcast(b)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedBroadcast?.id === b.id ? 'border-primary/30 bg-primary/5' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 hover:border-primary/20'}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{b.name}</p>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${statusColors[p.status] || statusColors.DRAFT}`}>
                                        {statusLabels[p.status] || p.status}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mb-2">{b.message}</p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <Users size={10} /> {p.total} contatos
                                    {p.total > 0 && (
                                        <>
                                            <div className="flex-1 h-1 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.pct}%` }} />
                                            </div>
                                            <span>{p.pct}%</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Detail */}
                <div className="lg:col-span-2">
                    {selectedBroadcast ? (
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-5">
                            {(() => {
                                const b = selectedBroadcast;
                                const p = progress(b);
                                return (
                                    <>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h2 className="text-lg font-black text-slate-900 dark:text-white">{b.name}</h2>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusColors[p.status] || statusColors.DRAFT}`}>
                                                    {statusLabels[p.status] || p.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                {(p.status === 'DRAFT' || p.status === 'PAUSED') && (
                                                    <button onClick={() => handleStart(b.id)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all">
                                                        <Play size={12} /> Iniciar
                                                    </button>
                                                )}
                                                {p.status === 'RUNNING' && (
                                                    <button onClick={() => handlePause(b.id)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all">
                                                        <Pause size={12} /> Pausar
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(b.id)} className="p-2 rounded-xl text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Total', value: p.total, icon: <Users size={14} />, color: 'text-slate-500' },
                                                { label: 'Enviados', value: p.sent, icon: <CheckCircle2 size={14} />, color: 'text-emerald-500' },
                                                { label: 'Falhas', value: p.failed, icon: <XCircle size={14} />, color: 'text-rose-500' },
                                            ].map(s => (
                                                <div key={s.label} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-center">
                                                    <div className={`flex items-center justify-center gap-1 ${s.color} mb-1`}>{s.icon}</div>
                                                    <p className="text-xl font-black text-slate-900 dark:text-white">{s.value}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Progress bar */}
                                        {p.total > 0 && (
                                            <div>
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                    <span>Progresso</span><span>{p.pct}%</span>
                                                </div>
                                                <div className="h-3 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${p.pct}%` }}
                                                        transition={{ type: 'spring', damping: 20 }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Message */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mensagem</p>
                                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{b.message}</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10">
                            <MessageSquare size={32} className="opacity-30" />
                            <p className="text-sm">Selecione uma campanha</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Wizard Modal */}
            <AnimatePresence>
                {showWizard && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                        onClick={() => setShowWizard(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: -10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: -10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {[1, 2, 3].map(s => (
                                        <div key={s} className={`flex items-center gap-1.5 ${s < step ? 'opacity-50' : ''}`}>
                                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${step === s ? 'bg-primary text-white border-primary' : step > s ? 'bg-emerald-500 text-white border-emerald-500' : 'border-slate-200 dark:border-white/20 text-slate-400'}`}>
                                                {step > s ? '✓' : s}
                                            </div>
                                            <span className={`text-xs font-bold ${step === s ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                                {s === 1 ? 'Contatos' : s === 2 ? 'Mensagem' : 'Confirmar'}
                                            </span>
                                            {s < 3 && <ChevronRight size={12} className="text-slate-300" />}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setShowWizard(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-5 min-h-[360px]">
                                {step === 1 && (
                                    <div className="space-y-3">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Selecionar Contatos ({selectedContacts.length} selecionados)</p>
                                        <input
                                            value={searchContact}
                                            onChange={e => setSearchContact(e.target.value)}
                                            placeholder="Buscar contatos..."
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                        <div className="flex items-center justify-between">
                                            <button onClick={() => setSelectedContacts(filteredContacts.map(c => c.id))} className="text-xs text-primary font-bold hover:underline">Selecionar todos</button>
                                            <button onClick={() => setSelectedContacts([])} className="text-xs text-slate-400 hover:text-slate-600 font-bold">Limpar</button>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                                            {filteredContacts.map(c => (
                                                <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedContacts.includes(c.id)}
                                                        onChange={e => setSelectedContacts(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                                                        className="h-4 w-4 rounded border-slate-300 text-primary"
                                                    />
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs flex-shrink-0">
                                                        {c.name?.charAt(0) || '#'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name || 'Sem nome'}</p>
                                                        <p className="text-[11px] text-slate-400">{c.phoneNumber}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Nome da Campanha *</label>
                                            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promoção de Março" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Conexão WhatsApp</label>
                                            <select value={connectionId} onChange={e => setConnectionId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                                <option value="">Selecionar conexão...</option>
                                                {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">Mensagem *</label>
                                            <p className="text-[10px] text-slate-400 mb-1.5">Use <code className="bg-slate-100 dark:bg-white/10 px-1 rounded">{'{{nome}}'}</code> para personalizar com o nome do contato</p>
                                            <textarea
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                placeholder="Olá {{nome}}, temos uma oferta especial para você!"
                                                rows={5}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Confirmar Envio</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Destinatários</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedContacts.length}</p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Campanha</p>
                                                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{name}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Mensagem</p>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{message}</p>
                                        </div>
                                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                            <Clock size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-xs text-amber-700 dark:text-amber-300">A campanha será criada como rascunho. Clique em "Iniciar" na lista para começar o envio (limite de 3 msg/seg).</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 pb-5 flex justify-between gap-3">
                                <button
                                    onClick={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : setShowWizard(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                                >
                                    {step === 1 ? 'Cancelar' : 'Voltar'}
                                </button>
                                {step < 3 ? (
                                    <button
                                        onClick={() => {
                                            if (step === 1 && selectedContacts.length === 0) { toast.error('Selecione ao menos 1 contato'); return; }
                                            setStep((step + 1) as 2 | 3);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/30"
                                    >
                                        Próximo <ChevronRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreate}
                                        disabled={creating || !name || !message}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
                                    >
                                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                        Criar Campanha
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
