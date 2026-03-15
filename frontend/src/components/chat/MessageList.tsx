'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { isSameDay, format, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

interface Message {
    id: string;
    content: string;
    fromMe: boolean;
    sentAt: string;
    messageType: string;
    mediaUrl?: string;
    status?: string;
    origin?: 'AGENT' | 'CLIENT' | 'AI';
}

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onReply?: (msg: any) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    messagesEndRef,
    onReply,
    onLoadMore,
    hasMore = false,
    loadingMore = false,
}) => {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);

    // Preserve scroll position when prepending older messages
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
        if (heightDiff > 0 && prevScrollHeightRef.current > 0) {
            container.scrollTop += heightDiff;
        }
        prevScrollHeightRef.current = container.scrollHeight;
    }, [messages.length]);

    // IntersectionObserver — triggers onLoadMore when sentinel enters viewport
    const handleIntersect = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            if (entries[0].isIntersecting && hasMore && !loadingMore && onLoadMore) {
                prevScrollHeightRef.current = containerRef.current?.scrollHeight ?? 0;
                onLoadMore();
            }
        },
        [hasMore, loadingMore, onLoadMore],
    );

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleIntersect]);

    const renderDateSeparator = (date: Date) => {
        let label = format(date, "d 'de' MMMM", { locale: ptBR });
        if (isSameDay(date, new Date())) label = 'Hoje';
        else if (isYesterday(date)) label = 'Ontem';

        return (
            <div className="flex justify-center my-8 relative" key={`sep-${date.getTime()}`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/5 to-transparent" />
                <span className="relative px-4 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border border-gray-100 dark:border-white/5 shadow-sm">
                    {label}
                </span>
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth"
            style={{ contain: 'strict' }}
        >
            {/* Sentinel para carregar mensagens mais antigas */}
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
                <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
            )}

            <div className="flex flex-col space-y-6">
                {messages.map((msg, index) => {
                    const currentDate = new Date(msg.sentAt);
                    const prevDate = index > 0 ? new Date(messages[index - 1].sentAt) : null;
                    const showSeparator = !prevDate || !isSameDay(currentDate, prevDate);

                    return (
                        <React.Fragment key={msg.id || index}>
                            {showSeparator && renderDateSeparator(currentDate)}
                            <MessageBubble msg={msg as any} index={index} onReply={onReply} />
                        </React.Fragment>
                    );
                })}
            </div>
            <div ref={messagesEndRef} className="h-4" />
        </div>
    );
};
