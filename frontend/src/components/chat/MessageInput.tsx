import React, { useRef, useEffect } from 'react';
import { Paperclip, Smile, Send, Mic } from 'lucide-react';

interface MessageInputProps {
    newMessage: string;
    setNewMessage: (val: string) => void;
    onSendMessage: (e: React.FormEvent) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploading: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    newMessage,
    setNewMessage,
    onSendMessage,
    onFileUpload,
    uploading,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize da textarea conforme o conteúdo cresce
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

    const isEmpty = !newMessage.trim();

    return (
        <form onSubmit={onSendMessage} className="p-6 glass border-t border-gray-100/50 dark:border-white/5 relative z-10">
            <div className="flex items-end gap-3 bg-white/60 dark:bg-black/30 p-2 pl-4 rounded-[2rem] border border-white/40 dark:border-white/5 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-inner backdrop-blur-3xl">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileUpload}
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                />

                {/* Botão de anexo */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Anexar arquivo"
                    className={`p-3 text-gray-400 hover:text-blue-600 transition-all hover:scale-110 shrink-0 mb-1 ${
                        uploading ? 'animate-pulse' : ''
                    }`}
                >
                    <Paperclip className="h-5 w-5" />
                </button>

                {/* Textarea com auto-resize */}
                <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem... (Enter para enviar, Shift+Enter para quebra de linha)"
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-700 dark:text-gray-200 px-2 placeholder:text-gray-400/50 resize-none py-3 min-h-[44px] max-h-32 overflow-y-auto custom-scrollbar"
                    rows={1}
                />

                {/* Emoji (placeholder visual) */}
                <button
                    type="button"
                    title="Emoji (em breve)"
                    className="p-3 text-gray-400 hover:text-blue-600 transition-all hover:scale-110 shrink-0 mb-1 opacity-50 cursor-not-allowed"
                    disabled
                >
                    <Smile className="h-5 w-5" />
                </button>

                {/* Botão enviar / microfone */}
                {isEmpty ? (
                    <button
                        type="button"
                        title="Gravar áudio (em breve)"
                        disabled
                        className="p-4 bg-gray-200 dark:bg-white/10 text-gray-400 rounded-[1.5rem] shrink-0 opacity-50 cursor-not-allowed mb-0.5"
                    >
                        <Mic className="h-5 w-5" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        title="Enviar mensagem"
                        className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[1.5rem] hover:scale-105 shadow-xl shadow-blue-500/40 transition-all active:scale-95 shrink-0 mb-0.5"
                    >
                        <Send className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Dica de atalho */}
            <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-1.5 ml-4 font-medium">
                Enter para enviar · Shift+Enter para nova linha
            </p>
        </form>
    );
};
