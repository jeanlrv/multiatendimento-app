'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare, User, X, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';

interface SearchResult {
    tickets: {
        id: string;
        subject: string;
        status: string;
        updatedAt: string;
        contact: { name: string; phoneNumber: string };
        department: { name: string; emoji: string; color: string };
    }[];
    contacts: {
        id: string;
        name: string;
        phoneNumber: string;
        email?: string;
    }[];
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult>({ tickets: [], contacts: [] });
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const debounceRef = useRef<NodeJS.Timeout>();

    // Cmd+K / Ctrl+K listener
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(v => !v);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults({ tickets: [], contacts: [] });
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const search = useCallback(async (q: string) => {
        if (q.length < 2) { setResults({ tickets: [], contacts: [] }); return; }
        setLoading(true);
        try {
            const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
            setResults(res.data);
            setActiveIndex(0);
        } catch {
            setResults({ tickets: [], contacts: [] });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(val), 300);
    };

    const allItems = [
        ...results.tickets.map(t => ({ type: 'ticket' as const, data: t })),
        ...results.contacts.map(c => ({ type: 'contact' as const, data: c })),
    ];

    const navigate = (item: typeof allItems[0]) => {
        setOpen(false);
        if (item.type === 'ticket') {
            router.push(`/dashboard/tickets?id=${item.data.id}`);
        } else {
            router.push(`/dashboard/contacts`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allItems.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter' && allItems[activeIndex]) navigate(allItems[activeIndex]);
    };

    const translateStatus = (s: string) => ({ OPEN: 'Aberto', IN_PROGRESS: 'Em Atend.', RESOLVED: 'Resolvido', PAUSED: 'Pausado' }[s] || s);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] p-4 bg-black/50 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: -10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/10">
                            {loading ? <Loader2 size={18} className="text-primary animate-spin shrink-0" /> : <Search size={18} className="text-slate-400 shrink-0" />}
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => handleQueryChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar tickets, contatos..."
                                className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                            />
                            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Results */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {query.length < 2 ? (
                                <div className="px-4 py-8 text-center text-xs text-slate-400">
                                    Digite ao menos 2 caracteres para buscar
                                </div>
                            ) : allItems.length === 0 && !loading ? (
                                <div className="px-4 py-8 text-center text-xs text-slate-400">Nenhum resultado encontrado</div>
                            ) : (
                                <div className="py-2">
                                    {results.tickets.length > 0 && (
                                        <>
                                            <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                                <MessageSquare size={10} /> Tickets
                                            </div>
                                            {results.tickets.map((t, i) => {
                                                const idx = i;
                                                const isActive = idx === activeIndex;
                                                return (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => navigate({ type: 'ticket', data: t })}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                    >
                                                        <div className="h-8 w-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                                                            style={{ backgroundColor: `${t.department.color || '#2563eb'}20` }}>
                                                            {t.department.emoji || '💬'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.contact.name}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{t.subject || 'Sem assunto'} · {t.department.name}</p>
                                                        </div>
                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 shrink-0">
                                                            {translateStatus(t.status)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}
                                    {results.contacts.length > 0 && (
                                        <>
                                            <div className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mt-1">
                                                <User size={10} /> Contatos
                                            </div>
                                            {results.contacts.map((c, i) => {
                                                const idx = results.tickets.length + i;
                                                const isActive = idx === activeIndex;
                                                return (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => navigate({ type: 'contact', data: c })}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                    >
                                                        <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">
                                                            {c.name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                                                            <p className="text-[10px] text-slate-500">{c.phoneNumber}</p>
                                                        </div>
                                                        <ArrowRight size={12} className="text-slate-300 shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-3 text-[10px] text-slate-400">
                            <span><kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/20 font-mono">↑↓</kbd> navegar</span>
                            <span><kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/20 font-mono">↵</kbd> abrir</span>
                            <span><kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/20 font-mono">Esc</kbd> fechar</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
