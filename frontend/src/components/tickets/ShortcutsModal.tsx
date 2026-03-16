'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
    open: boolean;
    onClose: () => void;
}

const SHORTCUTS = [
    { group: 'Navegação', items: [
        { keys: ['Ctrl', 'K'], desc: 'Busca global de atendimentos' },
        { keys: ['Esc'], desc: 'Fechar painel / cancelar ação' },
        { keys: ['↑', '↓'], desc: 'Navegar entre atendimentos' },
    ]},
    { group: 'Mensagens', items: [
        { keys: ['Enter'], desc: 'Enviar mensagem' },
        { keys: ['Shift', 'Enter'], desc: 'Nova linha na mensagem' },
        { keys: ['Ctrl', 'C'], desc: 'Copiar mensagem selecionada' },
    ]},
    { group: 'Chat', items: [
        { keys: ['Ctrl', 'W'], desc: 'Ativar Copilot IA' },
        { keys: ['Ctrl', 'E'], desc: 'Abrir seletor de emoji' },
        { keys: ['Ctrl', 'R'], desc: 'Iniciar gravação de áudio' },
        { keys: ['Ctrl', 'F'], desc: 'Finalizar atendimento' },
    ]},
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-md overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Keyboard size={16} className="text-primary" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Atalhos de Teclado</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            {SHORTCUTS.map(({ group, items }) => (
                                <div key={group}>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{group}</p>
                                    <div className="space-y-1.5">
                                        {items.map(({ keys, desc }) => (
                                            <div key={desc} className="flex items-center justify-between">
                                                <span className="text-xs text-slate-600 dark:text-slate-300">{desc}</span>
                                                <div className="flex items-center gap-1">
                                                    {keys.map((k) => (
                                                        <kbd key={k} className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded text-[9px] font-black text-slate-600 dark:text-slate-300">{k}</kbd>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
