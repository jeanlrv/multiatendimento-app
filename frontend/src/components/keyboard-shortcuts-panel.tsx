'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { KeyboardShortcut, formatShortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts: KeyboardShortcut[];
}

interface ShortcutGroup {
    title: string;
    shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsPanel({ isOpen, onClose, shortcuts }: KeyboardShortcutsPanelProps) {
    // Agrupar atalhos por contexto (baseado na descrição)
    const groupedShortcuts: ShortcutGroup[] = [
        {
            title: 'Navegação Global',
            shortcuts: shortcuts.filter(s =>
                s.description.includes('Busca') ||
                s.description.includes('Novo') ||
                s.description.includes('Fechar') ||
                s.description.includes('Atalhos')
            ),
        },
        {
            title: 'Lista de Tickets',
            shortcuts: shortcuts.filter(s =>
                s.description.includes('Próximo') ||
                s.description.includes('Anterior') ||
                s.description.includes('Abrir')
            ),
        },
        {
            title: 'Chat',
            shortcuts: shortcuts.filter(s =>
                s.description.includes('Enviar') ||
                s.description.includes('Resposta')
            ),
        },
    ].filter(group => group.shortcuts.length > 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl border border-gray-200 dark:border-gray-800 max-w-3xl w-full max-h-[80vh] overflow-hidden">
                            {/* Header */}
                            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                                        <Keyboard className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                            Atalhos de Teclado
                                        </h2>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                                            Navegue mais rápido com o teclado
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                                >
                                    <X className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-8 overflow-y-auto custom-scrollbar max-h-[calc(80vh-120px)]">
                                <div className="space-y-8">
                                    {groupedShortcuts.map((group, idx) => (
                                        <motion.div
                                            key={group.title}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                        >
                                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
                                                {group.title}
                                            </h3>
                                            <div className="space-y-3">
                                                {group.shortcuts.map((shortcut, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                                    >
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {shortcut.description}
                                                        </span>
                                                        <kbd className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-900 dark:text-white shadow-sm">
                                                            {formatShortcut(shortcut)}
                                                        </kbd>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Footer Tip */}
                                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                                    <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                                        💡 <strong>Dica:</strong> Pressione <kbd className="px-2 py-0.5 bg-white dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded text-[10px] font-bold mx-1">Ctrl+/</kbd> a qualquer momento para abrir este painel.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
