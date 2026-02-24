'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Star, MoreVertical, Plus, Trash2, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export interface SavedFilter {
    id: string;
    name: string;
    filters: any;
    color?: string;
}

interface SmartViewSidebarProps {
    onSelectFilter: (filters: any) => void;
    activeFilterId?: string;
    currentFilters: any;
    onSaveCurrent: (name: string, color: string) => Promise<void>;
}

export const SmartViewSidebar: React.FC<SmartViewSidebarProps> = ({
    onSelectFilter,
    activeFilterId,
    currentFilters,
    onSaveCurrent
}) => {
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
    const [loading, setLoading] = useState(true);
    const [isNaming, setIsNaming] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3B82F6');

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    useEffect(() => {
        fetchSavedFilters();
    }, []);

    const fetchSavedFilters = async () => {
        try {
            const res = await api.get('/saved-filters');
            setSavedFilters(res.data);
        } catch (error) {
            console.error('Erro ao buscar filtros salvos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newName.trim()) return;
        await onSaveCurrent(newName, selectedColor);
        setIsNaming(false);
        setNewName('');
        fetchSavedFilters();
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await api.delete(`/saved-filters/${id}`);
            setSavedFilters(prev => prev.filter(f => f.id !== id));
            toast.success('Filtro removido');
        } catch (error) {
            toast.error('Erro ao remover filtro');
        }
    };

    return (
        <div className="w-16 md:w-64 flex-shrink-0 flex flex-col bg-white/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-white/10 h-full">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <Star className="w-5 h-5 text-amber-400 shrink-0" />
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-gray-400 hidden md:block">Smart Views</h3>
                </div>
                {!isNaming ? (
                    <button
                        onClick={() => setIsNaming(true)}
                        className="p-1 hover:bg-primary/10 rounded-lg text-primary transition-all md:block hidden"
                        title="Salvar visão atual"
                    >
                        <Plus size={18} />
                    </button>
                ) : (
                    <button onClick={() => setIsNaming(false)} className="p-1 text-slate-400"><Trash2 size={14} /></button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {/* Nomear Novo Filtro */}
                <AnimatePresence>
                    {isNaming && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-primary/30 shadow-xl space-y-3 mb-4"
                        >
                            <input
                                autoFocus
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Nome da View..."
                                className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl text-xs py-2 px-3 outline-none"
                            />
                            <div className="flex items-center gap-1.5 justify-center">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setSelectedColor(c)}
                                        className={`w-4 h-4 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-white ring-offset-1 dark:ring-slate-800' : 'opacity-60'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                                Salvar
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <div className="space-y-2 p-2">
                        {[1, 2].map(i => <div key={i} className="h-10 bg-slate-200 dark:bg-white/5 rounded-xl animate-pulse" />)}
                    </div>
                ) : (
                    savedFilters.map(sf => (
                        <button
                            key={sf.id}
                            onClick={() => onSelectFilter(sf.filters)}
                            className={`w-full group flex items-center gap-3 p-3 rounded-2xl transition-all relative ${activeFilterId === sf.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-500'
                                }`}
                        >
                            <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sf.color || '#3B82F6' }}
                            />
                            <span className="text-xs font-bold truncate hidden md:block">{sf.name}</span>

                            <button
                                onClick={(e) => handleDelete(e, sf.id)}
                                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg transition-all hidden md:block"
                            >
                                <Trash2 size={12} />
                            </button>
                        </button>
                    ))
                )}

                {savedFilters.length === 0 && !loading && !isNaming && (
                    <div className="p-4 text-center opacity-30 mt-10 hidden md:block">
                        <Filter className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-tighter">Nenhuma View Salva</p>
                    </div>
                )}
            </div>
        </div>
    );
};
