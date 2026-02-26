'use client';

import { useState, useEffect, useRef } from 'react';
import { AIKnowledgeService, KnowledgeBase, AIDocument } from '@/services/ai-knowledge';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Plus, Pencil, Trash2, FileText, Globe, FileUp, Loader2, CheckCircle, XCircle, Search, Activity, ChevronRight, X, Save, Zap, FileCode, UploadCloud, RefreshCw } from 'lucide-react';

export default function AIKnowledgePage() {
    const [bases, setBases] = useState<KnowledgeBase[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
    const [currentBase, setCurrentBase] = useState<Partial<KnowledgeBase> | null>(null);
    const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [documents, setDocuments] = useState<AIDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [newDoc, setNewDoc] = useState<{ title: string; sourceType: 'TEXT' | 'PDF' | 'URL' | 'DOCX'; rawContent?: string; contentUrl?: string; file?: File | null }>({
        title: '',
        sourceType: 'TEXT',
        rawContent: '',
        file: null
    });
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBases = async () => {
        try {
            setLoading(true);
            const data = await AIKnowledgeService.findAllBases();
            setBases(data);
        } catch (error) {
            console.error('Erro ao buscar bases:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDocuments = async (baseId: string) => {
        try {
            setLoadingDocs(true);
            const data = await AIKnowledgeService.findOneBase(baseId);
            setDocuments(data.documents);
            setSelectedBase(data);
        } catch (error) {
            console.error('Erro ao buscar documentos:', error);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        fetchBases();
    }, []);

    // Polling automático de status de documentos
    useEffect(() => {
        if (!selectedBase) return;

        // Função para atualizar documentos com status PENDING ou PROCESSING
        const updateProcessingDocuments = async () => {
            try {
                const processingDocs = documents.filter(doc =>
                    doc.status === 'PENDING' || doc.status === 'PROCESSING'
                );

                if (processingDocs.length > 0) {
                    // Atualizar status de cada documento em processamento
                    const updatedDocs = await Promise.all(
                        processingDocs.map(async (doc) => {
                            try {
                                const status = await AIKnowledgeService.getDocumentStatus(doc.id);
                                return { ...doc, ...status };
                            } catch (error) {
                                console.error(`Erro ao atualizar status do documento ${doc.id}:`, error);
                                return doc;
                            }
                        })
                    );

                    // Atualizar documentos no estado
                    setDocuments(prevDocs =>
                        prevDocs.map(doc => {
                            const updatedDoc = updatedDocs.find(d => d.id === doc.id);
                            return updatedDoc ? updatedDoc : doc;
                        })
                    );
                }
            } catch (error) {
                console.error('Erro no polling de status:', error);
            }
        };

        // Iniciar polling se houver documentos em processamento
        const hasProcessingDocs = documents.some(doc =>
            doc.status === 'PENDING' || doc.status === 'PROCESSING'
        );

        if (hasProcessingDocs) {
            const interval = setInterval(updateProcessingDocuments, 5000); // 5 segundos
            setPollingInterval(interval);
            return () => clearInterval(interval);
        } else if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
    }, [selectedBase, documents]);

    const handleSaveBase = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await AIKnowledgeService.createBase(currentBase!);
            setIsBaseModalOpen(false);
            fetchBases();
        } catch (error) {
            console.error('Erro ao salvar base:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBase) return;

        try {
            setSubmitting(true);

            if ((newDoc.sourceType === 'PDF' || newDoc.sourceType === 'DOCX') && newDoc.file) {
                // Upload de arquivo real
                await AIKnowledgeService.uploadDocument(selectedBase.id, newDoc.file);
            } else {
                // Adição via Link/Texto
                await AIKnowledgeService.addDocument(selectedBase.id, {
                    title: newDoc.title,
                    sourceType: newDoc.sourceType,
                    rawContent: newDoc.rawContent,
                    contentUrl: newDoc.contentUrl
                });
            }

            setIsDocModalOpen(false);
            fetchDocuments(selectedBase.id);
            setNewDoc({ title: '', sourceType: 'TEXT', rawContent: '', file: null });
        } catch (error) {
            console.error('Erro ao adicionar documento:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm('Excluir este conhecimento?')) return;
        try {
            await AIKnowledgeService.removeDocument(id);
            if (selectedBase) fetchDocuments(selectedBase.id);
        } catch (error) {
            console.error('Erro ao excluir documento:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const isDocx = file.name.endsWith('.docx');
            const isPdf = file.name.endsWith('.pdf');

            setNewDoc({
                ...newDoc,
                file,
                title: newDoc.title || file.name,
                sourceType: isDocx ? 'DOCX' : isPdf ? 'PDF' : newDoc.sourceType
            });
        }
    };

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-[calc(100vh-6rem)] pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 px-4 pt-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Database className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Repositório <span className="text-primary italic">Cognitivo</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        Gestão de Bases de Conhecimento RAG
                    </p>
                </div>

                <button
                    onClick={() => {
                        setCurrentBase({ name: '', description: '' });
                        setIsBaseModalOpen(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest group"
                >
                    <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                    Criar Base
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 px-4">
                {/* Lista de Bases */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="glass-heavy p-6 rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-xl">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 uppercase tracking-tight italic flex items-center gap-2">
                            <Database size={18} className="text-primary" /> Bases Ativas
                        </h3>

                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-white/5 rounded-2xl" />)}
                            </div>
                        ) : bases.length === 0 ? (
                            <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase tracking-widest">Vazio</p>
                        ) : (
                            <div className="space-y-3">
                                {bases.map(base => (
                                    <button
                                        key={base.id}
                                        onClick={() => fetchDocuments(base.id)}
                                        className={`w-full p-5 rounded-2xl flex items-center justify-between transition-all group ${selectedBase?.id === base.id ? 'bg-primary text-white shadow-xl translate-x-1' : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'}`}
                                    >
                                        <div className="flex items-center gap-4 truncate">
                                            <Database size={18} className={selectedBase?.id === base.id ? 'text-white' : 'text-primary'} />
                                            <div className="text-left truncate">
                                                <p className="text-sm font-black uppercase tracking-tight truncate">{base.name}</p>
                                                <p className={`text-[9px] font-bold uppercase tracking-widest ${selectedBase?.id === base.id ? 'text-white/70' : 'text-slate-400'}`}>{base._count?.documents || 0} Docs</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className={`transition-transform ${selectedBase?.id === base.id ? 'translate-x-1' : 'group-hover:translate-x-1'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detalhes e Documentos */}
                <div className="lg:col-span-8">
                    {!selectedBase ? (
                        <div className="glass-heavy h-[500px] rounded-[3rem] border border-white/80 dark:border-white/10 flex flex-col items-center justify-center text-center p-12 italic">
                            <Database size={48} className="text-primary/20 mb-6" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Selecione uma base para gerenciar o conhecimento</p>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-heavy rounded-[3rem] border border-white/80 dark:border-white/10 shadow-2xl overflow-hidden min-h-[500px] flex flex-col"
                        >
                            <div className="p-8 bg-primary/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic flex items-center gap-3">
                                        {selectedBase.name}
                                        <CheckCircle size={16} className="text-primary animate-pulse" />
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{selectedBase.description || 'Base cognitiva operacional'}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setNewDoc({ title: '', sourceType: 'PDF', rawContent: '', file: null });
                                        setIsDocModalOpen(true);
                                    }}
                                    className="px-6 py-3 bg-white dark:bg-white/10 text-primary font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all shadow-md flex items-center gap-2"
                                >
                                    <Plus size={16} /> Enxertar Conhecimento
                                </button>
                            </div>

                            <div className="flex-1 p-8">
                                {loadingDocs ? (
                                    <div className="flex items-center justify-center h-48">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 grayscale opacity-30 italic">
                                        <FileText size={48} className="mb-4" />
                                        <p className="text-sm font-bold uppercase tracking-widest">Nenhum dado processado</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {documents.map(doc => (
                                            <div key={doc.id} className="p-5 bg-white dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10 flex items-center justify-between hover:shadow-lg transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${doc.status === 'READY' ? 'bg-emerald-100 text-emerald-600' : doc.status === 'ERROR' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                                        {doc.sourceType === 'PDF' ? <FileUp size={20} /> : doc.sourceType === 'DOCX' ? <FileCode size={20} /> : doc.sourceType === 'URL' ? <Globe size={20} /> : <FileText size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white line-clamp-1">{doc.title}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${doc.status === 'READY' ? 'bg-emerald-500/10 text-emerald-600' : doc.status === 'ERROR' ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                {doc.status}
                                                            </span>
                                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{doc.chunkCount} Vetores</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    {doc.status === 'ERROR' && (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await AIKnowledgeService.reprocessDocument(doc.id);
                                                                    if (selectedBase) fetchDocuments(selectedBase.id);
                                                                } catch (error) {
                                                                    console.error('Erro ao reprocessar documento:', error);
                                                                }
                                                            }}
                                                            className="p-2 hover:text-primary transition-all"
                                                            title="Reprocessar Documento"
                                                        >
                                                            <RefreshCw size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteDoc(doc.id)}
                                                        className="p-2 hover:text-rose-500 transition-all"
                                                        title="Remover Documento"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Modal: Base de Conhecimento */}
            <AnimatePresence>
                {isBaseModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setIsBaseModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-white/10">
                            <h3 className="text-2xl font-black mb-6 italic uppercase tracking-tighter">Criar <span className="text-primary">Base Cognitiva</span></h3>
                            <form onSubmit={handleSaveBase} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome da Base</label>
                                    <input required value={currentBase?.name} onChange={e => setCurrentBase({ ...currentBase, name: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Descrição</label>
                                    <input value={currentBase?.description} onChange={e => setCurrentBase({ ...currentBase, description: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none" />
                                </div>
                                <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Sincronizar
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Modal: Adicionar Documento */}
                {isDocModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setIsDocModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-white/10">
                            <h3 className="text-2xl font-black mb-6 italic uppercase tracking-tighter">Enxertar <span className="text-primary">Conhecimento</span></h3>
                            <form onSubmit={handleAddDocument} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tag de Identificação</label>
                                        <input required value={newDoc.title} onChange={e => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Nome do documento..." className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fonte</label>
                                        <select value={newDoc.sourceType} onChange={e => setNewDoc({ ...newDoc, sourceType: e.target.value as any, file: null })} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm">
                                            <option value="TEXT">Texto Livre</option>
                                            <option value="URL">Website/URL</option>
                                            <option value="PDF">Arquivo PDF (Upload Local)</option>
                                            <option value="DOCX">Arquivo Word (.docx)</option>
                                        </select>
                                    </div>
                                </div>

                                {newDoc.sourceType === 'TEXT' ? (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Conteúdo Bruto</label>
                                        <textarea required value={newDoc.rawContent} onChange={e => setNewDoc({ ...newDoc, rawContent: e.target.value })} className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-medium text-sm h-48 resize-none italic" placeholder="Cole aqui o conhecimento que a IA deve dominar..." />
                                    </div>
                                ) : newDoc.sourceType === 'URL' ? (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Link Externo</label>
                                        <input required value={newDoc.contentUrl} onChange={e => setNewDoc({ ...newDoc, contentUrl: e.target.value })} placeholder="https://..." className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Upload de Arquivo</label>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all group"
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                accept={newDoc.sourceType === 'PDF' ? '.pdf' : '.docx'}
                                                className="hidden"
                                            />
                                            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <UploadCloud className="text-primary" size={32} />
                                            </div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                                {newDoc.file ? newDoc.file.name : `Clique para selecionar seu ${newDoc.sourceType}`}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic">Max: 10MB</p>
                                        </div>
                                    </div>
                                )}
                                <button disabled={submitting || ((newDoc.sourceType === 'PDF' || newDoc.sourceType === 'DOCX') && !newDoc.file)} type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50">
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Fundir Inteligência
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
