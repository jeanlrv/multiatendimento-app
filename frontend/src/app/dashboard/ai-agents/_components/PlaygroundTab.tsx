'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Zap, Paperclip, X } from 'lucide-react';
import { AIAgent } from '@/services/ai-agents';

type Props = {
    currentAgent: Partial<AIAgent> | null;
    chatHistory: { role: string; content: string }[];
    chatLoading: boolean;
    chatMessage: string;
    setChatMessage: (msg: string) => void;
    attachedFile: File | null;
    setAttachedFile: (file: File | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    chatEndRef: React.RefObject<HTMLDivElement>;
    onSendMessage: () => void;
    isDirty: boolean;
    isSavedProviderConfigured: boolean;
    savedModelId: string | undefined;
    getModelDisplayName: (modelId?: string) => string;
};

export function PlaygroundTab({
    currentAgent, chatHistory, chatLoading, chatMessage, setChatMessage,
    attachedFile, setAttachedFile, fileInputRef, chatEndRef, onSendMessage,
    isDirty, isSavedProviderConfigured, savedModelId, getModelDisplayName,
}: Props) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-[400px]">
            {/* Aviso: provider do modelo SALVO não configurado */}
            {currentAgent?.id && !isSavedProviderConfigured && (
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 mb-4">
                    <p className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
                        ⚠️ Provider Desconfigurado
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 font-semibold">
                        O modelo salvo <strong>{getModelDisplayName(savedModelId)}</strong> pertence a um provider sem API Key configurada.
                        Vá em <strong>Cérebro</strong>, selecione outro modelo e clique em <strong>Sincronizar IA</strong>.
                    </p>
                </div>
            )}

            {/* Aviso: alterações pendentes de salvar */}
            {currentAgent?.id && isDirty && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/30 rounded-2xl p-4 mb-4 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest text-center">
                    ⚠️ Salve as alterações antes de testar
                </div>
            )}

            {!currentAgent?.id && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/30 rounded-2xl p-4 mb-4 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest text-center">
                    Salve o agente antes de testar no Playground
                </div>
            )}

            {/* Chat messages area */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 dark:bg-black/20 rounded-3xl mb-4 border border-slate-100 dark:border-white/5 custom-scrollbar">
                {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-sm">
                        <MessageSquare size={32} className="mb-2" />
                        Nenhuma mensagem trocada.
                    </div>
                ) : (
                    chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-primary text-white ml-12 rounded-tr-none' : 'bg-white dark:bg-white/10 text-slate-800 dark:text-slate-200 mr-12 rounded-tl-none shadow-sm'}`}>
                                <div
                                    className="whitespace-pre-wrap break-words leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: (() => {
                                            const e = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                            return e(msg.content)
                                                .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/20 text-xs px-2 py-1 rounded mt-1 overflow-x-auto font-mono whitespace-pre-wrap"><code>$1</code></pre>')
                                                .replace(/`([^`\n]+)`/g, '<code class="bg-black/20 text-xs px-1 py-0.5 rounded font-mono">$1</code>')
                                                .replace(/\*([^*\n]+)\*/g, '<strong class="font-black">$1</strong>')
                                                .replace(/_([^_\n]+)_/g, '<em class="italic opacity-90">$1</em>')
                                                .replace(/~([^~\n]+)~/g, '<del class="line-through opacity-70">$1</del>');
                                        })()
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
                {chatLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-white/10 p-4 rounded-2xl rounded-tl-none animate-pulse flex gap-1">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Preview do arquivo anexado */}
            {attachedFile && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-primary/5 border border-primary/20 rounded-xl text-xs">
                    <Paperclip size={12} className="text-primary flex-shrink-0" />
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{attachedFile.name}</span>
                    <span className="text-slate-400 flex-shrink-0">({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                    <button type="button" onClick={() => setAttachedFile(null)} className="ml-auto text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Input oculto para seleção de arquivo */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.txt,.xml,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
                onChange={e => { if (e.target.files?.[0]) setAttachedFile(e.target.files[0]); e.target.value = ''; }}
            />

            {/* Input area */}
            <div className="flex gap-2">
                <button
                    type="button"
                    title="Anexar arquivo (PDF, DOCX, XLSX, XML, TXT, imagens — máx 10 MB)"
                    disabled={!currentAgent?.id || isDirty || !isSavedProviderConfigured}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border transition-all flex-shrink-0 disabled:opacity-50 ${attachedFile ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-300'}`}
                >
                    <Paperclip size={18} />
                </button>
                <input
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isDirty && isSavedProviderConfigured && (e.preventDefault(), onSendMessage())}
                    placeholder={
                        !currentAgent?.id ? 'Salve o agente antes de testar...' :
                        isDirty ? 'Salve as alterações antes de testar...' :
                        !isSavedProviderConfigured ? 'Provider não configurado...' :
                        attachedFile ? 'Adicione uma mensagem (opcional) e envie...' :
                        'Envie uma mensagem para testar...'
                    }
                    disabled={!currentAgent?.id || isDirty || !isSavedProviderConfigured}
                    className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 dark:text-white disabled:opacity-50"
                />
                <button
                    type="button"
                    disabled={chatLoading || !currentAgent?.id || isDirty || !isSavedProviderConfigured || (!chatMessage && !attachedFile)}
                    onClick={onSendMessage}
                    className="p-4 bg-primary text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                >
                    <Zap size={20} />
                </button>
            </div>
        </motion.div>
    );
}
