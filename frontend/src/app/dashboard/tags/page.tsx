'use client';

import { useState, useEffect } from 'react';
import { TagsService, Tag } from '@/services/tags';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Pencil, Trash2, X, Search, Tag as TagIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const tagSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor inválida'),
});

type TagForm = z.infer<typeof tagSchema>;

export default function TagsPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<TagForm>({
        resolver: zodResolver(tagSchema),
        defaultValues: {
            color: '#3B82F6'
        }
    });

    const fetchTags = async () => {
        try {
            setLoading(true);
            const data = await TagsService.findAll();
            setTags(data);
        } catch (error) {
            console.error('Erro ao buscar tags:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const openModal = (tag?: Tag) => {
        if (tag) {
            setEditingTag(tag);
            setValue('name', tag.name);
            setValue('color', tag.color);
        } else {
            setEditingTag(null);
            reset({ color: '#3B82F6' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTag(null);
        reset();
    };

    const onSubmit = async (data: TagForm) => {
        try {
            if (editingTag) {
                await TagsService.update(editingTag.id, data);
            } else {
                await TagsService.create(data);
            }
            fetchTags();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar tag:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta tag?')) {
            try {
                await TagsService.remove(id);
                fetchTags();
            } catch (error) {
                console.error('Erro ao excluir tag:', error);
            }
        }
    };

    const filteredTags = tags.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 relative liquid-glass aurora pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic">Etiquetas</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Categorização Aero de chamados</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar tag..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-4 glass-heavy dark:bg-transparent border border-white/80 dark:border-white/10 rounded-[1.5rem] text-xs font-bold uppercase tracking-wider outline-none focus:ring-4 focus:ring-primary/10 transition-all w-64 shadow-xl"
                        />
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-xl shadow-primary/20 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Nova Tag</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 relative z-10 px-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-32 glass-heavy rounded-[2rem] animate-pulse" />
                    ))}
                </div>
            ) : filteredTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 mx-4 relative z-10">
                    <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <TagIcon className="h-10 w-10 text-primary opacity-40 rotate-12" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Nenhuma tag cadastrada</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Organize seus atendimentos por etiquetas Aero</p>
                    <button
                        onClick={() => openModal()}
                        className="px-10 py-4 bg-primary text-white rounded-[1.5rem] font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-90 transition-all"
                    >
                        Começar Agora
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 relative z-10 px-4">
                    {filteredTags.map((tag, index) => (
                        <motion.div
                            key={tag.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="liquid-glass dark:bg-transparent p-6 rounded-[2rem] border border-white/80 dark:border-white/10 shadow-2xl group relative overflow-hidden"
                        >
                            <div
                                className="absolute top-0 left-0 w-full h-1.5 opacity-60"
                                style={{ backgroundColor: tag.color }}
                            />

                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg transform -rotate-12 group-hover:rotate-0 transition-transform"
                                    style={{ backgroundColor: tag.color, boxShadow: `0 10px 20px -5px ${tag.color}66` }}
                                >
                                    <TagIcon className="h-5 w-5" />
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    <button
                                        onClick={() => openModal(tag)}
                                        className="h-8 w-8 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-primary hover:text-white text-primary rounded-lg transition-all border border-white/50 dark:border-white/10"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tag.id)}
                                        className="h-8 w-8 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-all border border-white/50 dark:border-white/10"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight truncate mb-1" title={tag.name}>{tag.name}</h3>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest italic opacity-60">#{tag.id.split('-')[0]}</span>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                            onClick={closeModal}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative w-full max-w-md liquid-glass dark:bg-slate-900/90 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/80 dark:border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                                    {editingTag ? 'Editar Tag' : 'Inovar Tag'}
                                </h3>
                                <button
                                    onClick={closeModal}
                                    className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
                                >
                                    <X className="h-6 w-6 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Título da Etiqueta</label>
                                    <input
                                        {...register('name')}
                                        className="w-full px-6 py-4 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-semibold dark:text-white uppercase placeholder:text-slate-400"
                                        placeholder="EX: VIP AERO"
                                    />
                                    {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-2">{errors.name.message}</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Identidade Cromática</label>
                                    <div className="flex gap-4">
                                        <div className="relative h-14 w-14 group">
                                            <input
                                                type="color"
                                                {...register('color')}
                                                className="absolute inset-0 h-full w-full rounded-2xl p-0 border-0 overflow-hidden cursor-pointer opacity-0 z-10"
                                            />
                                            <div
                                                className="h-full w-full rounded-2xl shadow-lg border-4 border-white dark:border-slate-800 transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: watch('color') }}
                                            />
                                        </div>
                                        <input
                                            {...register('color')}
                                            className="flex-1 px-6 py-4 rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-semibold dark:text-white uppercase font-mono"
                                            placeholder="#38BDF8"
                                        />
                                    </div>
                                    {errors.color && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-2 ml-2">{errors.color.message}</p>}
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 py-4.5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-500 shadow-sm"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-4.5 rounded-[1.5rem] bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                                    >
                                        {editingTag ? 'Atualizar Aero' : 'Criar Registro'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
