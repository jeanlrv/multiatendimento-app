'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRightLeft, X } from 'lucide-react';

interface MergeTicketModalProps {
    open: boolean;
    onClose: () => void;
    selectedTicket: { id: string } | null;
    mergeSearch: string;
    onSearchChange: (q: string) => void;
    mergeResults: any[];
    onMerge: (id: string) => void;
    merging: boolean;
}

export function MergeTicketModal({
    open, onClose, selectedTicket, mergeSearch, onSearchChange,
    mergeResults, onMerge, merging,
}: MergeTicketModalProps) {
    return (
        <AnimatePresence>
            {open && selectedTicket && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: -10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-md overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ArrowRightLeft size={16} className="text-violet-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Mesclar Ticket</h2>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300">
                                As mensagens e tags do ticket <strong>#{selectedTicket.id.slice(-6)}</strong> serão transferidas para o ticket de destino. O ticket de origem será fechado.
                            </div>
                            <input
                                value={mergeSearch}
                                onChange={e => onSearchChange(e.target.value)}
                                placeholder="Buscar ticket de destino..."
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                            />
                            <div className="max-h-52 overflow-y-auto space-y-2">
                                {mergeResults.length === 0 && mergeSearch.length >= 2 && (
                                    <p className="text-xs text-center text-slate-400 py-4">Nenhum ticket encontrado</p>
                                )}
                                {mergeResults.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => onMerge(t.id)}
                                        disabled={merging}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/20 text-left transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-800 disabled:opacity-50"
                                    >
                                        <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center text-sm">
                                            {t.department?.emoji || '💬'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.contact?.name || 'Sem contato'}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{t.subject || 'Sem assunto'} · {t.department?.name}</p>
                                        </div>
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 shrink-0">
                                            #{t.id.slice(-6)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
