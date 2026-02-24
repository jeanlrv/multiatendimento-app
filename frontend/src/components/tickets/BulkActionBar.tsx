'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCheck, Pause, Trash2, X, RefreshCcw, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ticketsService } from '@/services/tickets';

interface BulkActionBarProps {
    selectedIds: string[];
    onClear: () => void;
    onSuccess: () => void;
}

export function BulkActionBar({ selectedIds, onClear, onSuccess }: BulkActionBarProps) {
    const [loading, setLoading] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(false);

    const handleAction = async (action: 'RESOLVE' | 'PAUSE' | 'DELETE') => {
        // Exclusão exige segundo clique de confirmação (confirmação em 2 etapas)
        if (action === 'DELETE' && !pendingDelete) {
            setPendingDelete(true);
            // Auto-cancelar após 4 segundos sem confirmação
            setTimeout(() => setPendingDelete(false), 4000);
            return;
        }

        setPendingDelete(false);
        setLoading(true);
        try {
            await ticketsService.bulkAction({ ids: selectedIds, action });
            const labels: Record<string, string> = { RESOLVE: 'Resolvidos', PAUSE: 'Pausados', DELETE: 'Excluídos' };
            toast.success(`${labels[action]}: ${selectedIds.length} ticket${selectedIds.length > 1 ? 's' : ''}.`);
            onSuccess();
        } catch (error) {
            const status = (error as any)?.response?.status;
            console.error('Erro em ação em lote:', { action, count: selectedIds.length, status });
            toast.error('Erro ao executar ação em lote. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (selectedIds.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-8 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-xl"
            >
                <div className="flex items-center gap-4 border-r border-white/10 pr-6">
                    <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center font-black text-xs">
                        {selectedIds.length}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">Selecionados</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleAction('RESOLVE')}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-emerald-400 disabled:opacity-50"
                    >
                        {loading ? <RefreshCcw className="animate-spin h-3 w-3" /> : <CheckCheck size={16} />}
                        Resolver
                    </button>

                    <button
                        onClick={() => handleAction('PAUSE')}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-amber-400 disabled:opacity-50"
                    >
                        <Pause size={16} />
                        Pausar
                    </button>

                    {/* Confirmação em 2 etapas: 1º clique pede confirmação, 2º executa */}
                    <AnimatePresence mode="wait">
                        {pendingDelete ? (
                            <motion.button
                                key="confirm"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={() => handleAction('DELETE')}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                            >
                                <AlertTriangle size={14} />
                                Confirmar — {selectedIds.length} ticket{selectedIds.length > 1 ? 's' : ''}
                            </motion.button>
                        ) : (
                            <motion.button
                                key="delete"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={() => handleAction('DELETE')}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-rose-500/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-rose-500 disabled:opacity-50"
                            >
                                <Trash2 size={16} />
                                Excluir
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                <button
                    onClick={() => { setPendingDelete(false); onClear(); }}
                    className="ml-6 p-2 hover:bg-white/10 rounded-full transition-all text-slate-400"
                    title="Limpar seleção"
                >
                    <X size={18} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
