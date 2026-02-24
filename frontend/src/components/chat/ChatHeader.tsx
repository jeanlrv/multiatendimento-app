import React, { useState } from 'react';
import { ArrowLeft, MoreVertical, ArrowRightLeft, Info, X, Copy, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ChatHeaderProps {
    ticket: any;
    onTransfer: () => void;
    onBack?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em atendimento',
    PAUSED: 'Pausado',
    RESOLVED: 'Resolvido',
    CANCELLED: 'Cancelado',
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ ticket, onTransfer, onBack }) => {
    const router = useRouter();
    const [showInfo, setShowInfo] = useState(false);

    const contact = ticket?.contact;
    const hasInfo = !!(contact?.information || contact?.notes);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado para o clipboard');
    };

    return (
        <div className="glass border-b border-gray-100/50 dark:border-white/5 relative z-10">
            {/* Barra principal do header */}
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-5">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="md:hidden p-2 -ml-2 hover:bg-white/50 dark:hover:bg-white/5 rounded-full transition-all active:scale-90"
                            title="Voltar para a lista"
                        >
                            <ArrowLeft className="h-6 w-6 text-gray-500" />
                        </button>
                    )}

                    <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-500/20 shrink-0">
                        {contact?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight tracking-tight truncate">
                            {contact?.name || 'Contato'}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse shrink-0" />
                            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                {STATUS_LABELS[ticket?.status] ?? ticket?.status}
                            </span>

                            {contact?.phoneNumber && (
                                <>
                                    <span className="text-gray-300 dark:text-gray-600 text-[10px]">•</span>
                                    <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                        <Phone size={9} />
                                        {contact.phoneNumber}
                                    </span>
                                </>
                            )}

                            {ticket?.tags?.map(({ tag }: any) => (
                                <span
                                    key={tag.id}
                                    className="px-2 py-0.5 rounded-lg text-[9px] font-black text-white shadow-sm uppercase tracking-tighter"
                                    style={{ backgroundColor: tag.color }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                    {/* Botão de informações do contato */}
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        title={hasInfo ? 'Informações do contato' : 'Sem informações cadastradas'}
                        className={`p-3 rounded-2xl transition-all shadow-sm border flex items-center gap-2 font-bold text-xs ${showInfo
                                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30'
                                : 'bg-white/50 dark:bg-white/5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-gray-400 border-white/20 dark:border-white/10'
                            }`}
                    >
                        <Info size={18} />
                        <span className="hidden sm:inline text-xs font-bold">Info</span>
                    </button>

                    <button
                        onClick={onTransfer}
                        className="p-3 bg-white/50 dark:bg-white/5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-2xl transition-all text-gray-400 shadow-sm border border-white/20 dark:border-white/10 flex items-center gap-2 font-bold text-xs"
                        title="Transferir ticket"
                    >
                        <ArrowRightLeft size={18} />
                        <span className="hidden sm:inline">Transferir</span>
                    </button>

                    <button
                        className="p-3 bg-white/50 dark:bg-white/5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-2xl transition-all text-gray-400 shadow-sm border border-white/20 dark:border-white/10"
                        title="Mais opções"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Painel de informações do contato */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-5 pt-4 border-t border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                    <Info size={11} />
                                    Informações do Contato
                                </p>
                                <button
                                    onClick={() => setShowInfo(false)}
                                    className="p-1.5 hover:bg-white/30 dark:hover:bg-white/10 rounded-xl transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                    title="Fechar"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {hasInfo ? (
                                <div className="space-y-3">
                                    {contact?.information && (
                                        <InfoBlock
                                            label="Informação Técnica / Fixa"
                                            text={contact.information}
                                            onCopy={() => copyToClipboard(contact.information)}
                                        />
                                    )}
                                    {contact?.notes && (
                                        <InfoBlock
                                            label="Notas"
                                            text={contact.notes}
                                            onCopy={() => copyToClipboard(contact.notes)}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-gray-400">
                                    <Info size={24} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold">Nenhuma informação cadastrada para este contato</p>
                                    <p className="text-[10px] mt-1 opacity-60">Edite o contato para adicionar informações</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

function InfoBlock({
    label,
    text,
    onCopy,
}: {
    label: string;
    text: string;
    onCopy: () => void;
}) {
    return (
        <div className="group">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">
                {label}
            </p>
            <div className="relative p-4 bg-white/60 dark:bg-black/30 rounded-2xl border border-white/30 dark:border-white/10">
                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed whitespace-pre-wrap select-text pr-8">
                    {text}
                </p>
                <button
                    onClick={onCopy}
                    title="Copiar"
                    className="absolute top-2.5 right-2.5 p-1.5 bg-white dark:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-105 active:scale-95"
                >
                    <Copy size={12} className="text-gray-500 dark:text-gray-400" />
                </button>
            </div>
        </div>
    );
}
