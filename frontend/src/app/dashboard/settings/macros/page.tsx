'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, Search, Edit2, Trash2, X, Save, RefreshCcw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { QuickRepliesService, QuickReply } from '@/services/quick-replies';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';

export default function MacrosPage() {
    const { user } = useAuth();
    const [macros, setMacros] = useState<QuickReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<QuickReply | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const canManage = hasPermission(user, 'settings:update');

    const fetchMacros = useCallback(async () => {
        try {
            const data = await QuickRepliesService.findAll();
            // Filtragem local por enquanto, se a API não suportar busca
            const filtered = searchInput
                ? data.filter(m =>
                    m.shortcut.toLowerCase().includes(searchInput.toLowerCase()) ||
                    m.content.toLowerCase().includes(searchInput.toLowerCase())
                )
                : data;
            setMacros(filtered);
        } catch {
            toast.error('Erro ao carregar respostas rápidas');
        } finally {
            setLoading(false);
        }
    }, [searchInput]);

    // Debounce busca
    useEffect(() => {
        const t = setTimeout(fetchMacros, 350);
        return () => clearTimeout(t);
    }, [fetchMacros]);

    const handleDelete = async (macro: QuickReply) => {
        setDeletingId(macro.id);
        try {
            await QuickRepliesService.remove(macro.id);
            setMacros(prev => prev.filter(m => m.id !== macro.id));
            toast.success('Resposta rápida removida');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao remover resposta rápida');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copiado para a área de transferência!');
    };

    return (
        <div className="space-y-10 max-w-5xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Zap className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                        Respostas <span className="text-primary italic">Rápidas</span>
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">
                        Atalhos registrados: {macros.length}
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={() => { setEditing(null); setShowModal(true); }}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 font-bold text-xs uppercase tracking-widest group active:scale-95 transition-all"
                    >
                        <Plus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Nova Resposta</span>
                    </button>
                )}
            </div>

            {/* Busca */}
            <div className="px-4">
                <div className="relative group max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar pelo atalho ou conteúdo..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all dark:text-white"
                    />
                </div>
            </div>

            {/* Lista */}
            {loading ? (
                <div className="grid gap-4 px-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 liquid-glass rounded-[2rem] animate-pulse" />
                    ))}
                </div>
            ) : macros.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                    <Zap size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-sm">
                        {searchInput ? 'Nada encontrado.' : 'Nenhuma resposta configurada.'}
                    </p>
                    {!searchInput && canManage && (
                        <button
                            onClick={() => { setEditing(null); setShowModal(true); }}
                            className="mt-4 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest"
                        >
                            Criar primeira resposta
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 px-4">
                    <AnimatePresence mode="popLayout">
                        {macros.map((macro, index) => (
                            <motion.div
                                key={macro.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2, delay: index * 0.03 }}
                                className="liquid-glass rounded-[2rem] p-6 border border-white/80 dark:border-white/10 shadow-lg group"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Ícone */}
                                    <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                        <Zap size={18} className="text-primary" />
                                    </div>

                                    {/* Conteúdo */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <span className="font-black text-slate-900 dark:text-white text-sm">
                                                {macro.shortcut.startsWith('/') ? macro.shortcut : `/${macro.shortcut}`}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                            {macro.content}
                                        </p>
                                    </div>

                                    {/* Ações */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button
                                            onClick={() => handleCopy(macro.content)}
                                            title="Copiar conteúdo"
                                            className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-100 dark:border-white/10"
                                        >
                                            <Copy size={14} />
                                        </button>
                                        {canManage && (
                                            <>
                                                <button
                                                    onClick={() => { setEditing(macro); setShowModal(true); }}
                                                    title="Editar"
                                                    className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow text-slate-400 hover:text-primary hover:bg-primary/10 transition-all border border-slate-100 dark:border-white/10"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(macro)}
                                                    disabled={deletingId === macro.id}
                                                    title="Excluir"
                                                    className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-slate-100 dark:border-white/10"
                                                >
                                                    {deletingId === macro.id
                                                        ? <RefreshCcw size={14} className="animate-spin" />
                                                        : <Trash2 size={14} />
                                                    }
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal Criar/Editar */}
            <AnimatePresence>
                {showModal && (
                    <MacroModal
                        key={editing?.id ?? 'new'}
                        macro={editing}
                        onClose={() => setShowModal(false)}
                        onSave={(saved) => {
                            if (editing) {
                                setMacros(prev => prev.map(m => m.id === saved.id ? saved : m));
                            } else {
                                setMacros(prev => [saved, ...prev]);
                            }
                            setShowModal(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
    macro: QuickReply | null;
    onClose: () => void;
    onSave: (saved: QuickReply) => void;
}

function MacroModal({ macro, onClose, onSave }: ModalProps) {
    const isNew = !macro;
    const [form, setForm] = useState({
        shortcut: macro?.shortcut ?? '',
        content: macro?.content ?? '',
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.shortcut.trim()) { toast.error('Atalho é obrigatório'); return; }
        if (!form.content.trim()) { toast.error('Conteúdo é obrigatório'); return; }

        // Garantir que comece com barra se for do estilo atalho
        let finalShortcut = form.shortcut.trim();
        if (!finalShortcut.startsWith('/')) {
            finalShortcut = '/' + finalShortcut;
        }

        setSubmitting(true);
        try {
            const result = isNew
                ? await QuickRepliesService.create({ ...form, shortcut: finalShortcut })
                : await QuickRepliesService.update(macro.id, { ...form, shortcut: finalShortcut });
            toast.success(isNew ? 'Criada!' : 'Atualizada!');
            onSave(result);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao salvar');
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-white/10 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-white/5">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                            {isNew ? 'Nova' : 'Editar'} <span className="text-primary">Macro</span>
                        </h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            Ative com / no chat de atendimento
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Atalho *
                        </label>
                        <input
                            required
                            value={form.shortcut}
                            onChange={e => setForm({ ...form, shortcut: e.target.value })}
                            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all"
                            placeholder="Ex: /ola"
                        />
                        {form.shortcut && (
                            <p className="text-[10px] text-slate-400 ml-1">
                                Digite <span className="text-primary font-black">{form.shortcut.startsWith('/') ? form.shortcut : `/${form.shortcut}`}</span> no chat para usar.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Conteúdo da Mensagem *
                        </label>
                        <textarea
                            required
                            rows={5}
                            value={form.content}
                            onChange={e => setForm({ ...form, content: e.target.value })}
                            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium dark:text-white transition-all resize-none"
                            placeholder="Olá! Seja bem-vindo ao nosso suporte. Como posso te ajudar hoje?"
                        />
                        <p className="text-[10px] text-slate-400 ml-1 text-right">{form.content.length} caracteres</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-500/5 hover:text-rose-500 active:scale-95 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {submitting
                                ? <RefreshCcw className="animate-spin h-4 w-4" />
                                : <><Save size={14} /> {isNew ? 'Criar' : 'Salvar'}</>
                            }
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
