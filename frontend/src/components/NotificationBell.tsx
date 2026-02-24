'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_ICON: Record<string, string> = {
    'ticket.assigned': '🎫',
    'ticket.mention': '💬',
    'sla.breach': '⚠️',
    'system': '🔔',
};

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Fechar ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleClickNotification = async (n: { id: string; entityType?: string; entityId?: string; readAt?: string }) => {
        if (!n.readAt) await markRead([n.id]);
        if (n.entityType === 'ticket' && n.entityId) {
            router.push(`/dashboard/tickets?ticketId=${n.entityId}`);
            setOpen(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className={`relative p-2.5 rounded-full border transition-all ${open ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'liquid-glass border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary'}`}
                title="Notificações"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-gray-900 tabular-nums">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-14 w-[380px] z-50 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <Bell size={16} className="text-primary" />
                                <span className="font-black text-sm text-slate-800 dark:text-white">Notificações</span>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black">{unreadCount} novas</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllRead()}
                                        className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors"
                                        title="Marcar todas como lidas"
                                    >
                                        <CheckCheck size={14} />
                                        Todas lidas
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <Bell size={32} className="mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Nenhuma notificação</p>
                                    <p className="text-xs opacity-70 mt-1">Tudo em dia por aqui!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 dark:divide-white/5">
                                    {notifications.map(n => (
                                        <button
                                            key={n.id}
                                            onClick={() => handleClickNotification(n)}
                                            className={`w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-white/3 transition-colors ${!n.readAt ? 'bg-primary/3' : ''}`}
                                        >
                                            <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-sm truncate ${!n.readAt ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                                                        {n.title}
                                                    </p>
                                                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                                                </div>
                                                {n.body && (
                                                    <p className="text-xs text-slate-400 truncate mt-0.5">{n.body}</p>
                                                )}
                                                <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-1">
                                                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
