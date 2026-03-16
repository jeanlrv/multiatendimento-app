'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Clock, X } from 'lucide-react';

interface ScheduledMessage {
    id: string;
    content: string;
    scheduledAt: string;
}

interface ScheduleMessageModalProps {
    open: boolean;
    onClose: () => void;
    message: string;
    dateTime: string;
    onDateTimeChange: (value: string) => void;
    onSchedule: () => void;
    scheduling: boolean;
    scheduledMessages: ScheduledMessage[];
    onCancelScheduled: (id: string) => void;
}

export function ScheduleMessageModal({
    open, onClose, message, dateTime, onDateTimeChange,
    onSchedule, scheduling, scheduledMessages, onCancelScheduled,
}: ScheduleMessageModalProps) {
    return (
        <AnimatePresence>
            {open && (
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
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-sm overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarClock size={16} className="text-violet-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Agendar Mensagem</h2>
                            </div>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mensagem</p>
                                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                                    {message}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Enviar em</p>
                                <input
                                    type="datetime-local"
                                    value={dateTime}
                                    onChange={(e) => onDateTimeChange(e.target.value)}
                                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                />
                            </div>
                            {dateTime && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Clock size={11} />
                                    Será enviada em {new Date(dateTime).toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                        <div className="px-5 pb-5 flex gap-2">
                            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                Cancelar
                            </button>
                            <button
                                onClick={onSchedule}
                                disabled={!dateTime || scheduling}
                                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {scheduling
                                    ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><CalendarClock size={14} /> Agendar</>
                                }
                            </button>
                        </div>

                        {scheduledMessages.length > 0 && (
                            <div className="px-5 pb-5 border-t border-slate-100 dark:border-white/10 pt-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Agendadas ({scheduledMessages.length})</p>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {scheduledMessages.map(m => (
                                        <div key={m.id} className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                            <Clock size={12} className="text-violet-500 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{m.content}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(m.scheduledAt).toLocaleString('pt-BR')}</p>
                                            </div>
                                            <button onClick={() => onCancelScheduled(m.id)} className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
