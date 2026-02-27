import React from 'react';
import { CheckCheck, Paperclip, Video, Reply, X, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Message {
    id: string;
    content: string;
    fromMe: boolean;
    sentAt: string;
    messageType: string;
    mediaUrl?: string;
    status?: string;
    origin?: 'AGENT' | 'CLIENT' | 'AI';
    transcription?: string;
    quotedMessageId?: string;
    quotedMessage?: {
        content: string;
        fromMe: boolean;
    };
}

interface MessageBubbleProps {
    msg: Message;
    index: number;
    onReply?: (msg: Message) => void;
}

const STATUS_ICONS: Record<string, string> = {
    PENDING: '🕐',
    SENT: '✓',
    DELIVERED: '✓✓',
    READ: '✓✓',
    FAILED: '!',
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, index, onReply }) => {
    const isInternal = msg.messageType === 'INTERNAL';
    const isAI = msg.origin === 'AI';

    const bubbleClass = isInternal
        ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/30 text-amber-900 dark:text-amber-100 border border-amber-500/30'
        : isAI
            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/30 text-indigo-900 dark:text-indigo-100 border border-indigo-500/20'
            : msg.fromMe
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-blue-500/20 hover:scale-[1.01]'
                : 'glass-card text-gray-800 dark:text-gray-100 rounded-tl-none border-white/20 dark:border-white/5 hover:scale-[1.01]';

    const handleCopyText = () => {
        if (msg.content) {
            navigator.clipboard.writeText(msg.content);
            toast.success('Texto copiado');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 120 }}
            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[75%] rounded-[2rem] px-5 py-3.5 shadow-xl relative group transition-all duration-300 ${bubbleClass}`}
            >
                {/* Badge de origem (IA) */}
                {isAI && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300 mb-1.5 flex items-center gap-1">
                        ✦ Resposta da IA
                    </p>
                )}
                {isInternal && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300 mb-1.5">
                        📋 Nota interna
                    </p>
                )}

                {/* Mensagem Citada (Quote) */}
                {msg.quotedMessage && (
                    <div className="mb-3 p-2.5 rounded-xl bg-black/5 dark:bg-black/30 border-l-4 border-primary/50 text-[11px] opacity-80 backdrop-blur-sm">
                        <p className="font-black uppercase tracking-widest text-[8px] mb-1 text-primary">
                            {msg.quotedMessage.fromMe ? 'Sua mensagem' : 'Contato'}
                        </p>
                        <p className="line-clamp-2 font-medium italic">
                            {msg.quotedMessage.content}
                        </p>
                    </div>
                )}

                {/* Mídia: Imagem */}
                {msg.messageType === 'IMAGE' && msg.mediaUrl && (
                    <div className="mb-2 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 border border-white/20">
                        <img
                            src={msg.mediaUrl}
                            alt="Imagem"
                            className="max-w-full h-auto cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => window.open(msg.mediaUrl, '_blank')}
                            loading="lazy"
                        />
                    </div>
                )}

                {/* Mídia: Áudio */}
                {msg.messageType === 'AUDIO' && msg.mediaUrl && (
                    <div className="mb-2 min-w-[220px]">
                        <audio controls className="w-full h-10 rounded-xl">
                            <source src={msg.mediaUrl} />
                        </audio>
                        {msg.transcription && (
                            <p className="mt-1.5 text-[11px] italic opacity-60 leading-relaxed px-1">
                                🎙 {msg.transcription}
                            </p>
                        )}
                    </div>
                )}

                {/* Mídia: Vídeo */}
                {msg.messageType === 'VIDEO' && msg.mediaUrl && (
                    <div className="mb-2 overflow-hidden rounded-xl bg-black border border-white/10">
                        <video
                            controls
                            className="max-w-full h-auto max-h-64 rounded-xl"
                            preload="metadata"
                        >
                            <source src={msg.mediaUrl} />
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 text-xs text-blue-300 underline">
                                <Video size={14} /> Ver vídeo
                            </a>
                        </video>
                    </div>
                )}

                {/* Mídia: Documento */}
                {msg.messageType === 'DOCUMENT' && msg.mediaUrl && (
                    <div className="mb-2 p-3 bg-white/10 dark:bg-black/20 rounded-xl flex items-center gap-3 border border-white/10">
                        <Paperclip size={20} className="text-blue-200 shrink-0" />
                        <div className="flex-1 overflow-hidden min-w-0">
                            <p className="text-xs font-bold truncate">
                                {(() => {
                                    try {
                                        const raw = msg.mediaUrl.split('/').pop() || 'Arquivo';
                                        return decodeURIComponent(raw).replace(/[<>"'&]/g, '');
                                    } catch {
                                        return 'Arquivo';
                                    }
                                })()}
                            </p>
                            <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] underline opacity-70 hover:opacity-100"
                            >
                                Download
                            </a>
                        </div>
                    </div>
                )}

                {/* Conteúdo de texto */}
                {msg.content && (
                    <p className="text-sm font-medium leading-relaxed select-text whitespace-pre-wrap break-words">
                        {msg.content}
                    </p>
                )}

                {/* Rodapé: hora + status */}
                <div
                    className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] font-bold ${msg.fromMe ? 'text-blue-100 opacity-60' : 'text-gray-400 opacity-50'
                        }`}
                >
                    <span suppressHydrationWarning className="uppercase tracking-tighter">
                        {new Date(msg.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.fromMe && (
                        <CheckCheck
                            className={`h-3 w-3 ${msg.status === 'READ'
                                ? 'text-blue-200'
                                : msg.status === 'FAILED'
                                    ? 'text-red-400'
                                    : ''
                                }`}
                        />
                    )}
                </div>

                {/* Botão copiar texto (hover) */}
                {msg.content && (
                    <div className="absolute -top-4 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {onReply && (
                            <button
                                onClick={() => onReply(msg)}
                                title="Responder"
                                className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-primary hover:scale-110 active:scale-95 transition-all border border-primary/20"
                            >
                                <Reply size={12} />
                            </button>
                        )}
                        <button
                            onClick={handleCopyText}
                            title="Copiar texto"
                            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:scale-110 active:scale-95 transition-all border border-white/20"
                        >
                            <Copy size={12} className="hidden" /> {/* Fallback if Copy is not imported, but it is used in handleCopyText */}
                            <span className="text-[9px] font-black uppercase tracking-tight px-1">Copiar</span>
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
