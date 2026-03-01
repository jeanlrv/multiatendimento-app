'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { api } from '@/services/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Send, Phone, User, Clock, CheckCheck, Paperclip, MoreVertical, ArrowRightLeft, Smile, Search, SlidersHorizontal, MessageSquare, Bot, Sparkles, AlertTriangle, Plus, X, Mic, Tag as TagIcon, Info, Calendar, ArrowLeft, Copy, Edit3, CornerUpLeft, UploadCloud, ChevronDown } from 'lucide-react';
import { AudioRecorder } from '@/components/chat/AudioRecorder';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { CreateTicketModal } from '@/components/tickets/create-ticket-modal';
import TransferTicketModal from '@/components/tickets/transfer-ticket-modal';
import { CreateScheduleModal } from '@/components/chat/CreateScheduleModal';
import { SlaIndicator } from '@/components/chat/SlaIndicator';
import { translateStatus, getStatusColor } from '@/lib/translations';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SentimentIndicator } from '@/components/chat/SentimentIndicator';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { BulkActionBar } from '@/components/tickets/BulkActionBar';
import { ticketsService } from '@/services/tickets';
import { usersService } from '@/services/users';

interface Message {
    id: string;
    content: string;
    fromMe: boolean;
    sentAt: string;
    messageType: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'INTERNAL';
    mediaUrl?: string;
    transcription?: string;
    quotedMessageId?: string;
    quotedMessage?: {
        content: string;
        fromMe: boolean;
    };
}

interface Ticket {
    id: string;
    status: string;
    priority: string;
    subject: string;
    updatedAt: string;
    contactId: string;
    contact: {
        id?: string;
        name: string;
        phoneNumber: string;
        information?: string;
    };
    department: {
        id: string;
        name: string;
        emoji?: string;
        color?: string;
    };
    mode: 'AI' | 'HUMANO' | 'HIBRIDO';
    unreadMessages: number;
    notes?: string;
    evaluation?: {
        aiSentiment: string;
        aiSentimentScore: number;
        aiSummary: string;
        aiJustification: string;
    } | any;
    assignedUser?: {
        id: string;
        name: string;
        avatar?: string;
    };
    tags?: {
        tag: {
            id: string;
            name: string;
            color: string;
        }
    }[];
}


export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    // Ref para evitar stale closures nos handlers globais de WebSocket
    const selectedTicketRef = useRef<Ticket | null>(null);
    useEffect(() => { selectedTicketRef.current = selectedTicket; }, [selectedTicket]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [filter, setFilter] = useState('OPEN');
    const [showContactHistory, setShowContactHistory] = useState(false);
    const [contactHistory, setContactHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Edição Inline
    const [isEditingSubject, setIsEditingSubject] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedSubject, setEditedSubject] = useState('');
    const [editedNotes, setEditedNotes] = useState('');
    const [updatingInfo, setUpdatingInfo] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [isTyping, setIsTyping] = useState<{ userId: string, userName: string } | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [messageSearch, setMessageSearch] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isInternal, setIsInternal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
    const [showCopilot, setShowCopilot] = useState(false);
    const [sending, setSending] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Anexos
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Quick Replies (Macros) & Autocomplete
    const [macros, setMacros] = useState<{ id: string, shortcut: string, content: string }[]>([]);
    const [showMacroMenu, setShowMacroMenu] = useState(false);
    const [macroFilter, setMacroFilter] = useState('');
    const [macroSelectedIndex, setMacroSelectedIndex] = useState(0);

    const [availableTags, setAvailableTags] = useState<{ id: string, name: string, color: string }[]>([]);
    const [mentionableUsers, setMentionableUsers] = useState<{ id: string, name: string, email: string, avatar?: string }[]>([]);
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [advancedFilters, setAdvancedFilters] = useState({
        priority: '',
        connectionId: '',
        tags: [] as string[],
        startDate: '',
        endDate: '',
        assignedUserId: '',
        departments: [] as string[]
    });
    const [showFilters, setShowFilters] = useState(false);
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [connections, setConnections] = useState<{ id: string, name: string }[]>([]);

    // Atalhos de navegação na lista de tickets
    useKeyboardShortcuts([
        {
            key: 'j',
            description: 'Próximo ticket',
            action: () => {
                if (tickets.length > 0) {
                    const nextIndex = Math.min(selectedTicketIndex + 1, tickets.length - 1);
                    setSelectedTicketIndex(nextIndex);
                }
            },
        },
        {
            key: 'k',
            description: 'Ticket anterior',
            action: () => {
                if (tickets.length > 0) {
                    const prevIndex = Math.max(selectedTicketIndex - 1, 0);
                    setSelectedTicketIndex(prevIndex);
                }
            },
        },
        {
            key: 'Enter',
            description: 'Abrir ticket selecionado',
            action: () => {
                if (tickets.length > 0 && tickets[selectedTicketIndex]) {
                    handleSelectTicket(tickets[selectedTicketIndex]);
                }
            },
        },
    ]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const response = await ticketsService.findAll({
                status: filter,
                search: searchTerm,
                priority: advancedFilters.priority,
                connectionId: advancedFilters.connectionId,
                tags: advancedFilters.tags,
                startDate: advancedFilters.startDate,
                endDate: advancedFilters.endDate,
                assignedUserId: advancedFilters.assignedUserId,
                departmentId: advancedFilters.departments.join(',')
            });
            // Backend retorna paginado: { data: Ticket[], meta: {...} }
            setTickets(Array.isArray(response) ? response : (response?.data ?? []));
        } catch (error) {
            console.error('Erro ao buscar tickets:', error);
            toast.error('Não foi possível carregar os atendimentos.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMetadata = async () => {
        const [tagsResult, deptsResult, connResult, macrosResult] = await Promise.allSettled([
            api.get('/tags'),
            api.get('/departments'),
            api.get('/whatsapp'),
            api.get('/quick-replies'),
        ]);

        if (tagsResult.status === 'fulfilled') setAvailableTags(tagsResult.value.data);
        if (deptsResult.status === 'fulfilled') setDepartments(deptsResult.value.data);
        if (connResult.status === 'fulfilled') setConnections(connResult.value.data);
        if (macrosResult.status === 'fulfilled') setMacros(macrosResult.value.data);

        try {
            const mentionsRes = await usersService.getMentionable();
            setMentionableUsers(mentionsRes);
        } catch {
            // mentionableUsers é opcional — não bloqueia a tela
        }
    };

    const fetchMessages = async (ticketId: string) => {
        try {
            setLoadingMessages(true);
            const [ticketRes, messagesRes] = await Promise.all([
                api.get(`/tickets/${ticketId}`),
                api.get(`/chat/${ticketId}/messages`),
            ]);
            setSelectedTicket(ticketRes.data);
            setMessages(messagesRes.data);
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const fetchContactHistory = async (contactId: string) => {
        setLoadingHistory(true);
        try {
            const response = await api.get(`/tickets?contactId=${contactId}&status=RESOLVED`);
            setContactHistory(response.data?.data || response.data || []);
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleUpdateTicketInfo = async (data: { subject?: string, notes?: string }) => {
        if (!selectedTicket) return;
        setUpdatingInfo(true);
        try {
            await ticketsService.update(selectedTicket.id, data);
            setSelectedTicket(prev => prev ? { ...prev, ...data } : null);
            fetchTickets();
            toast.success("Informações atualizadas!");
            setIsEditingSubject(false);
            setIsEditingNotes(false);
        } catch (error) {
            toast.error("Erro ao atualizar informações");
        } finally {
            setUpdatingInfo(false);
        }
    };

    const handleSelectTicket = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        fetchMessages(ticket.id);
        if (showContactHistory) {
            fetchContactHistory(ticket.contactId);
        }
        const index = tickets.findIndex(t => t.id === ticket.id);
        if (index !== -1) setSelectedTicketIndex(index);
        router.push(`/dashboard/tickets?id=${ticket.id}`, { scroll: false });

        // Recuperar Rascunho (Draft)
        const draft = localStorage.getItem(`draft_${ticket.id}`);
        setNewMessage(draft || '');
        setShowMacroMenu(false);

        // Marcar como lido no backend se houver mensagens não lidas
        if (ticket.unreadMessages > 0) {
            try {
                await api.post(`/chat/${ticket.id}/read`, {});
                // Atualizar localmente para remover o badge imediatamente
                setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, unreadMessages: 0 } : t));
            } catch (error) {
                console.error('Erro ao marcar como lido:', error);
            }
        }
    };


    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTicket || sending) return;

        try {
            setSending(true);
            await api.post(`/chat/${selectedTicket.id}/send`, {
                content: newMessage,
                type: isInternal ? 'INTERNAL' : 'TEXT',
                quotedMessageId: replyingTo?.id || undefined,
            });
            setNewMessage('');
            localStorage.removeItem(`draft_${selectedTicket.id}`);
            setIsInternal(false);
            setReplyingTo(null);
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            toast.error('Não foi possível enviar a mensagem.');
        } finally {
            setSending(false);
        }
    };

    const handleSendAudio = async (blob: Blob) => {
        if (!selectedTicket) return;
        try {
            const formData = new FormData();
            formData.append('file', blob, 'audio.webm');

            const uploadRes = await api.post('/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            await api.post(`/chat/${selectedTicket.id}/send`, {
                content: 'Áudio enviado',
                type: 'AUDIO',
                mediaUrl: uploadRes.data.url,
            });
            setIsRecording(false);
        } catch (error) {
            console.error('Erro ao enviar áudio:', error);
            toast.error('Erro ao enviar áudio');
        }
    };

    const uploadAndSendFile = async (file: File) => {
        if (!selectedTicket || uploadingFile) return;
        try {
            setUploadingFile(true);
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await api.post('/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            // Determinar o tipo aproximado com base no mimetype
            let type = 'DOCUMENT';
            if (file.type.startsWith('image/')) type = 'IMAGE';
            else if (file.type.startsWith('video/')) type = 'VIDEO';
            else if (file.type.startsWith('audio/')) type = 'AUDIO';

            await api.post(`/chat/${selectedTicket.id}/send`, {
                content: file.name,
                type: type,
                mediaUrl: uploadRes.data.url,
            });
            toast.success('Arquivo enviado com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar arquivo:', error);
            toast.error('Erro ao enviar o arquivo.');
        } finally {
            setUploadingFile(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadAndSendFile(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (selectedTicket) setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (!selectedTicket) return;
        const file = e.dataTransfer.files?.[0];
        if (file) {
            await uploadAndSendFile(file);
        }
    };

    const handleMessageChange = (val: string) => {
        setNewMessage(val);

        if (selectedTicket) {
            localStorage.setItem(`draft_${selectedTicket.id}`, val);
        }

        // Lógica de Macro (/)
        const lastSlashIndex = val.lastIndexOf('/');
        if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || val[lastSlashIndex - 1] === ' ' || val[lastSlashIndex - 1] === '\n')) {
            const query = val.slice(lastSlashIndex + 1);
            setMacroFilter(query);
            setShowMacroMenu(true);
            setMacroSelectedIndex(0);
        } else {
            setShowMacroMenu(false);
        }

        // Lógica de Menção (@)
        const lastAtIndex = val.lastIndexOf('@');
        if (isInternal && lastAtIndex !== -1 && (lastAtIndex === 0 || val[lastAtIndex - 1] === ' ' || val[lastAtIndex - 1] === '\n')) {
            const query = val.slice(lastAtIndex + 1);
            setMentionFilter(query);
            setShowMentionMenu(true);
            setMentionSelectedIndex(0);
        } else {
            setShowMentionMenu(false);
        }

        if (!selectedTicket) return;

        const token = localStorage.getItem('token');
        if (!token) return;
        if (!socket) return;

        socket.emit('startTyping', { ticketId: selectedTicket.id });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { ticketId: selectedTicket.id });
        }, 3000);
    };


    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchTickets();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [filter, searchTerm, advancedFilters]);

    useEffect(() => {
        fetchMetadata();
    }, []);

    const resetFilters = () => {
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
        setAdvancedFilters({
            priority: '',
            connectionId: '',
            tags: [],
            startDate: '',
            endDate: '',
            assignedUserId: '',
            departments: isAdmin ? [] : (user?.departments?.map(d => d.id) || [])
        });
        setSearchTerm('');
    };

    useEffect(() => {
        const ticketId = searchParams.get('id');
        if (ticketId && tickets.length > 0) {
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket) {
                handleSelectTicket(ticket);
            }
        }
    }, [searchParams, tickets]);

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const totalUnread = tickets.reduce((acc, t) => acc + (t.unreadMessages || 0), 0);
        if (totalUnread > 0) {
            document.title = `(${totalUnread}) Novos Atendimentos | Aero`;
        } else {
            document.title = 'Tickets | Aero';
        }
    }, [tickets]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const socketInstance = getSocket(token);
        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    // ─── Listeners GLOBAIS (rodam apenas 1x quando socket conecta) ──────────
    useEffect(() => {
        if (!socket) return;

        const handleGlobalMessage = (data: { ticketId: string, message: Message }) => {
            const { ticketId, message } = data;
            setTickets(prev => {
                const ticketIndex = prev.findIndex(t => t.id === ticketId);
                if (ticketIndex === -1) return prev;

                const updatedTickets = [...prev];
                const ticket = { ...updatedTickets[ticketIndex] };

                if (!message.fromMe) {
                    // Usa ref do selectedTicket para evitar stale closure
                    const selectedId = selectedTicketRef.current?.id;
                    if (selectedId !== ticketId) {
                        ticket.unreadMessages = (ticket.unreadMessages || 0) + 1;
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
                        audio.play().catch(() => { });
                        if (Notification.permission === 'granted') {
                            new Notification(`Mensagem de ${ticket.contact.name}`, {
                                body: message.content || '📎 Mídia',
                                icon: '/logo.png'
                            });
                        }
                    }
                }

                ticket.updatedAt = message.sentAt;
                updatedTickets.splice(ticketIndex, 1);
                updatedTickets.unshift(ticket);
                return updatedTickets;
            });
        };

        const handleMention = (data: { ticketId: string, messageId: string, mentionContent: string }) => {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
            audio.play().catch(() => { });
            toast(`Você foi mencionado!`, {
                description: data.mentionContent,
                action: {
                    label: 'Ver',
                    onClick: () => {
                        if (selectedTicketRef.current?.id !== data.ticketId) {
                            router.push(`/dashboard/tickets?id=${data.ticketId}`);
                        }
                    }
                }
            });
        };

        socket.on('globalMessage', handleGlobalMessage);
        socket.on('mention', handleMention);

        return () => {
            socket.off('globalMessage', handleGlobalMessage);
            socket.off('mention', handleMention);
        };
    }, [socket]);

    // ─── Listeners ESPECÍFICOS DO TICKET (troca a cada ticket selecionado) ────
    useEffect(() => {
        if (!selectedTicket || !socket) return;

        socket.emit('joinTicket', selectedTicket.id);

        const handleNewMessage = (message: Message) => {
            if (!message.id) return;
            setMessages(prev => {
                if (prev.find(m => m.id === message.id)) return prev;
                if (!message.fromMe) {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
                    audio.play().catch(() => { });
                }
                return [...prev, message];
            });
        };

        const handleSentiment = (data: any) => {
            if (data.ticketId === selectedTicket.id) {
                setSelectedTicket(prev => prev ? { ...prev, evaluation: data } : null);
            }
        };

        const handleTyping = (data: { userId: string, userName: string, isTyping: boolean }) => {
            if (data.userId !== user?.id) {
                setIsTyping(data.isTyping ? { userId: data.userId, userName: data.userName } : null);
            }
        };

        const handleStatusUpdate = (data: { messageId: string, status: string }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === data.messageId ? { ...msg, status: data.status } : msg
            ));
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('sentimentUpdate', handleSentiment);
        socket.on('typing', handleTyping);
        socket.on('messageStatusUpdate', handleStatusUpdate);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('sentimentUpdate', handleSentiment);
            socket.off('typing', handleTyping);
            socket.off('messageStatusUpdate', handleStatusUpdate);
        };
    }, [selectedTicket?.id, socket]);

    // Carrega histórico do contato sempre que o painel é aberto ou o ticket muda
    useEffect(() => {
        if (showContactHistory && selectedTicket) {
            const contactId = selectedTicket.contactId || selectedTicket.contact?.id;
            if (contactId) fetchContactHistory(contactId);
        }
    }, [showContactHistory, selectedTicket?.id]);

    // Fecha emoji picker ao clicar fora
    useEffect(() => {
        if (!showEmojiPicker) return;
        const handler = (e: MouseEvent) => { setShowEmojiPicker(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    // Fecha menu de opções ao clicar fora
    useEffect(() => {
        if (!showOptionsMenu) return;
        const handler = (e: MouseEvent) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
                setShowOptionsMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showOptionsMenu]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleToggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedTicketIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    return (
        <div className="flex flex-col md:flex-row h-full gap-3 md:gap-4 max-w-full relative overflow-hidden">
            {/* Lista de Tickets - Esquerda */}
            <div className={`w-full md:w-[300px] lg:w-[340px] xl:w-[380px] h-full flex-shrink-0 flex flex-col liquid-glass md:rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl relative aurora transition-all duration-300 ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                {/* Header da Lista */}
                <div className="p-3 md:p-4 border-b border-slate-200 dark:border-white/5 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {/* Checkbox Selecionar Todos */}
                            <div
                                onClick={() => {
                                    if (selectedTicketIds.length === tickets.length) {
                                        setSelectedTicketIds([]);
                                    } else {
                                        setSelectedTicketIds(tickets.map(t => t.id));
                                    }
                                }}
                                className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${selectedTicketIds.length === tickets.length && tickets.length > 0
                                    ? 'bg-primary border-primary text-white'
                                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800'
                                    }`}
                            >
                                {selectedTicketIds.length === tickets.length && tickets.length > 0 && <CheckCheck size={12} />}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">Fluxo Aero</h2>
                        </div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="p-3 bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                        >
                            <Plus className="h-4 w-4" /> Novo
                        </button>
                    </div>

                    {/* Barra de Busca */}
                    <div className="relative mb-3 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar atendimento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-12 py-3.5 bg-slate-100/50 dark:bg-white/5 border border-transparent focus:border-primary/30 rounded-2xl text-xs font-bold outline-none transition-all placeholder:text-slate-400"
                        />
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${showFilters || Object.values(advancedFilters).some(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)) ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                        >
                            <SlidersHorizontal size={16} />
                        </button>
                    </div>

                    {/* Filtros Rápidos de Setor — sempre visível */}
                    {(() => {
                        const visibleDepts = (user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') ? departments : (user?.departments || []);
                        if (visibleDepts.length === 0) return null;
                        return (
                            <div className="mb-4 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Setores</p>
                                <div className="flex flex-wrap gap-2">
                                    {visibleDepts.map((dep: any) => (
                                        <button
                                            key={dep.id}
                                            onClick={() => {
                                                setAdvancedFilters(prev => ({
                                                    ...prev,
                                                    departments: prev.departments.includes(dep.id)
                                                        ? prev.departments.filter((id: string) => id !== dep.id)
                                                        : [...prev.departments, dep.id]
                                                }));
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${advancedFilters.departments.includes(dep.id)
                                                ? 'bg-primary/20 border-primary/30 text-primary shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                                                : 'bg-white/50 border-slate-200 dark:bg-white/5 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-primary/20 hover:text-primary dark:hover:border-white/20'
                                                }`}
                                        >
                                            {dep.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Filtros Avançados Expansíveis */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-5 space-y-4"
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={advancedFilters.priority}
                                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, priority: e.target.value }))}
                                        className="bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-[10px] font-black uppercase tracking-widest outline-none"
                                    >
                                        <option value="">Prioridade</option>
                                        <option value="LOW">Baixa</option>
                                        <option value="MEDIUM">Média</option>
                                        <option value="HIGH">Alta</option>
                                        <option value="CRITICAL">Urgente</option>
                                    </select>
                                    <select
                                        value={advancedFilters.connectionId}
                                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, connectionId: e.target.value }))}
                                        className="bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-[10px] font-black uppercase tracking-widest outline-none"
                                    >
                                        <option value="">Conexão</option>
                                        {connections.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro por Agente Responsável */}
                                <select
                                    value={advancedFilters.assignedUserId}
                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, assignedUserId: e.target.value }))}
                                    className="w-full bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-[10px] font-black uppercase tracking-widest outline-none"
                                >
                                    <option value="">Responsável</option>
                                    {mentionableUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>

                                {/* Filtro por Tags */}
                                {availableTags.length > 0 && (
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Tags</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableTags.map(tag => {
                                                const isSelected = advancedFilters.tags?.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => setAdvancedFilters(prev => ({
                                                            ...prev,
                                                            tags: isSelected
                                                                ? (prev.tags || []).filter((t: string) => t !== tag.id)
                                                                : [...(prev.tags || []), tag.id]
                                                        }))}
                                                        className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all ${isSelected ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-primary/20'}`}
                                                        style={{ color: isSelected ? undefined : tag.color }}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Filtro por Datas */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">De</div>
                                        <input
                                            type="date"
                                            value={advancedFilters.startDate || ''}
                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="w-full bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-[10px] font-bold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Até</div>
                                        <input
                                            type="date"
                                            value={advancedFilters.endDate || ''}
                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="w-full bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-[10px] font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={resetFilters}
                                        className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
                                    >
                                        Limpar Filtros
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Filtros Estilo Cápsula */}
                    <div className="flex items-center gap-1 bg-slate-200/40 dark:bg-white/5 p-1 rounded-xl border border-white/50 dark:border-white/5">
                        {['OPEN', 'IN_PROGRESS', 'PAUSED', 'RESOLVED'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all duration-300 tracking-wide uppercase ${filter === s
                                    ? 'bg-white dark:bg-primary text-slate-900 dark:text-white shadow-lg shadow-black/5'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {s === 'OPEN' ? 'Abertos' : s === 'IN_PROGRESS' ? 'Em Atend.' : s === 'PAUSED' ? 'Pausados' : 'Final.'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista Scrollável */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative z-10">
                    {loading ? (
                        [1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="p-4 rounded-2xl bg-slate-100/50 dark:bg-white/5 border border-transparent animate-pulse space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-white/10" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded-lg" />
                                        <div className="h-2 w-16 bg-slate-200 dark:bg-white/10 rounded-lg" />
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-lg" />
                            </div>
                        ))
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                            <Bot className="h-12 w-12 mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest">Vazio</p>
                        </div>
                    ) : (
                        tickets.map((ticket, idx) => (
                            <motion.button
                                key={ticket.id}
                                onClick={() => handleSelectTicket(ticket)}
                                className={`w-full text-left p-2.5 rounded-2xl transition-all border relative group/card ${selectedTicket?.id === ticket.id
                                    ? 'bg-primary/10 border-primary shadow-md shadow-primary/5'
                                    : 'bg-white/60 dark:bg-transparent border-transparent hover:border-white/40 dark:hover:border-white/10'
                                    } ${selectedTicketIds.includes(ticket.id) ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 border-primary bg-primary/5' : ''}`}
                                whileHover={{ x: 5 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {/* Checkbox para seleção em lote */}
                                <div
                                    onClick={(e) => handleToggleSelection(ticket.id, e)}
                                    className={`absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all z-20 ${selectedTicketIds.includes(ticket.id)
                                        ? 'bg-primary border-primary text-white'
                                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 opacity-0 group-hover/card:opacity-100'
                                        }`}
                                >
                                    {selectedTicketIds.includes(ticket.id) && <CheckCheck size={12} />}
                                </div>
                                <div className={`flex items-start justify-between mb-2 transition-transform ${selectedTicketIds.length > 0 || selectedTicketIds.includes(ticket.id) ? 'pl-6' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div
                                                className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-base transition-all duration-500 ${selectedTicket?.id === ticket.id
                                                    ? 'text-white shadow-lg'
                                                    : 'bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-gray-400'
                                                    }`}
                                                style={{
                                                    backgroundColor: selectedTicket?.id === ticket.id
                                                        ? (ticket.department.color || '#2563eb')
                                                        : undefined,
                                                    boxShadow: selectedTicket?.id === ticket.id
                                                        ? `0 10px 20px ${(ticket.department.color || '#2563eb')}40`
                                                        : undefined
                                                }}
                                            >
                                                {ticket.department.emoji || ticket.contact.name.charAt(0)}
                                            </div>
                                            {/* Badge de Prioridade */}
                                            {ticket.priority !== 'MEDIUM' && (
                                                <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${ticket.priority === 'CRITICAL' ? 'bg-rose-500' :
                                                    ticket.priority === 'HIGH' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 transition-transform flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <h3 className={`text-[13px] font-black tracking-tight leading-none truncate ${selectedTicket?.id === ticket.id ? 'text-primary' : 'text-slate-800 dark:text-white'}`}>
                                                        {ticket.contact.name || 'Contato'}
                                                    </h3>
                                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded-md shrink-0">
                                                        #{ticket.id.substring(ticket.id.length - 4).toUpperCase()}
                                                    </span>
                                                    {ticket.unreadMessages > 0 && (
                                                        <span className="h-1.5 w-1.5 bg-primary rounded-full animate-ping shrink-0" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                    {ticket.assignedUser && (
                                                        <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-1 py-0.5 rounded-md border border-blue-100 dark:border-blue-500/20">
                                                            <User size={8} className="text-blue-600 dark:text-blue-400" />
                                                            <span className="text-[7.5px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                                                {ticket.assignedUser.name.split(' ')[0]}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[7.5px] font-black uppercase tracking-tighter ${selectedTicket?.id === ticket.id ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                                        {translateStatus(ticket.status)}
                                                    </span>
                                                </div>
                                            </div>

                                            {ticket.subject && (
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                                    {ticket.subject}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap gap-1 overflow-hidden max-h-5">
                                                {ticket.tags?.slice(0, 2).map((t: any) => (
                                                    <span
                                                        key={t.tag.id}
                                                        className="px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/20 truncate max-w-[80px]"
                                                        style={{ backgroundColor: `${t.tag.color}20`, color: t.tag.color }}
                                                    >
                                                        {t.tag.name}
                                                    </span>
                                                ))}
                                                {(ticket.tags?.length || 0) > 2 && (
                                                    <span className="text-[7px] font-black text-slate-400 self-center">
                                                        +{(ticket.tags?.length || 0) - 2}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="flex items-center gap-2">
                                                    <p
                                                        className="text-[10px] font-black uppercase tracking-widest italic"
                                                        style={{ color: ticket.department.color || undefined, opacity: selectedTicket?.id === ticket.id ? 1 : 0.6 }}
                                                    >
                                                        {ticket.department.name}
                                                    </p>
                                                    <div className="h-1 w-1 bg-slate-300 rounded-full" />
                                                    <p className="text-[10px] font-bold opacity-40">
                                                        {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <SlaIndicator ticket={ticket as any} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.button>
                        ))
                    )}
                </div>
            </div>

            {/* Conversa - Direita */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex-1 w-full flex flex-col liquid-glass md:rounded-2xl relative transition-all duration-300 ${!selectedTicket ? 'hidden md:flex' : 'flex absolute inset-0 md:relative z-20 md:z-auto bg-slate-50 dark:bg-gray-900 md:bg-transparent dark:md:bg-transparent'}`}
                style={{ overflow: 'visible' }}
            >
                {/* Overlay de Drag and Drop */}
                <AnimatePresence>
                    {isDragging && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-primary/90 backdrop-blur-sm rounded-[2.5rem] border-4 border-dashed border-white"
                        >
                            <div className="flex flex-col items-center justify-center text-white">
                                <UploadCloud className="h-20 w-20 mb-4 animate-bounce" />
                                <h3 className="text-2xl font-black uppercase tracking-widest">Solte o arquivo aqui</h3>
                                <p className="text-sm font-medium opacity-80 mt-2">O documento será enviado imediatamente para o chat.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!selectedTicket ? (
                    <div className="flex-1 hidden md:flex flex-col items-center justify-center text-center p-12 aurora">
                        <div className="h-40 w-40 bg-primary/10 rounded-full flex items-center justify-center mb-10 shadow-inner">
                            <MessageSquare className="h-16 w-16 text-primary animate-pulse" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter">Central de Mensagens</h3>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-[0.2em] max-w-sm">
                            Selecione um fluxo para iniciar o atendimento <span className="text-primary italic">Aero</span>.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header da Conversa */}
                        <div className="p-2 md:p-3 border-b border-white/40 dark:border-white/5 flex flex-col gap-2 bg-white/40 dark:bg-black/20 backdrop-blur-xl shrink-0 min-w-0 md:rounded-t-2xl overflow-hidden border-x border-t border-slate-200 dark:border-white/10">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <button
                                        onClick={() => setSelectedTicket(null)}
                                        className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex-shrink-0"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div className="h-9 w-9 bg-primary text-white rounded-xl flex items-center justify-center text-base font-black shadow-md shadow-primary/30 relative overflow-hidden flex-shrink-0">
                                        {selectedTicket.contact.name.charAt(0)}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white tracking-tight leading-none truncate max-w-[120px] md:max-w-[200px]">{selectedTicket.contact.name}</h3>
                                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20">
                                                    #{selectedTicket.id.substring(selectedTicket.id.length - 6).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {selectedTicket.assignedUser ? (
                                                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-100 dark:border-blue-500/20">
                                                        <User size={10} className="text-blue-600 dark:text-blue-400" />
                                                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                                                            {selectedTicket.assignedUser.name.split(' ')[0]}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        disabled={isAssigning}
                                                        onClick={async () => {
                                                            try {
                                                                setIsAssigning(true);
                                                                await ticketsService.assign(selectedTicket.id, user!.id);
                                                                setSelectedTicket(prev => prev ? { ...prev, assignedUser: user as any } : null);
                                                                fetchTickets();
                                                                toast.success("Você assumiu!");
                                                            } catch (error) {
                                                                toast.error("Erro ao assumir");
                                                            } finally {
                                                                setIsAssigning(false);
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-xl border border-amber-100 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none">
                                                            Atender
                                                        </span>
                                                    </button>
                                                )}
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${selectedTicket.mode === 'AI' ? 'bg-blue-500/20 text-blue-500' : selectedTicket.mode === 'HUMANO' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                                    {selectedTicket.mode}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap min-h-[1.25rem]">
                                            {isEditingSubject ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <input
                                                        autoFocus
                                                        value={editedSubject}
                                                        onChange={(e) => setEditedSubject(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateTicketInfo({ subject: editedSubject });
                                                            if (e.key === 'Escape') setIsEditingSubject(false);
                                                        }}
                                                        className="bg-white/50 dark:bg-white/5 border border-primary/30 rounded-lg px-2 py-0.5 text-xs font-bold outline-none focus:ring-1 ring-primary/50 w-full max-w-sm"
                                                        placeholder="Assunto do chamado..."
                                                    />
                                                    <button
                                                        onClick={() => handleUpdateTicketInfo({ subject: editedSubject })}
                                                        className="p-1 hover:bg-emerald-500/20 text-emerald-500 rounded-md transition-all"
                                                    >
                                                        <CheckCheck size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingSubject(false)}
                                                        className="p-1 hover:bg-rose-500/20 text-rose-500 rounded-md transition-all"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group/subject"
                                                    onClick={() => {
                                                        setEditedSubject(selectedTicket.subject || '');
                                                        setIsEditingSubject(true);
                                                    }}
                                                >
                                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight truncate max-w-[250px]">
                                                        {selectedTicket.subject || 'Sem assunto (clique para editar)'}
                                                    </p>
                                                    <Edit3 size={10} className="text-slate-400 opacity-0 group-hover/subject:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                            <div className="h-3 w-[1px] bg-slate-200 dark:bg-white/10 mx-1" />
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                                <p className="text-primary italic truncate max-w-[100px]">{selectedTicket.department.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                                    {/* Busca na conversa */}
                                    <div className="flex items-center gap-1">
                                        <div className={`flex items-center transition-all ${isSearching ? 'w-32 md:w-44 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                                            <input
                                                type="text"
                                                placeholder="Buscar..."
                                                value={messageSearch}
                                                onChange={(e) => setMessageSearch(e.target.value)}
                                                className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs w-full focus:ring-2 focus:ring-primary/20 outline-none"
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsSearching(!isSearching);
                                                if (isSearching) setMessageSearch('');
                                            }}
                                            className={`p-2 rounded-xl transition-all ${isSearching ? 'bg-primary text-white shadow-lg' : 'bg-white/50 dark:bg-white/5 text-slate-400 hover:text-primary'}`}
                                            title="Buscar mensagens"
                                        >
                                            {isSearching ? <X size={16} /> : <Search size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowContactHistory(!showContactHistory)}
                                        className={`p-2 rounded-xl transition-all ${showContactHistory ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                        title="Informações do Contato"
                                    >
                                        <Info size={16} />
                                    </button>
                                    {selectedTicket.status === 'RESOLVED' && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await ticketsService.update(selectedTicket.id, { status: 'OPEN' });
                                                    fetchTickets();
                                                    toast.success("Ticket reaberto com sucesso!");
                                                } catch (error) {
                                                    toast.error("Erro ao reabrir ticket");
                                                }
                                            }}
                                            className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition-all font-black text-[9px] uppercase tracking-widest active:scale-95"
                                        >
                                            <ArrowRightLeft size={12} />
                                            Reabrir
                                        </button>
                                    )}

                                    {/* Modo IA / Humano */}
                                    <div className="flex items-center bg-slate-100/50 dark:bg-white/5 p-0.5 rounded-xl border border-white/50 dark:border-white/5 backdrop-blur-md shrink-0">
                                        {['AI', 'HUMANO'].map((m) => (
                                            <button
                                                key={m}
                                                onClick={async () => {
                                                    try {
                                                        await ticketsService.update(selectedTicket.id, { mode: m });
                                                        setSelectedTicket(prev => prev ? { ...prev, mode: m as any } : null);
                                                        toast.success(`Modo alterado para ${m}`);
                                                    } catch (error) {
                                                        toast.error('Erro ao alternar modo');
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${selectedTicket.mode === m
                                                    ? 'bg-white dark:bg-primary text-black dark:text-white shadow-md'
                                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                                                    }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Indicador de sentimento — apenas desktop */}
                                    {(selectedTicket as any).evaluation && (
                                        <div className="shrink-0 hidden lg:block">
                                            <SentimentIndicator
                                                sentiment={(selectedTicket as any).evaluation.aiSentiment}
                                                score={(selectedTicket as any).evaluation.aiSentimentScore}
                                                className="scale-90 origin-right"
                                            />
                                        </div>
                                    )}

                                    {/* Menu de Ações Secundárias */}
                                    <div ref={optionsMenuRef} className="relative shrink-0">
                                        <button
                                            onClick={() => setShowOptionsMenu(v => !v)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border text-slate-700 dark:text-slate-300 ${showOptionsMenu ? 'bg-primary/10 border-primary/30 text-primary dark:text-primary' : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border-slate-200 dark:border-white/5'}`}
                                        >
                                            <SlidersHorizontal className="h-4 w-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">Opções</span>
                                        </button>

                                        {/* Dropdown Flutuante */}
                                        <AnimatePresence>
                                            {showOptionsMenu && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl rounded-2xl p-2 z-[60] flex flex-col gap-1">

                                                    {/* Pausar */}
                                                    <button
                                                        disabled={isPausing}
                                                        onClick={async () => {
                                                            try {
                                                                setIsPausing(true);
                                                                await api.post(`/tickets/${selectedTicket.id}/status`, { status: 'PAUSED' });
                                                                toast.success("Atendimento pausado");
                                                                setSelectedTicket(null);
                                                                fetchTickets();
                                                            } catch (error) {
                                                                toast.error("Erro ao pausar atendimento");
                                                            } finally {
                                                                setIsPausing(false);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl transition-all disabled:opacity-50 text-left"
                                                    >
                                                        <Clock className="h-4 w-4" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{isPausing ? 'Pausando...' : 'Pausar Atendimento'}</span>
                                                    </button>

                                                    {/* Transferir */}
                                                    <button
                                                        onClick={() => setShowTransferModal(true)}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl transition-all text-left"
                                                    >
                                                        <ArrowRightLeft className="h-4 w-4" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Transferir Ticket</span>
                                                    </button>

                                                    <div className="h-[1px] w-full bg-slate-100 dark:bg-white/5 my-1" />

                                                    {/* Prioridade */}
                                                    <div className="px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Prioridade</div>
                                                        <div className="grid grid-cols-2 gap-1">
                                                            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                                                                <button
                                                                    key={p}
                                                                    onClick={async () => {
                                                                        try {
                                                                            await ticketsService.update(selectedTicket.id, { priority: p });
                                                                            setSelectedTicket(prev => prev ? { ...prev, priority: p } : null);
                                                                            fetchTickets();
                                                                            toast.success(`Prioridade alterada!`);
                                                                        } catch (error) {
                                                                            toast.error("Erro ao alterar prioridade");
                                                                        }
                                                                    }}
                                                                    className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all text-center ${selectedTicket.priority === p
                                                                        ? p === 'CRITICAL' ? 'bg-rose-500 text-white shadow-md' :
                                                                            p === 'HIGH' ? 'bg-amber-500 text-white shadow-md' :
                                                                                p === 'MEDIUM' ? 'bg-blue-500 text-white shadow-md' :
                                                                                    'bg-slate-500 text-white shadow-md'
                                                                        : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                                                                        }`}
                                                                >
                                                                    {p === 'CRITICAL' ? 'Crítico' : p === 'HIGH' ? 'Alta' : p === 'MEDIUM' ? 'Média' : 'Baixa'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="h-[1px] w-full bg-slate-100 dark:bg-white/5 my-1" />

                                                    {/* Tags / Categorias */}
                                                    <div className="px-3 py-2">
                                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Categorizar (Tags)</div>
                                                        <div className="max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                                            {availableTags.map(tag => {
                                                                const currentTagIds = selectedTicket.tags?.map((t: any) => t.tag?.id || t.id) || [];
                                                                const isApplied = currentTagIds.includes(tag.id);
                                                                return (
                                                                    <button
                                                                        key={tag.id}
                                                                        onClick={async () => {
                                                                            const newTagIds = isApplied
                                                                                ? currentTagIds.filter((id: string) => id !== tag.id)
                                                                                : [...currentTagIds, tag.id];
                                                                            try {
                                                                                const updated = await ticketsService.update(selectedTicket.id, { tagIds: newTagIds });
                                                                                setSelectedTicket((prev: any) => prev ? { ...prev, tags: updated.tags ?? prev.tags } : prev);
                                                                                setTickets((prev: any[]) => prev.map((t: any) => t.id === selectedTicket.id ? { ...t, tags: updated.tags ?? t.tags } : t));
                                                                            } catch {
                                                                                toast.error('Erro ao atualizar tags');
                                                                            }
                                                                        }}
                                                                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left border ${isApplied ? 'bg-primary/10 border-primary/30' : 'hover:bg-slate-100 dark:hover:bg-white/5 border-transparent'}`}
                                                                    >
                                                                        <div className="h-2 w-2 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                                                        <span className="text-[10px] font-bold text-slate-700 dark:text-gray-300 truncate flex-1">{tag.name}</span>
                                                                        {isApplied && <span className="text-[9px] text-primary font-black">✓</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                            {availableTags.length === 0 && (
                                                                <div className="p-2 text-[9px] text-gray-400 italic text-center">Nenhuma tag</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Ações Rápidas em Destaque */}
                                    <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-white/5 p-1 rounded-2xl border border-white/50 dark:border-white/5 backdrop-blur-md shrink-0">
                                        {/* Copilot: botão oculto até feature estar pronta */}
                                        {false && (
                                            <button
                                                onClick={() => setShowCopilot(!showCopilot)}
                                                className={`p-2 rounded-xl transition-all ${showCopilot ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400'}`}
                                                title="Alternar IA Copilot"
                                            >
                                                <Bot className="h-4 w-4" />
                                            </button>
                                        )}

                                        {selectedTicket.contact?.information && (
                                            <div className="relative group/info">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedTicket.contact.information!);
                                                        toast.success("Info copiada!");
                                                    }}
                                                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-500 text-gray-500 rounded-xl transition-all"
                                                    title="Informação Técnica"
                                                >
                                                    <Info className="h-4 w-4" />
                                                </button>
                                                <div className="absolute top-full right-0 mt-3 w-64 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl opacity-0 translate-y-2 pointer-events-none group-hover/info:opacity-100 group-hover/info:translate-y-0 transition-all z-50 shadow-2xl">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Informação Técnica</p>
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-4">
                                                        {selectedTicket.contact.information}
                                                    </p>
                                                    <div className="mt-2 text-[8px] font-bold text-gray-400 italic">Clique no ícone para copiar</div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="w-[1px] h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                                        {/* Finalizar (Principal) */}
                                        <button
                                            disabled={isResolving}
                                            onClick={() => {
                                                const ticketId = selectedTicket.id;
                                                toast('Finalizar atendimento?', {
                                                    action: {
                                                        label: 'Finalizar',
                                                        onClick: async () => {
                                                            try {
                                                                setIsResolving(true);
                                                                await api.post(`/tickets/${ticketId}/resolve`, {});
                                                                toast.success("Finalizado!");
                                                                setSelectedTicket(null);
                                                                fetchTickets();
                                                            } catch (error) {
                                                                toast.error("Erro ao finalizar");
                                                            } finally {
                                                                setIsResolving(false);
                                                            }
                                                        }
                                                    },
                                                    cancel: { label: 'Voltar', onClick: () => { } },
                                                    duration: 4000,
                                                });
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 active:scale-95 group"
                                        >
                                            <CheckCheck className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-widest hidden xl:block">
                                                {isResolving ? '...' : 'Finalizar'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Tags do Cabeçalho */}
                            <div className="px-4 py-2 border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-black/10 backdrop-blur-md flex flex-wrap gap-1.5 items-center min-h-[36px] border-x border-slate-200 dark:border-white/10">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-2">Tags:</span>
                                {selectedTicket.tags && selectedTicket.tags.length > 0 ? (
                                    selectedTicket.tags.map((t: any) => (
                                        <span
                                            key={t.tag.id}
                                            className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-white/20"
                                            style={{ backgroundColor: `${t.tag.color}20`, color: t.tag.color }}
                                        >
                                            {t.tag.name}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[9px] text-slate-400 italic">Nenhuma tag atribuída</span>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden border-x border-b border-slate-200 dark:border-white/10 md:rounded-b-2xl shadow-xl">
                                {/* Mensagens (agora dentro de uma div flex) */}
                                <div className="flex-1 flex flex-col overflow-hidden relative">
                                    <div
                                        ref={messagesContainerRef}
                                        onScroll={(e) => {
                                            const el = e.currentTarget;
                                            setShowScrollBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 250);
                                        }}
                                        className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4"
                                    >
                                        {loadingMessages ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                                            </div>
                                        ) : (
                                            <>
                                                {messages.filter(m => m.content?.toLowerCase().includes(messageSearch.toLowerCase()) || m.transcription?.toLowerCase().includes(messageSearch.toLowerCase())).length === 0 && messageSearch && (
                                                    <div className="flex flex-col items-center justify-center h-full opacity-40">
                                                        <Search size={48} className="mb-4" />
                                                        <p className="text-sm font-black uppercase tracking-widest">Nenhuma mensagem encontrada</p>
                                                    </div>
                                                )}
                                                {messages.filter(m => m.content?.toLowerCase().includes(messageSearch.toLowerCase()) || m.transcription?.toLowerCase().includes(messageSearch.toLowerCase())).map((msg: any, idx) => (
                                                    <motion.div
                                                        key={msg.id}
                                                        initial={{ opacity: 0, x: msg.fromMe ? 20 : -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx > messages.length - 6 ? (idx - Math.max(0, messages.length - 6)) * 0.05 : 0 }}
                                                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`max-w-[70%] ${msg.messageType === 'INTERNAL'
                                                            ? 'bg-amber-100 dark:bg-amber-900/40 border-2 border-dashed border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-100 rounded-3xl'
                                                            : msg.fromMe
                                                                ? 'bg-primary text-white rounded-[1.5rem] rounded-br-[0.2rem] shadow-[0_10px_30px_-10px_rgba(56,189,248,0.5)]'
                                                                : 'liquid-glass rounded-[1.5rem] rounded-bl-[0.2rem] border border-slate-200 dark:border-white/5'
                                                            } px-6 py-4 relative group`}>

                                                            {msg.messageType === 'INTERNAL' && (
                                                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-200 dark:border-amber-700/30">
                                                                    <Bot size={12} className="text-amber-600 dark:text-amber-400" />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Nota Interna</span>
                                                                </div>
                                                            )}

                                                            {msg.quotedMessageId && (
                                                                <div className="mb-2 p-3 bg-slate-100 dark:bg-black/40 rounded-xl border-l-4 border-primary">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                                                        {msg.fromMe ? 'Você respondeu' : 'Contato respondeu'}
                                                                    </p>
                                                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                                                                        {messages.find(m => m.id === msg.quotedMessageId)?.content || '[Mensagem original]'}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {msg.messageType === 'INTERNAL' || msg.messageType === 'TEXT' ? (
                                                                <p className={`text-sm font-medium leading-relaxed ${msg.fromMe && msg.messageType !== 'INTERNAL' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                                                    {msg.content}
                                                                </p>
                                                            ) : msg.messageType === 'IMAGE' ? (
                                                                <div className="space-y-2">
                                                                    <img src={msg.mediaUrl} alt="Imagem" className="rounded-xl max-w-full shadow-sm cursor-pointer hover:opacity-95 transition-opacity" onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                                                    <a href={msg.mediaUrl} download target="_blank" className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${msg.fromMe ? 'text-white/70 hover:text-white' : 'text-primary hover:text-primary/80'} transition-colors`}>
                                                                        📥 Baixar Mídia
                                                                    </a>
                                                                </div>
                                                            ) : msg.messageType === 'STICKER' ? (
                                                                <img src={msg.mediaUrl} alt="Sticker" className="max-w-[150px] max-h-[150px] object-contain" />
                                                            ) : msg.messageType === 'VIDEO' ? (
                                                                <div className="space-y-2">
                                                                    <video src={msg.mediaUrl} controls className="rounded-xl max-w-full shadow-sm max-h-64" preload="metadata" />
                                                                    <a href={msg.mediaUrl} download target="_blank" className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter ${msg.fromMe ? 'text-white/70 hover:text-white' : 'text-primary hover:text-primary/80'} transition-colors`}>
                                                                        📥 Baixar Vídeo
                                                                    </a>
                                                                </div>
                                                            ) : msg.messageType === 'AUDIO' ? (
                                                                <div className="space-y-3 min-w-[280px]">
                                                                    <audio src={msg.mediaUrl} controls className="w-full h-10" />
                                                                    {msg.transcription && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 5 }}
                                                                            animate={{ opacity: 1, y: 0 }}
                                                                            className={`text-[11px] font-medium leading-relaxed p-4 rounded-xl border ${msg.fromMe ? 'bg-white/10 border-white/10' : 'bg-black/5 dark:bg-white/5 border-slate-200 dark:border-white/5'}`}
                                                                        >
                                                                            <span className="text-[9px] font-black uppercase text-primary block mb-1">Transcrição IA</span>
                                                                            "{msg.transcription}"
                                                                        </motion.div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-3 rounded-xl ${msg.fromMe ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                                                                        <Paperclip size={18} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-black truncate uppercase tracking-widest">{msg.content || msg.messageType}</p>
                                                                        <a href={msg.mediaUrl} download target="_blank" className="text-[10px] font-bold opacity-60 hover:opacity-100">Clique para baixar</a>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className={`flex items-center gap-2 mt-3 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${msg.fromMe ? 'text-white/60' : 'text-slate-400'}`}>
                                                                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                {msg.fromMe && (
                                                                    <CheckCheck className={`h-3 w-3 ${msg.status === 'READ' ? 'text-sky-400' : (msg.status === 'DELIVERED' ? 'text-white/80' : 'text-white/40')}`} />
                                                                )}
                                                                <button
                                                                    onClick={() => setReplyingTo(msg)}
                                                                    className={`p-1 rounded-full transition-all opacity-0 group-hover:opacity-100 ${msg.fromMe ? 'text-white/60 hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                                                    title="Responder"
                                                                >
                                                                    <CornerUpLeft size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                                <div ref={messagesEndRef} />

                                                {/* Indicador de digitação */}
                                                <AnimatePresence>
                                                    {isTyping && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                                            animate={{ opacity: 1, scale: 1, x: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, x: -10 }}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <div className="flex gap-1">
                                                                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                                                                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                                                                <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                                                            </div>
                                                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                                                {isTyping.userName} está digitando...
                                                            </span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </>
                                        )}
                                    </div>

                                    {/* Botão flutuante scroll ao fim */}
                                    <AnimatePresence>
                                        {showScrollBottom && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                onClick={scrollToBottom}
                                                className="absolute bottom-4 right-4 z-20 p-2 rounded-full bg-primary shadow-lg shadow-primary/30 text-white hover:bg-primary/90 transition-all"
                                                title="Ir ao final"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>

                                    {isRecording ? (
                                        <div className="p-3 bg-white/60 dark:bg-black/40 border-t border-white/40 dark:border-white/5 backdrop-blur-2xl">
                                            <div className="flex justify-end max-w-6xl mx-auto relative z-10">
                                                <AudioRecorder
                                                    onSend={handleSendAudio}
                                                    onCancel={() => setIsRecording(false)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-white/60 dark:bg-black/40 border-t border-white/40 dark:border-white/5 backdrop-blur-2xl">
                                            <div className="flex items-end gap-3 max-w-6xl mx-auto relative z-10">
                                                <div className="flex-1 min-w-0 bg-white/50 dark:bg-white/5 rounded-3xl p-1.5 border border-slate-200 dark:border-white/10 relative">
                                                    {/* Preview de Citação (Reply) */}
                                                    {replyingTo && (
                                                        <div className="mx-4 mt-2 mb-2 p-3 bg-slate-100 dark:bg-black/40 rounded-2xl border-l-4 border-primary flex items-start justify-between group/reply animate-in slide-in-from-bottom-2 duration-300">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                                                    Respondendo a {replyingTo.fromMe ? 'sua mensagem' : 'contato'}
                                                                </p>
                                                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                                                                    {replyingTo.content || '[Mídia]'}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => setReplyingTo(null)}
                                                                className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"
                                                            >
                                                                <X size={14} className="text-slate-400" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center">
                                                        <input
                                                            type="file"
                                                            hidden
                                                            ref={fileInputRef}
                                                            onChange={handleFileSelect}
                                                        />
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={uploadingFile}
                                                            className={`p-2.5 transition-all hover:scale-110 ${uploadingFile ? 'text-primary animate-pulse' : 'text-slate-400 hover:text-primary'} disabled:opacity-50`}
                                                            title="Anexar arquivo"
                                                        >
                                                            {uploadingFile ? <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Paperclip className="h-5 w-5" />}
                                                        </button>

                                                        {/* Toggle Nota Interna */}
                                                        <button
                                                            onClick={() => setIsInternal(!isInternal)}
                                                            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 border ${isInternal
                                                                ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700/50 text-amber-600 dark:text-amber-400'
                                                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border-transparent'
                                                                }`}
                                                            title="Alternar Nota Interna"
                                                        >
                                                            <Bot size={16} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest hidden lg:block">Privado</span>
                                                        </button>

                                                        {/* Popover de Macros */}
                                                        <AnimatePresence>
                                                            {showMacroMenu && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: 10 }}
                                                                    className="absolute bottom-full left-0 mb-2 w-96 max-h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-y-auto z-50 custom-scrollbar p-2"
                                                                >
                                                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 py-1">
                                                                        Respostas Rápidas (Use setas para navegar)
                                                                    </div>
                                                                    {macros.filter(m => m.shortcut.toLowerCase().includes(macroFilter.toLowerCase())).length === 0 ? (
                                                                        <div className="p-3 text-xs text-slate-500 text-center italic">
                                                                            Nenhuma resposta rápida encontrada para "{macroFilter}"
                                                                        </div>
                                                                    ) : (
                                                                        macros.filter(m => m.shortcut.toLowerCase().includes(macroFilter.toLowerCase())).map((macro, idx) => (
                                                                            <button
                                                                                key={macro.id}
                                                                                type="button"
                                                                                className={`w-full text-left p-3 rounded-xl transition-all ${idx === macroSelectedIndex ? 'bg-primary/10 border-primary/20 scale-[0.98]' : 'hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'} border`}
                                                                                onClick={() => {
                                                                                    const lastSlashIndex = newMessage.lastIndexOf('/');
                                                                                    const beforeSlash = newMessage.slice(0, lastSlashIndex);
                                                                                    const newText = beforeSlash + macro.content;
                                                                                    setNewMessage(newText);
                                                                                    if (selectedTicket) localStorage.setItem(`draft_${selectedTicket.id}`, newText);
                                                                                    setShowMacroMenu(false);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <Bot className="h-4 w-4 text-primary" />
                                                                                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">{macro.shortcut}</span>
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{macro.content}</p>
                                                                            </button>
                                                                        ))
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>

                                                        {/* Popover de Menções */}
                                                        <AnimatePresence>
                                                            {showMentionMenu && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: 10 }}
                                                                    className="absolute bottom-full left-0 mb-2 w-72 max-h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-y-auto z-50 custom-scrollbar p-2"
                                                                >
                                                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 py-1">
                                                                        Mencionar Agente
                                                                    </div>
                                                                    {mentionableUsers.filter(u => u.name.toLowerCase().includes(mentionFilter.toLowerCase()) || u.email.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 ? (
                                                                        <div className="p-3 text-xs text-slate-500 text-center italic">
                                                                            Nenhum agente encontrado
                                                                        </div>
                                                                    ) : (
                                                                        mentionableUsers.filter(u => u.name.toLowerCase().includes(mentionFilter.toLowerCase()) || u.email.toLowerCase().includes(mentionFilter.toLowerCase())).map((mUser, idx) => (
                                                                            <button
                                                                                key={mUser.id}
                                                                                type="button"
                                                                                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${idx === mentionSelectedIndex ? 'bg-primary/10 border-primary/20 scale-[0.98]' : 'hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'} border`}
                                                                                onClick={() => {
                                                                                    const lastAtIndex = newMessage.lastIndexOf('@');
                                                                                    const beforeAt = newMessage.slice(0, lastAtIndex);
                                                                                    const newText = beforeAt + '@' + mUser.name + ' ';
                                                                                    setNewMessage(newText);
                                                                                    if (selectedTicket) localStorage.setItem(`draft_${selectedTicket.id}`, newText);
                                                                                    setShowMentionMenu(false);
                                                                                }}
                                                                            >
                                                                                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
                                                                                    {mUser.avatar ? <img src={mUser.avatar} className="h-full w-full object-cover rounded-lg" /> : mUser.name.charAt(0)}
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider block">{mUser.name}</span>
                                                                                    <span className="text-[9px] text-slate-500 uppercase tracking-tight">{mUser.email}</span>
                                                                                </div>
                                                                            </button>
                                                                        ))
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>

                                                        <div className="flex-1 flex flex-col relative">
                                                            <textarea
                                                                value={newMessage}
                                                                onChange={(e) => handleMessageChange(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (showMacroMenu) {
                                                                        const filteredMacros = macros.filter(m => m.shortcut.toLowerCase().includes(macroFilter.toLowerCase()));
                                                                        if (e.key === 'ArrowDown') {
                                                                            e.preventDefault();
                                                                            setMacroSelectedIndex(prev => Math.min(prev + 1, Math.max(0, filteredMacros.length - 1)));
                                                                            return;
                                                                        }
                                                                        if (e.key === 'ArrowUp') {
                                                                            e.preventDefault();
                                                                            setMacroSelectedIndex(prev => Math.max(prev - 1, 0));
                                                                            return;
                                                                        }
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            if (filteredMacros[macroSelectedIndex]) {
                                                                                const macro = filteredMacros[macroSelectedIndex];
                                                                                const lastSlashIndex = newMessage.lastIndexOf('/');
                                                                                const beforeSlash = newMessage.slice(0, lastSlashIndex);
                                                                                const newText = beforeSlash + macro.content;
                                                                                setNewMessage(newText);
                                                                                if (selectedTicket) localStorage.setItem(`draft_${selectedTicket.id}`, newText);
                                                                                setShowMacroMenu(false);
                                                                            }
                                                                            return;
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setShowMacroMenu(false);
                                                                            return;
                                                                        }
                                                                    }

                                                                    if (showMentionMenu) {
                                                                        const filteredUsers = mentionableUsers.filter(u => u.name.toLowerCase().includes(mentionFilter.toLowerCase()) || u.email.toLowerCase().includes(mentionFilter.toLowerCase()));
                                                                        if (e.key === 'ArrowDown') {
                                                                            e.preventDefault();
                                                                            setMentionSelectedIndex(prev => Math.min(prev + 1, Math.max(0, filteredUsers.length - 1)));
                                                                            return;
                                                                        }
                                                                        if (e.key === 'ArrowUp') {
                                                                            e.preventDefault();
                                                                            setMentionSelectedIndex(prev => Math.max(prev - 1, 0));
                                                                            return;
                                                                        }
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            if (filteredUsers[mentionSelectedIndex]) {
                                                                                const mUser = filteredUsers[mentionSelectedIndex];
                                                                                const lastAtIndex = newMessage.lastIndexOf('@');
                                                                                const beforeAt = newMessage.slice(0, lastAtIndex);
                                                                                const newText = beforeAt + '@' + mUser.name + ' ';
                                                                                setNewMessage(newText);
                                                                                if (selectedTicket) localStorage.setItem(`draft_${selectedTicket.id}`, newText);
                                                                                setShowMentionMenu(false);
                                                                            }
                                                                            return;
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setShowMentionMenu(false);
                                                                            return;
                                                                        }
                                                                    }

                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        handleSendMessage();
                                                                    }
                                                                    if (e.key === 'Tab') {
                                                                        // Tab key behavior can be standard now
                                                                    }
                                                                }}
                                                                placeholder={isInternal ? "Sua nota privada (interna)..." : "Digite sua mensagem..."}
                                                                className={`w-full bg-transparent outline-none resize-none text-sm font-medium tracking-normal ${isInternal ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'} placeholder:text-slate-400/60 min-h-[44px] py-3`}
                                                                rows={1}
                                                                maxLength={2000}
                                                            />
                                                            <div className={`absolute bottom-1 right-0 text-[9px] font-black uppercase tracking-tighter ${newMessage.length > 2000 * 0.9 ? 'text-rose-500' : 'text-slate-400 opacity-40 hover:opacity-100 transition-opacity'}`}>
                                                                {newMessage.length}/2000
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setShowScheduleModal(true)}
                                                                className="p-2.5 text-emerald-500 hover:text-emerald-600 transition-all hover:scale-110"
                                                                title="Agendar Compromisso"
                                                            >
                                                                <Calendar className="h-5 w-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setIsRecording(true)}
                                                                className="p-2.5 text-slate-400 hover:text-red-500 transition-all hover:scale-110"
                                                                title="Gravar áudio"
                                                            >
                                                                <Mic className="h-5 w-5" />
                                                            </button>
                                                            <div className="relative flex items-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setShowEmojiPicker(!showEmojiPicker);
                                                                    }}
                                                                    className={`p-2.5 transition-all hover:scale-110 ${showEmojiPicker ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                                                                >
                                                                    <Smile className="h-5 w-5" />
                                                                </button>

                                                                <AnimatePresence>
                                                                    {showEmojiPicker && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                                            className="absolute bottom-full right-0 mb-4 z-50 shadow-2xl rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10"
                                                                        >
                                                                            <EmojiPicker
                                                                                onEmojiClick={(emojiData) => {
                                                                                    setNewMessage(prev => prev + emojiData.emoji);
                                                                                }}
                                                                                theme={'auto' as any}
                                                                            />
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleSendMessage}
                                                    disabled={!newMessage.trim() || sending}
                                                    className="h-12 w-12 md:h-14 md:w-14 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 active:scale-90 transition-all shadow-xl shadow-primary/40 disabled:opacity-50 flex-shrink-0"
                                                >
                                                    {sending ? (
                                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Send className="h-5 w-5 ml-0.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                )}
                        {/* Painel Lateral de Informações do Contato */}
                        <AnimatePresence>
                            {showContactHistory && selectedTicket && (
                                <motion.div
                                    initial={{ x: '100%' }}
                                    animate={{ x: 0 }}
                                    exit={{ x: '100%' }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    className="absolute inset-y-0 right-0 w-80 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl border-l border-slate-200 dark:border-white/10 z-30 shadow-2xl flex flex-col"
                                >
                                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Contexto do Cliente</h4>
                                        <button onClick={() => setShowContactHistory(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                        {/* Perfil */}
                                        <div className="text-center">
                                            <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl font-black text-primary mx-auto mb-4 shadow-inner">
                                                {selectedTicket.contact.name.charAt(0)}
                                            </div>
                                            <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{selectedTicket.contact.name}</h3>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{selectedTicket.contact.phoneNumber}</p>
                                        </div>

                                        {/* Notas */}
                                        <div className="space-y-4">
                                            <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-2xl p-4 border border-amber-100/50 dark:border-amber-500/10 group/notes relative">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600/60 dark:text-amber-400/40">Notas de Atendimento</p>
                                                    {!isEditingNotes && (
                                                        <button
                                                            onClick={() => {
                                                                setEditedNotes(selectedTicket.notes || '');
                                                                setIsEditingNotes(true);
                                                            }}
                                                            className="p-1 hover:bg-amber-100 dark:hover:bg-white/5 rounded-md text-amber-600 dark:text-amber-400 opacity-0 group-hover/notes:opacity-100 transition-all"
                                                        >
                                                            <Edit3 size={12} />
                                                        </button>
                                                    )}
                                                </div>

                                                {isEditingNotes ? (
                                                    <div className="space-y-2">
                                                        <textarea
                                                            autoFocus
                                                            value={editedNotes}
                                                            onChange={(e) => setEditedNotes(e.target.value)}
                                                            className="w-full bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs font-bold outline-none focus:ring-1 ring-amber-500/50 min-h-[100px] text-slate-700 dark:text-slate-200"
                                                            placeholder="Adicione observações importantes sobre este cliente..."
                                                        />
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <button
                                                                onClick={() => setIsEditingNotes(false)}
                                                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateTicketInfo({ notes: editedNotes })}
                                                                disabled={updatingInfo}
                                                                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
                                                            >
                                                                {updatingInfo ? 'Salvando...' : 'Salvar Nota'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-bold text-amber-800/80 dark:text-amber-200/60 leading-relaxed italic whitespace-pre-wrap">
                                                        {selectedTicket.notes || 'Nenhuma observação interna registrada.'}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Canal Principal</p>
                                                <div className="flex items-center gap-2 text-primary font-black text-sm">
                                                    <Phone size={14} />
                                                    WhatsApp
                                                </div>
                                            </div>
                                        </div>

                                        {/* Histórico */}
                                        <div className="space-y-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Histórico Resumido</p>
                                            {loadingHistory ? (
                                                <div className="flex justify-center py-4"><div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
                                            ) : contactHistory.length === 0 ? (
                                                <p className="text-[10px] font-bold text-slate-400 italic">Nenhum chamado anterior encontrado.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {contactHistory.map((h) => (
                                                        <div key={h.id} className="bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-white/40 dark:border-white/5 group hover:border-primary/30 transition-all">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-[10px] font-black text-primary truncate">#{h.id.substring(h.id.length - 4).toUpperCase()}</span>
                                                                <span className="text-[8px] font-bold text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-700 dark:text-gray-300 line-clamp-1">{h.subject || 'Sem assunto'}</p>
                                                            <div className="flex items-center gap-2 mt-2 opacity-60">
                                                                <div className="h-1 w-1 rounded-full bg-slate-400" />
                                                                <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">{h.department.name}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                {/* Modais */}
                <CreateTicketModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        fetchTickets();
                        setIsCreateModalOpen(false);
                    }}
                />

                {
                    selectedTicket && (
                        <TransferTicketModal
                            isOpen={showTransferModal}
                            onClose={() => setShowTransferModal(false)}
                            ticketId={selectedTicket.id}
                            onSuccess={() => {
                                setShowTransferModal(false);
                                fetchTickets();
                                if (selectedTicket) {
                                    fetchMessages(selectedTicket.id);
                                }
                            }}
                        />
                    )
                }

                {
                    selectedTicket && (
                        <CreateScheduleModal
                            isOpen={showScheduleModal}
                            onClose={() => setShowScheduleModal(false)}
                            contactId={selectedTicket.contactId || selectedTicket.contact?.id || ''}
                            contactName={selectedTicket.contact.name}
                            departmentId={selectedTicket.department.id}
                            onSuccess={() => {
                                setShowScheduleModal(false);
                                // Pode disparar reload adicional se necessário!
                            }}
                        />
                    )
                }
                <BulkActionBar
                    selectedIds={selectedTicketIds}
                    onClear={() => setSelectedTicketIds([])}
                    onSuccess={() => {
                        setSelectedTicketIds([]);
                        fetchTickets();
                    }}
                />
            </div >
            );
}
