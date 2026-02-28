import React from 'react';
import { MessageBubble } from './MessageBubble';
import { isSameDay, format, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

export const MessageList: React.FC<MessageListProps> = ({ messages, messagesEndRef, onReply }) => {

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
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
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
