'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, X, Minimize2, Maximize2, Send,
    User, Bot, Sparkles, Image as ImageIcon, Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { useCollaboration, InternalMessage } from '@/hooks/useCollaboration';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

export const InternalChatWidget: React.FC = () => {
    const { user } = useAuth();
    const {
        presence, messages, sendMessage, joinChat, leaveChat,
        activeChatId, setActiveChatId, typingUsers, emitTyping,
        isWidgetOpen, setWidgetOpen, openDirectChat
    } = useCollaboration();

    const [isMaximized, setIsMaximized] = useState(false);
    const [chatList, setChatList] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [activeChatName, setActiveChatName] = useState<string>('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loadingChats, setLoadingChats] = useState(false);

    // Fetch user chats on open
    useEffect(() => {
        if (isWidgetOpen) {
            fetchChats();
        }
    }, [isWidgetOpen]);

    const fetchChats = async () => {
        try {
            setLoadingChats(true);
            const res = await api.get('/collaboration/chats');
            setChatList(res.data);
        } catch (error) {
            console.error('Erro ao buscar chats:', error);
        } finally {
            setLoadingChats(false);
        }
    };

    const handleSendMessage = () => {
        if (!input.trim() || !activeChatId) return;
        sendMessage(activeChatId, input);
        setInput('');
        emitTyping(activeChatId, false);
    };

    const selectChat = (chat: any) => {
        if (activeChatId) leaveChat(activeChatId);
        joinChat(chat.id);
        setActiveChatName(chat.name || 'Chat Direto');
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999]">
            <AnimatePresence>
                {!isWidgetOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setWidgetOpen(true)}
                        className="p-4 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
                    >
                        <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isWidgetOpen && (
                    <motion.div
                        drag
                        dragMomentum={false}
                        initial={{ opacity: 0, y: 100, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.95 }}
                        className={`bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden flex flex-col ${isMaximized ? 'w-[800px] h-[600px]' : 'w-[400px] h-[500px]'
                            }`}
                        style={{ cursor: 'auto' }}
                    >
                        {/* Header - Drag Zone */}
                        <div className="p-4 bg-primary flex items-center justify-between cursor-move handle">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Collab Hub</h3>
                                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-tighter">Interno & Copilot</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toast.info('Copilot está analisando o contexto...')}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-amber-400 transition-colors"
                                    title="Consultar Copilot"
                                >
                                    <Sparkles size={16} />
                                </button>
                                <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors">
                                    {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button onClick={() => setWidgetOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* List of Chats (if maximized or no active chat) */}
                            {(isMaximized || !activeChatId) && (
                                <div className={`${activeChatId && !isMaximized ? 'hidden' : 'w-72'} border-r border-gray-200 dark:border-white/10 flex flex-col`}>
                                    <div className="p-3 border-b border-gray-200 dark:border-white/10">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suas Conversas</h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                        {loadingChats ? (
                                            <div className="space-y-2">
                                                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />)}
                                            </div>
                                        ) : (
                                            chatList.map(chat => (
                                                <button
                                                    key={chat.id}
                                                    onClick={() => selectChat(chat)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeChatId === chat.id ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 dark:hover:bg-white/5'
                                                        }`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        {chat.type === 'DIRECT' ? <User size={20} /> : <Hash size={20} />}
                                                    </div>
                                                    <div className="flex-1 text-left truncate">
                                                        <p className="text-xs font-bold truncate">{chat.name || 'Chat Direto'}</p>
                                                        <p className="text-[10px] text-gray-500 truncate">{chat.messages?.[0]?.content || 'Nenhuma mensagem'}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Main Chat Area */}
                            {activeChatId ? (
                                <div className="flex-1 flex flex-col bg-gray-50 dark:bg-black/20">
                                    <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/10 flex items-center gap-3">
                                        {isMaximized && activeChatId && (
                                            <button onClick={() => setActiveChatId(null)} className="md:hidden">Voltar</button>
                                        )}
                                        <div className="flex-1">
                                            <h4 className="text-xs font-black uppercase tracking-tight">{activeChatName || 'Chat'}</h4>
                                            {typingUsers.length > 0 && (
                                                <p className="text-[9px] text-primary italic">{typingUsers.join(', ')} digitando...</p>
                                            )}
                                        </div>
                                    </div>

                                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                        {messages.map((msg) => (
                                            <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${msg.senderId === user.id
                                                    ? 'bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20'
                                                    : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm'
                                                    }`}>
                                                    <p className="font-bold text-[10px] opacity-70 mb-1">{msg.sender.name}</p>
                                                    <p className="leading-relaxed">{msg.content}</p>
                                                    <p className="text-[8px] opacity-50 mt-1 text-right">
                                                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-white/10">
                                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-2xl p-2 pr-1">
                                            <button className="p-2 hover:bg-white/10 rounded-xl text-gray-400"><ImageIcon size={18} /></button>
                                            <input
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                onFocus={() => emitTyping(activeChatId, true)}
                                                onBlur={() => emitTyping(activeChatId, false)}
                                                placeholder="Sua mensagem..."
                                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : !isMaximized && (
                                <div className="flex-1 flex items-center justify-center p-8 text-center opacity-40">
                                    <div className="space-y-4">
                                        <Sparkles className="w-12 h-12 mx-auto text-primary" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Selecione uma conversa para começar</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
