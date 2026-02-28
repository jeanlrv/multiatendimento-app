'use client';

import { useState, useEffect } from 'react';
import { TagsService, Tag } from '@/services/tags';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Pencil, Trash2, X, Search, Tag as TagIcon, ChevronLeft, Save } from 'lucide-react';
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

    if (isModalOpen) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pt-6 pb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl flex flex-col"
                >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                        <div className="flex items-center gap-4">
                            <div
                                className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-primary/10 transition-colors text-white"
                                style={{ backgroundColor: watch('color') || '#3B82F6' }}
                            >
                                <TagIcon className="h-6 w-6 md:h-8 md:w-8" />
                            </div>
                            <div>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                                >
                                    <ChevronLeft size={16} /> Voltar para Lista
                                </button>
                                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                                    {editingTag ? 'Editar' : 'Nova'} <span className="text-primary italic">Etiqueta</span>
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Categorização Aero de chamados</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4 md:mt-0 w-full md:w-auto">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all hidden md:block"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit(onSubmit)}
                                className="flex-1 md:flex-none px-8 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <Save className="w-4 h-4" />
                                {editingTag ? 'Atualizar Aero' : 'Criar Registro'}
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-4">
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
                                <div className="relative h-14 w-14 group border-4 border-white dark:border-slate-800 rounded-2xl shadow-lg transition-transform hover:scale-110" style={{ backgroundColor: watch('color') || '#3B82F6' }}>
                                    <input
                                        type="color"
                                        {...register('color')}
                                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
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
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pb-12">
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

        </div>
    );
}
