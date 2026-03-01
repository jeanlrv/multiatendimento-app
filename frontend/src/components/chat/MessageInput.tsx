import React, { useRef, useEffect, useState } from 'react';
import { Paperclip, Smile, Send, Mic, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioRecorder } from './AudioRecorder';

interface MessageInputProps {
    newMessage: string;
    setNewMessage: (val: string) => void;
    onSendMessage: (e: React.FormEvent, isInternal?: boolean) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onAudioUpload?: (blob: Blob) => void;
    uploading: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    newMessage,
    setNewMessage,
    onSendMessage,
    onFileUpload,
    onAudioUpload,
    uploading,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isInternal, setIsInternal] = useState(false);

    // Auto-resize da textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }, [newMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage(e as any);
        }
    };

    const handleAudioSend = (blob: Blob) => {
        if (onAudioUpload) {
            onAudioUpload(blob);
        }
        setIsRecording(false);
    };

    const isEmpty = !newMessage.trim();

    return (
        <div className="p-4 md:p-6 glass border-t border-gray-100/50 dark:border-white/5 relative z-10">
            <AnimatePresence mode="wait">
                {isRecording ? (
                    <div key="recorder" className="flex justify-end pr-2">
                        <AudioRecorder
                            onSend={handleAudioSend}
                            onCancel={() => setIsRecording(false)}
                        />
                    </div>
                ) : (
                    <motion.form
                        key="input"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onSubmit={(e) => onSendMessage(e, isInternal)}
                        className="flex flex-col gap-2"
                    >
                        {/* Toolbar Superior: Macros e Nota Interna */}
                        <div className="flex items-center gap-2 mb-1 px-2">
                            <button
                                type="button"
                                onClick={() => setIsInternal(!isInternal)}
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${isInternal
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20'
                                    : 'bg-white/50 dark:bg-white/5 text-gray-400 border-white/20 hover:text-amber-500'
                                    }`}
                            >
                                {isInternal ? '📋 Nota Interna Ativa' : '📋 Nota Interna'}
                            </button>
                            <button
                                type="button"
                                className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/50 dark:bg-white/5 text-gray-400 border border-white/20 hover:text-blue-500 transition-all"
                            >
                                / Atalhos
                            </button>
                        </div>

                        <div className={`flex items-end gap-3 p-2 pl-4 rounded-[2rem] border transition-all shadow-inner backdrop-blur-3xl ${isInternal
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-white/60 dark:bg-black/30 border-white/40 dark:border-white/5 focus-within:ring-4 focus-within:ring-blue-500/10'
                            }`}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={onFileUpload}
                                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                className="hidden"
                            />

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                title="Anexar arquivo"
                                className={`p-3 text-gray-400 hover:text-blue-600 transition-all hover:scale-110 shrink-0 mb-1 ${uploading ? 'animate-pulse' : ''}`}
                            >
                                <Paperclip className="h-5 w-5" />
                            </button>

                            <textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isInternal ? "Escrever nota interna..." : "Mensagem... (Enter para enviar)"}
                                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-700 dark:text-gray-200 px-2 placeholder:text-gray-400/50 resize-none py-3 min-h-[44px] max-h-32 overflow-y-auto custom-scrollbar"
                                rows={1}
                            />

                            <div className="relative flex items-center shrink-0 mb-1">
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    title="Emoji"
                                    className={`p-3 transition-all hover:scale-110 ${showEmojiPicker ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                                >
                                    <Smile className="h-5 w-5" />
                                </button>

                                <AnimatePresence>
                                    {showEmojiPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute bottom-full right-0 mb-4 z-[100] shadow-2xl rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10"
                                        >
                                            <EmojiPicker
                                                onEmojiClick={(emojiData) => setNewMessage(newMessage + emojiData.emoji)}
                                                theme={'auto' as any}
                                                searchPlaceholder="Pesquisar emoji..."
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {isEmpty ? (
                                <button
                                    type="button"
                                    onClick={() => setIsRecording(true)}
                                    title="Gravar áudio"
                                    className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-[1.5rem] shrink-0 hover:scale-110 active:scale-95 transition-all mb-0.5"
                                >
                                    <Mic className="h-5 w-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    title="Enviar mensagem"
                                    className={`p-4 rounded-[1.5rem] hover:scale-105 shadow-xl transition-all active:scale-95 shrink-0 mb-0.5 text-white ${isInternal
                                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/40'
                                        : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/40'
                                        }`}
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-2 ml-4 font-medium">
                Enter para enviar · {isInternal ? 'Notas internas não são enviadas ao cliente' : 'Shift+Enter para nova linha'}
            </p>
        </div>
    );
};
