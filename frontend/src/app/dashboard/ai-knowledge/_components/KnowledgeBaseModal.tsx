'use client';

import { motion } from 'framer-motion';
import { Database, ChevronLeft, Save, Loader2 } from 'lucide-react';
import { KnowledgeBase } from '@/services/ai-knowledge';

type EmbeddingProvider = {
    id: string;
    name: string;
    models: { id: string; name: string; dimensions: number }[];
};

type Props = {
    currentBase: Partial<KnowledgeBase> | null;
    setCurrentBase: (base: Partial<KnowledgeBase>) => void;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    submitting: boolean;
    embeddingProviders: EmbeddingProvider[];
};

export function KnowledgeBaseModal({ currentBase, setCurrentBase, onClose, onSave, submitting, embeddingProviders }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl flex flex-col md:mt-6 pb-12"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-primary/10 transition-colors text-white bg-primary">
                        <Database className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                        >
                            <ChevronLeft size={16} /> Voltar
                        </button>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                            {currentBase?.id ? 'Editar' : 'Criar'} <span className="text-primary italic">Base Cognitiva</span>
                        </h3>
                    </div>
                </div>
            </div>

            <form onSubmit={onSave} className="space-y-6 max-w-2xl mx-auto w-full">
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Base</label>
                    <input
                        required
                        value={currentBase?.name || ''}
                        onChange={e => setCurrentBase({ ...currentBase, name: e.target.value })}
                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Descrição</label>
                    <input
                        value={currentBase?.description || ''}
                        onChange={e => setCurrentBase({ ...currentBase, description: e.target.value })}
                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none"
                    />
                </div>
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Provedor de Embedding</label>
                    <p className="text-[10px] text-slate-400">Modelo de vetorização usado para indexar documentos e realizar buscas semânticas.</p>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={currentBase?.embeddingProvider || embeddingProviders[0]?.id || 'openai'}
                            onChange={e => {
                                const firstModel = embeddingProviders.find(p => p.id === e.target.value)?.models[0]?.id || '';
                                setCurrentBase({ ...currentBase, embeddingProvider: e.target.value, embeddingModel: firstModel });
                            }}
                            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none appearance-none"
                        >
                            {embeddingProviders.length === 0 && <option value="">Nenhum provider configurado</option>}
                            {embeddingProviders.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <select
                            value={currentBase?.embeddingModel || ''}
                            onChange={e => setCurrentBase({ ...currentBase, embeddingModel: e.target.value })}
                            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none appearance-none"
                        >
                            {(() => {
                                const selectedProviderId = currentBase?.embeddingProvider || (embeddingProviders.length > 0 ? embeddingProviders[0].id : 'native');
                                const provider = embeddingProviders.find(p => p.id === selectedProviderId);

                                if (provider && provider.models.length > 0) {
                                    return provider.models.map((m: { id: string; name: string; dimensions: number }) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ));
                                }

                                if (selectedProviderId === 'native') {
                                    return (
                                        <>
                                            <option value="Xenova/all-MiniLM-L6-v2">all-MiniLM-L6-v2 (Padrão)</option>
                                            <option value="Xenova/bge-micro-v2">bge-micro-v2 (Rápido)</option>
                                        </>
                                    );
                                }

                                return <option value="">Nenhum modelo disponível</option>;
                            })()}
                        </select>
                    </div>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                    <button
                        disabled={submitting}
                        type="submit"
                        className="w-full py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {currentBase?.id ? 'Salvar Alterações' : 'Sincronizar Base'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
