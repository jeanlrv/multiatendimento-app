'use client';

import React, { useEffect, useState } from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, MessageCircle, Hash, Search, Circle,
    Send, Phone, Video, MoreVertical, UserPlus,
    ChevronRight, Clock
} from 'lucide-react';

interface UserInfo {
    id: string;
    name: string;
    avatar?: string | null;
    email: string;
    presence: { status: string; lastSeen: string };
}

interface ChatInfo {
    id: string;
    name?: string;
    type: string;
    members: Array<{ user: { id: string; name: string; avatar?: string | null } }>;
    messages: Array<{ content: string; sentAt: string }>;
}

const statusLabel = (s: string) => {
    if (s === 'ONLINE') return 'Online';
    if (s === 'BUSY') return 'Ocupado';
    return 'Offline';
};

const statusColor = (s: string) => {
    if (s === 'ONLINE') return 'text-emerald-500 fill-emerald-500';
    if (s === 'BUSY') return 'text-amber-500 fill-amber-500';
    return 'text-gray-400 fill-gray-400';
};

export default function CollabPage() {
    const { user } = useAuth();
    const { presence, joinChat, leaveChat, activeChatId, messages, sendMessage, openDirectChat, typingUsers, emitTyping } = useCollaboration();

    const [users, setUsers] = useState<UserInfo[]>([]);
    const [chats, setChats] = useState<ChatInfo[]>([]);
    const [activeSection, setActiveSection] = useState<'users' | 'groups'>('users');
    const [search, setSearch] = useState('');
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [usersRes, chatsRes] = await Promise.all([
                    api.get('/collaboration/users'),
                    api.get('/collaboration/chats'),
                ]);
                setUsers(usersRes.data);
                setChats(chatsRes.data);
            } catch (err) {
                console.error('Erro ao carregar colaboração:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || !activeChatId) return;
        sendMessage(activeChatId, input);
        setInput('');
        emitTyping(activeChatId, false);
    };

    const filteredUsers = users
        .filter(u => u.id !== user?.id &&
            (u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase())))
        .map(u => ({ ...u, currentStatus: presence[u.id] || u.presence?.status || 'OFFLINE' }))
        .sort((a, b) => {
            if (a.currentStatus === 'ONLINE' && b.currentStatus !== 'ONLINE') return -1;
            if (a.currentStatus !== 'ONLINE' && b.currentStatus === 'ONLINE') return 1;
            return a.name.localeCompare(b.name);
        });

    const groupChats = chats.filter(c => c.type === 'GROUP');

    const activeChat = chats.find(c => c.id === activeChatId);
    const activeChatName = activeChat?.name ||
        activeChat?.members?.find(m => m.user.id !== user?.id)?.user.name ||
        'Chat';

    return (
        <div className="liquid-glass aurora min-h-0 md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl flex flex-col md:flex-row h-auto md:h-[calc(100vh-8rem)] gap-6">
            {/* Left panel */}
            <div className="w-80 flex flex-col gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar colaboradores..."
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all shadow-sm"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl">
                    {(['users', 'groups'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSection(tab)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === tab
                                ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                        >
                            {tab === 'users' ? <><Users size={14} /> Equipe</> : <><Hash size={14} /> Grupos</>}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            [1, 2, 3, 4].map(i => (
                                <motion.div key={i} className="h-16 bg-gray-100 dark:bg-white/5 rounded-2xl animate-pulse" />
                            ))
                        ) : activeSection === 'users' ? (
                            filteredUsers.map(u => (
                                <motion.button
                                    layout
                                    key={u.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onClick={() => openDirectChat(u.id)}
                                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all group shadow-none hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                                >
                                    <div className="relative flex-shrink-0">
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.name} className="w-11 h-11 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold">
                                                {u.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-white dark:bg-slate-900 rounded-full">
                                            <Circle className={`w-3 h-3 ${statusColor(u.currentStatus)}`} />
                                        </div>
                                    </div>
                                    <div className="flex-1 text-left truncate">
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-primary transition-colors">
                                            {u.name}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400">{statusLabel(u.currentStatus)}</p>
                                    </div>
                                    <MessageCircle size={16} className="text-gray-300 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                                </motion.button>
                            ))
                        ) : (
                            groupChats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 opacity-40 gap-2">
                                    <Hash size={32} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum grupo ainda</p>
                                </div>
                            ) : (
                                groupChats.map(chat => (
                                    <motion.button
                                        layout
                                        key={chat.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={() => { if (activeChatId) leaveChat(activeChatId); joinChat(chat.id); }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${activeChatId === chat.id ? 'bg-primary/10 border-primary/30 text-primary' : 'hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-gray-200 dark:hover:border-white/10'}`}
                                    >
                                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                            <Hash size={20} />
                                        </div>
                                        <div className="flex-1 text-left truncate">
                                            <p className="text-sm font-bold truncate">{chat.name || 'Grupo'}</p>
                                            <p className="text-[10px] text-gray-400">{chat.members?.length || 0} membros</p>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-300" />
                                    </motion.button>
                                ))
                            )
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                {!activeChatId ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4">
                        <MessageCircle size={56} strokeWidth={1} />
                        <div className="text-center">
                            <p className="font-black text-lg uppercase tracking-widest">Hub de Colaboração</p>
                            <p className="text-sm mt-1">Selecione um colaborador para iniciar um chat</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat header */}
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {activeChatName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight">{activeChatName}</h3>
                                    {typingUsers.length > 0 ? (
                                        <p className="text-[10px] text-primary italic animate-pulse">{typingUsers.join(', ')} digitando...</p>
                                    ) : (
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Chat interno</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-primary transition-colors" title="Chamada de voz (em breve)">
                                    <Phone size={16} />
                                </button>
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-primary transition-colors" title="Videochamada (em breve)">
                                    <Video size={16} />
                                </button>
                                <button className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-primary transition-colors">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full opacity-20 gap-2">
                                    <Clock size={32} strokeWidth={1} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem ainda</p>
                                </div>
                            )}
                            <AnimatePresence initial={false}>
                                {messages.map(msg => {
                                    const isMine = msg.senderId === user?.id;
                                    return (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {!isMine && (
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold mr-2 flex-shrink-0 self-end">
                                                    {msg.sender.name.charAt(0)}
                                                </div>
                                            )}
                                            <div className={`max-w-[70%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                                                {!isMine && (
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter px-3">{msg.sender.name}</p>
                                                )}
                                                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine
                                                    ? 'bg-primary text-white rounded-tr-sm shadow-lg shadow-primary/20'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                                <p className={`text-[9px] text-gray-400 px-3 ${isMine ? 'text-right' : 'text-left'}`}>
                                                    {new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-100 dark:border-white/10">
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl p-2 pr-2">
                                <input
                                    value={input}
                                    onChange={e => { setInput(e.target.value); activeChatId && emitTyping(activeChatId, e.target.value.length > 0); }}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    onBlur={() => activeChatId && emitTyping(activeChatId, false)}
                                    placeholder="Digite uma mensagem..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm py-1 px-2"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
