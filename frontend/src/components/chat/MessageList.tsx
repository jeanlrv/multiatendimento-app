import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
    messages: any[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, messagesEndRef }) => {
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollBtn(distanceFromBottom > 250);
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Agrupar mensagens por data para exibir separadores
    const grouped = groupMessagesByDate(messages);

    return (
        <div className="relative flex-1 overflow-hidden">
            <div
                ref={containerRef}
                className="h-full overflow-y-auto px-8 py-6 space-y-2 sober-gradient custom-scrollbar"
            >
                <AnimatePresence initial={false}>
                    {grouped.map((item, index) => {
                        if (item.type === 'separator') {
                            return (
                                <div key={`sep-${item.date}`} className="flex items-center gap-3 py-2">
                                    <div className="flex-1 h-px bg-white/10 dark:bg-white/5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/30 dark:bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                                        {item.date}
                                    </span>
                                    <div className="flex-1 h-px bg-white/10 dark:bg-white/5" />
                                </div>
                            );
                        }
                        return (
                            <MessageBubble
                                key={item.msg.id || index}
                                msg={item.msg}
                                index={index}
                            />
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Botão flutuante scroll-to-bottom */}
            <AnimatePresence>
                {showScrollBtn && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-6 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-500/30 transition-colors z-10"
                        title="Ir para o final"
                    >
                        <ChevronDown className="w-5 h-5" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};

// Agrupa mensagens por data e insere separadores
function groupMessagesByDate(messages: any[]) {
    const result: { type: 'message' | 'separator'; msg?: any; date?: string }[] = [];
    let lastDate = '';

    for (const msg of messages) {
        const dateLabel = formatDateLabel(msg.sentAt);
        if (dateLabel !== lastDate) {
            result.push({ type: 'separator', date: dateLabel });
            lastDate = dateLabel;
        }
        result.push({ type: 'message', msg });
    }

    return result;
}

function formatDateLabel(isoDate: string): string {
    const date = new Date(isoDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) return 'Hoje';
    if (isSameDay(date, yesterday)) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
