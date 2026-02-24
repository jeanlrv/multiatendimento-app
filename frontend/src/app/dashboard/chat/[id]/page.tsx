'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/lib/socket';
import { api } from '@/services/api';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import TransferTicketModal from '@/components/tickets/transfer-ticket-modal';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';

interface Message {
    id: string;
    content: string;
    fromMe: boolean;
    sentAt: string;
    messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER';
    mediaUrl?: string;
    status?: string;
    origin?: 'AGENT' | 'CLIENT' | 'AI';
}

interface Ticket {
    id: string;
    status: string;
    priority?: string;
    contact: {
        id: string;
        name: string;
        phoneNumber: string;
        email?: string | null;
        information?: string | null;
        notes?: string | null;
        riskScore?: number;
    };
    tags: {
        tag: {
            id: string;
            name: string;
            color: string;
        };
    }[];
    department?: { name: string } | null;
    assignedUser?: { name: string } | null;
}

export default function ChatPage() {
    const { id: ticketId } = useParams();
    const { user } = useAuth();
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isTyping, setIsTyping] = useState<{ userId: string; userName: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socket = getSocket(token);

        const fetchChatData = async () => {
            const [ticketResult, messagesResult] = await Promise.allSettled([
                api.get(`/tickets/${ticketId}`),
                api.get(`/chat/${ticketId}/messages?limit=50`),
            ]);

            if (ticketResult.status === 'fulfilled') {
                setTicket(ticketResult.value.data);
            } else {
                toast.error('Ticket não encontrado.');
                router.push('/dashboard/tickets');
                return;
            }

            if (messagesResult.status === 'fulfilled') {
                setMessages(messagesResult.value.data);
            } else {
                toast.error('Erro ao carregar mensagens.');
            }

            setLoading(false);
        };

        fetchChatData();
        socket.emit('joinTicket', ticketId);

        socket.on('newMessage', (message: Message) => {
            if (!message.id) return;
            setMessages(prev => {
                if (prev.find(m => m.id === message.id)) return prev;
                if (!message.fromMe) {
                    new Audio('/sounds/notification.mp3').play().catch(() => { });
                }
                return [...prev, message];
            });
        });


        socket.on('typing', (data: { userId: string; userName: string; isTyping: boolean }) => {
            if (data.userId !== user?.id) {
                setIsTyping(data.isTyping ? { userId: data.userId, userName: data.userName } : null);
            }
        });

        return () => {
            socket.emit('leaveTicket', ticketId);
            socket.off('newMessage');
            socket.off('typing');
        };
    }, [ticketId]);

    useEffect(scrollToBottom, [messages]);

    // Typing indicator: chamado pelo MessageInput via prop setNewMessage
    const handleMessageChange = (val: string) => {
        setNewMessage(val);
        const token = localStorage.getItem('token');
        if (!token) return;
        const socket = getSocket(token);
        socket.emit('startTyping', { ticketId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { ticketId });
        }, 3000);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const token = localStorage.getItem('token');
        const socket = getSocket(token!);
        socket.emit('stopTyping', { ticketId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        try {
            await api.post(`/chat/${ticketId}/send`, { content: newMessage.trim(), type: 'TEXT' });
            setNewMessage('');
        } catch {
            toast.error('Erro ao enviar mensagem. Tente novamente.');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadRes = await api.post('/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const { url, mimetype } = uploadRes.data;
            let type: Message['messageType'] = 'DOCUMENT';
            if (mimetype.startsWith('image/')) type = 'IMAGE';
            else if (mimetype.startsWith('audio/')) type = 'AUDIO';
            else if (mimetype.startsWith('video/')) type = 'VIDEO';

            await api.post(`/chat/${ticketId}/send`, { content: '', type, mediaUrl: url });
        } catch {
            toast.error('Falha ao enviar arquivo.');
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleTransferSuccess = () => {
        api.get(`/tickets/${ticketId}`).then(res => setTicket(res.data));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-160px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] glass-card rounded-[3rem] shadow-2xl overflow-hidden relative group">
            <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blur-3xl -z-10" />

            <ChatHeader ticket={ticket} onTransfer={() => setShowTransferModal(true)} />

            <MessageList messages={messages} messagesEndRef={messagesEndRef} />

            {/* Indicador de digitação */}
            <AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: -10 }}
                        className="px-8 pb-3 flex items-center gap-2"
                    >
                        <div className="flex gap-1">
                            {[0, 0.2, 0.4].map((delay) => (
                                <motion.span
                                    key={delay}
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ repeat: Infinity, duration: 1.5, delay }}
                                    className="h-1.5 w-1.5 bg-blue-500 rounded-full"
                                />
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                            {isTyping.userName} está digitando...
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>


            <MessageInput
                newMessage={newMessage}
                setNewMessage={handleMessageChange}
                onSendMessage={handleSendMessage}
                onFileUpload={handleFileUpload}
                uploading={uploading}
            />

            <TransferTicketModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                ticketId={ticketId as string}
                onSuccess={handleTransferSuccess}
            />
        </div>
    );
}
