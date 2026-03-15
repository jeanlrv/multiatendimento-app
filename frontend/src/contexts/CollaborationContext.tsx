'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { toast } from 'sonner';

export interface InternalMessage {
    id: string;
    chatId: string;
    senderId: string;
    content: string;
    mediaUrl?: string;
    sentAt: string;
    sender: {
        id: string;
        name: string;
        avatar?: string;
    };
}

export interface PresenceInfo {
    userId: string;
    status: 'ONLINE' | 'OFFLINE' | 'BUSY';
}

interface CollaborationContextType {
    presence: Record<string, 'ONLINE' | 'OFFLINE' | 'BUSY'>;
    messages: InternalMessage[];
    activeChatId: string | null;
    isWidgetOpen: boolean;
    typingUsers: string[];
    setWidgetOpen: (open: boolean) => void;
    setActiveChatId: (id: string | null) => void;
    joinChat: (chatId: string) => void;
    leaveChat: (chatId: string) => void;
    sendMessage: (chatId: string, content: string, type?: string, mediaUrl?: string) => void;
    updateMyStatus: (status: 'ONLINE' | 'OFFLINE' | 'BUSY') => void;
    emitTyping: (chatId: string, isTyping: boolean) => void;
    openDirectChat: (userId: string) => Promise<void>;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token } = useAuth();
    const [presence, setPresence] = useState<Record<string, 'ONLINE' | 'OFFLINE' | 'BUSY'>>({});
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [isWidgetOpen, setWidgetOpen] = useState(false);
    const [allMessages, setAllMessages] = useState<Record<string, InternalMessage[]>>({});
    const [allTypingUsers, setAllTypingUsers] = useState<Record<string, string[]>>({});

    const socketRef = useRef<any>(null);

    useEffect(() => {
        if (!token) return;

        const socket = getSocket(token, 'collab');
        socketRef.current = socket;

        const handlePresenceUpdate = (data: PresenceInfo) => {
            setPresence(prev => ({ ...prev, [data.userId]: data.status }));
        };
        const handleNewInternalMessage = (message: InternalMessage) => {
            setAllMessages(prev => ({
                ...prev,
                [message.chatId]: [...(prev[message.chatId] || []), message]
            }));
        };
        const handleInternalTyping = (data: { chatId: string, userId: string, userName: string, isTyping: boolean }) => {
            setAllTypingUsers(prev => {
                const current = prev[data.chatId] || [];
                if (data.isTyping && !current.includes(data.userName)) {
                    return { ...prev, [data.chatId]: [...current, data.userName] };
                } else if (!data.isTyping) {
                    return { ...prev, [data.chatId]: current.filter(u => u !== data.userName) };
                }
                return prev;
            });
        };

        socket.on('presenceUpdate', handlePresenceUpdate);
        socket.on('newInternalMessage', handleNewInternalMessage);
        socket.on('internalTyping', handleInternalTyping);

        return () => {
            socket.off('presenceUpdate', handlePresenceUpdate);
            socket.off('newInternalMessage', handleNewInternalMessage);
            socket.off('internalTyping', handleInternalTyping);
        };
    }, [token]);

    const joinChat = useCallback(async (chatId: string) => {
        if (!socketRef.current) return;

        setActiveChatId(chatId);

        // Carregar histórico ANTES de emitir joinChat para evitar race condition:
        // se emitirmos primeiro, mensagens novas chegam via socket e depois
        // o setAllMessages do fetch as sobrescreveria.
        try {
            const res = await api.get(`/collaboration/chats/${chatId}/messages?limit=50`);
            const history: InternalMessage[] = res.data ?? [];

            setAllMessages(prev => {
                // Mescla: preserva mensagens que chegaram via socket durante o fetch
                const existing = prev[chatId] ?? [];
                const existingIds = new Set(existing.map(m => m.id));
                const merged = [
                    ...history.filter(m => !existingIds.has(m.id)),
                    ...existing,
                ];
                return { ...prev, [chatId]: merged };
            });
        } catch (err) {
            console.error('Erro ao carregar histórico do chat:', err);
        }

        // Somente após histórico carregado, entrar na sala para receber novas mensagens
        socketRef.current.emit('joinChat', chatId);
    }, []);

    const leaveChat = useCallback((chatId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('leaveChat', chatId);
        }
    }, []);

    const sendMessage = useCallback((chatId: string, content: string, type: string = 'TEXT', mediaUrl?: string) => {
        if (socketRef.current) {
            socketRef.current.emit('sendInternalMessage', { chatId, content, type, mediaUrl });
        }
    }, []);

    const updateMyStatus = useCallback((status: 'ONLINE' | 'OFFLINE' | 'BUSY') => {
        if (socketRef.current) {
            socketRef.current.emit('updateStatus', status);
        }
    }, []);

    const emitTyping = useCallback((chatId: string, isTyping: boolean) => {
        if (socketRef.current) {
            socketRef.current.emit('internalTyping', { chatId, isTyping });
        }
    }, []);

    const openDirectChat = async (userId: string) => {
        try {
            const res = await api.post('/collaboration/chats/direct', { userId });
            const chat = res.data;
            setWidgetOpen(true);

            if (activeChatId && activeChatId !== chat.id) {
                leaveChat(activeChatId);
            }

            joinChat(chat.id);
        } catch (error) {
            console.error('Erro ao abrir chat direto:', error);
        }
    };

    return (
        <CollaborationContext.Provider value={{
            presence,
            messages: activeChatId ? allMessages[activeChatId] || [] : [],
            activeChatId,
            isWidgetOpen,
            typingUsers: activeChatId ? allTypingUsers[activeChatId] || [] : [],
            setWidgetOpen,
            setActiveChatId,
            joinChat,
            leaveChat,
            sendMessage,
            updateMyStatus,
            emitTyping,
            openDirectChat
        }}>
            {children}
        </CollaborationContext.Provider>
    );
};

export const useCollaboration = () => {
    const context = useContext(CollaborationContext);
    if (context === undefined) {
        throw new Error('useCollaboration deve ser usado dentro de um CollaborationProvider');
    }
    return context;
};
