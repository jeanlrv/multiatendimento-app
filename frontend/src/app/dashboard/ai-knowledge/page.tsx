'use client';

import { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AIKnowledgeService, KnowledgeBase, AIDocument, KBSyncLog } from '@/services/ai-knowledge';
import { AIAgentsService } from '@/services/ai-agents';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database, Plus, Trash2, FileText, Loader2, CheckCircle, Activity,
    ChevronRight, Save, RefreshCw, Zap, Download, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { KnowledgeBaseModal } from './_components/KnowledgeBaseModal';
import { DocumentModal, DocTypeIcon } from './_components/DocumentModal';
import { WebhookIntegrationCard } from './_components/WebhookIntegrationCard';

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
    const [newDoc, setNewDoc] = useState<{ title: string; sourceType: string; rawContent?: string; contentUrl?: string }>({
        title: '',
        sourceType: 'TEXT',
        rawContent: '',
    });
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
    const [docMode, setDocMode] = useState<'files' | 'web'>('files');
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [embeddingProviders, setEmbeddingProviders] = useState<{ id: string; name: string; models: { id: string; name: string; dimensions: number }[] }[]>([]);

    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    // Integração Local (Agente Windows)
    const [webhookEnabled, setWebhookEnabled] = useState(false);
    const [webhookApiKey, setWebhookApiKey] = useState<string | null>(null);
    const [webhookTogglingId, setWebhookTogglingId] = useState<string | null>(null);
    const [syncLogs, setSyncLogs] = useState<KBSyncLog[]>([]);
    const [loadingSyncLogs, setLoadingSyncLogs] = useState(false);
    const [showSyncLogs, setShowSyncLogs] = useState(false);
    const [backendPublicUrl, setBackendPublicUrl] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBases = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const [data, embProviders] = await Promise.all([
                AIKnowledgeService.findAllBases(signal),
                AIAgentsService.getEmbeddingProviders().catch((e) => {
                    console.error('Falha ao buscar Embedding Providers na Knowledge Page:', e);
                    return [{
                        id: 'native',
                        name: 'Nativo (fastembed CPU)',
                        models: [
                            { id: 'all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2 (Padrão, ~25MB)', dimensions: 384 },
                            { id: 'bge-small-en-v1.5', name: 'BGE Small EN v1.5 (~25MB)', dimensions: 384 },
                            { id: 'multilingual-e5-large', name: 'Multilingual E5 Large (PT-BR)', dimensions: 1024 }
                        ]
                    }];
                }),
            ]);
            setBases(data);
            setEmbeddingProviders(embProviders);
        } catch (error: any) {
            if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
            console.error('Erro ao buscar bases:', error);
            toast.error('Erro ao carregar bases de conhecimento');
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
        const controller = new AbortController();
        fetchBases(controller.signal);
        fetch('/api/public-config').then(r => r.json()).then(d => setBackendPublicUrl(d.backendUrl || '')).catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!selectedBase) return;
        setWebhookEnabled(selectedBase.webhookEnabled ?? false);
        setWebhookApiKey(selectedBase.webhookApiKey ?? null);
        setShowApiKey(false);
        setSyncLogs([]);
        setShowSyncLogs(false);
    }, [selectedBase?.id]);

    useEffect(() => {
        if (!selectedBase) return;

        const updateProcessingDocuments = async () => {
            try {
                const processingDocs = documents.filter(doc =>
                    doc.status === 'PENDING' || doc.status === 'PROCESSING'
                );
                if (processingDocs.length > 0) {
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

        const hasProcessingDocs = documents.some(doc =>
            doc.status === 'PENDING' || doc.status === 'PROCESSING'
        );

        if (hasProcessingDocs) {
            const interval = setInterval(updateProcessingDocuments, 5000);
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
            if (currentBase?.id) {
                await AIKnowledgeService.updateBase(currentBase.id, currentBase);
                toast.success('Base de conhecimento atualizada com sucesso');
                if (selectedBase?.id === currentBase.id) {
                    fetchDocuments(currentBase.id);
                }
            } else {
                await AIKnowledgeService.createBase(currentBase!);
                toast.success('Base de conhecimento criada com sucesso');
            }
            setIsBaseModalOpen(false);
            fetchBases();
        } catch (error) {
            console.error('Erro ao salvar base:', error);
            toast.error(currentBase?.id ? 'Erro ao atualizar base de conhecimento' : 'Erro ao criar base de conhecimento');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBase) return;
        try {
            setSubmitting(true);
            if (docMode === 'files') {
                let uploaded = 0;
                let failed = 0;
                for (const file of uploadFiles) {
                    uploaded++;
                    toast.loading(`Enviando ${uploaded}/${uploadFiles.length}: ${file.name}`, { id: 'upload-progress' });
                    try {
                        await AIKnowledgeService.uploadDocument(selectedBase.id, file);
                    } catch (fileErr) {
                        failed++;
                        console.error(`Falha no upload de ${file.name}:`, fileErr);
                    }
                }
                toast.dismiss('upload-progress');
                const success = uploadFiles.length - failed;
                if (failed > 0 && success > 0) {
                    toast.warning(`${success} enviado(s), ${failed} falhou(aram)`);
                } else if (failed > 0 && success === 0) {
                    toast.error(`Todos os ${failed} upload(s) falharam`);
                } else {
                    toast.success(`${success} arquivo(s) enviado(s) para processamento`);
                }
            } else {
                await AIKnowledgeService.addDocument(selectedBase.id, {
                    title: newDoc.title,
                    sourceType: newDoc.sourceType,
                    rawContent: newDoc.rawContent,
                    contentUrl: newDoc.contentUrl,
                });
                toast.success('Conhecimento adicionado para processamento');
            }
            setIsDocModalOpen(false);
            fetchDocuments(selectedBase.id);
            setUploadFiles([]);
            setNewDoc({ title: '', sourceType: 'TEXT', rawContent: '' });
        } catch (error) {
            console.error('Erro ao adicionar documento:', error);
            toast.error('Erro ao adicionar conhecimento');
        } finally {
            toast.dismiss('upload-progress');
            setSubmitting(false);
        }
    };

    const handleDeleteDoc = (id: string) => {
        toast('Remover este conhecimento?', {
            action: {
                label: 'Remover', onClick: async () => {
                    try {
                        await AIKnowledgeService.removeDocument(id);
                        if (selectedBase) fetchDocuments(selectedBase.id);
                        setSelectedDocIds(prev => prev.filter(item => item !== id));
                        toast.success('Documento removido');
                    } catch (error) {
                        console.error('Erro ao excluir documento:', error);
                        toast.error('Erro ao remover documento');
                    }
                }
            },
            cancel: { label: 'Cancelar', onClick: () => {} },
            duration: 5000,
        });
    };

    const handleBulkDelete = () => {
        if (selectedDocIds.length === 0) return;
        toast(`Remover ${selectedDocIds.length} conhecimentos selecionados?`, {
            action: {
                label: 'Remover Todos', onClick: async () => {
                    try {
                        setIsBulkDeleting(true);
                        await AIKnowledgeService.batchRemoveDocuments(selectedDocIds);
                        if (selectedBase) fetchDocuments(selectedBase.id);
                        setSelectedDocIds([]);
                        toast.success(`${selectedDocIds.length} documentos removidos`);
                    } catch (error) {
                        console.error('Erro ao excluir em lote:', error);
                        toast.error('Erro ao remover documentos selecionados');
                    } finally {
                        setIsBulkDeleting(false);
                    }
                }
            },
            cancel: { label: 'Cancelar', onClick: () => {} },
            duration: 5000,
        });
    };

    const handleBulkDownload = async () => {
        if (selectedDocIds.length === 0) return;
        try {
            setIsBulkDownloading(true);
            await AIKnowledgeService.downloadBulkDocuments(selectedDocIds);
            toast.success('Download iniciado (ZIP)');
        } catch (error) {
            console.error('Erro ao baixar em lote:', error);
            toast.error('Erro ao gerar pacote de download');
        } finally {
            setIsBulkDownloading(false);
        }
    };

    const handleDownloadDoc = async (doc: AIDocument) => {
        try {
            toast.info(`Iniciando download de ${doc.title}...`);
            await AIKnowledgeService.downloadDocument(doc.id, doc.title);
        } catch (error) {
            console.error('Erro ao baixar documento:', error);
            toast.error('Falha no download do documento');
        }
    };

    const toggleDocSelection = (id: string) => {
        setSelectedDocIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedDocIds.length === documents.length) {
            setSelectedDocIds([]);
        } else {
            setSelectedDocIds(documents.map(d => d.id));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setUploadFiles(prev => {
                const existing = new Set(prev.map(f => f.name));
                const added = filesArray.filter(f => !existing.has(f.name));
                return [...prev, ...added];
            });
            e.target.value = '';
        }
    };

    const handleToggleWebhook = async () => {
        if (!selectedBase) return;
        setWebhookTogglingId(selectedBase.id);
        try {
            if (webhookEnabled) {
                await AIKnowledgeService.disableWebhook(selectedBase.id);
                setWebhookEnabled(false);
                toast.success('Integração local desativada');
            } else {
                const { apiKey } = await AIKnowledgeService.enableWebhook(selectedBase.id);
                setWebhookEnabled(true);
                setWebhookApiKey(apiKey);
                setShowApiKey(true);
                toast.success('Integração local ativada');
            }
        } catch {
            toast.error('Erro ao alternar integração local');
        } finally {
            setWebhookTogglingId(null);
        }
    };

    const handleRotateKey = async () => {
        if (!selectedBase) return;
        if (!confirm('Isso invalida a chave atual. O Agente Windows precisará ser reconfigurado. Continuar?')) return;
        try {
            const { apiKey } = await AIKnowledgeService.rotateWebhookKey(selectedBase.id);
            setWebhookApiKey(apiKey);
            setShowApiKey(true);
            toast.success('Chave rotacionada com sucesso');
        } catch {
            toast.error('Erro ao rotacionar chave');
        }
    };

    const handleLoadSyncLogs = async () => {
        if (!selectedBase) return;
        setLoadingSyncLogs(true);
        setShowSyncLogs(true);
        try {
            const logs = await AIKnowledgeService.getSyncLogs(selectedBase.id);
            setSyncLogs(logs);
        } catch {
            toast.error('Erro ao buscar log de sincronização');
        } finally {
            setLoadingSyncLogs(false);
        }
    };

    // ── Modais em tela cheia (substituem o layout inteiro) ──

    if (isBaseModalOpen) {
        return (
            <KnowledgeBaseModal
                currentBase={currentBase}
                setCurrentBase={setCurrentBase}
                onClose={() => setIsBaseModalOpen(false)}
                onSave={handleSaveBase}
                submitting={submitting}
                embeddingProviders={embeddingProviders}
            />
        );
    }

    if (isDocModalOpen) {
        return (
            <DocumentModal
                onClose={() => setIsDocModalOpen(false)}
                onSubmit={handleAddDocument}
                submitting={submitting}
                docMode={docMode}
                setDocMode={setDocMode}
                uploadFiles={uploadFiles}
                setUploadFiles={setUploadFiles}
                newDoc={newDoc}
                setNewDoc={setNewDoc}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
            />
        );
    }

    return (
        <div className="space-y-8 relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-6rem)] pb-12">
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
                        setCurrentBase({
                            name: '',
                            description: '',
                            embeddingProvider: 'native',
                            embeddingModel: 'Xenova/bge-micro-v2',
                        });
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
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <Skeleton className="h-5 w-5 rounded shrink-0" />
                                            <div className="flex-1 space-y-1.5">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-4 w-4 rounded shrink-0" />
                                    </div>
                                ))}
                            </div>
                        ) : bases.length === 0 ? (
                            <p className="text-center text-xs font-bold text-slate-400 py-8 uppercase tracking-widest">Vazio</p>
                        ) : (
                            <div className="space-y-3">
                                {bases.map(base => (
                                    <div key={base.id} className="relative group">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => fetchDocuments(base.id)}
                                                className={`flex-1 p-5 rounded-2xl flex items-center justify-between transition-all ${selectedBase?.id === base.id ? 'bg-primary text-white shadow-xl translate-x-1' : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'}`}
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

                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCurrentBase({ ...base });
                                                        setIsBaseModalOpen(true);
                                                    }}
                                                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                                                    title="Editar Base"
                                                >
                                                    <Save size={14} />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!confirm(`Excluir permanentemente a base "${base.name}"?\n\nTODOS os documentos e vetores serão removidos.`)) return;
                                                        try {
                                                            await AIKnowledgeService.removeBase(base.id);
                                                            setBases(prev => prev.filter(b => b.id !== base.id));
                                                            if (selectedBase?.id === base.id) setSelectedBase(null);
                                                            toast.success('Base de conhecimento excluída');
                                                        } catch {
                                                            toast.error('Erro ao excluir base');
                                                        }
                                                    }}
                                                    className="p-2 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                                                    title="Excluir Base"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`Reprocessar todos os documentos da base "${selectedBase.name}"?\n\nIsso vai regerar todos os embeddings. Documentos com provider inválido serão migrados para o embedding nativo (local).`)) return;
                                            try {
                                                const result = await AIKnowledgeService.reprocessBase(selectedBase.id);
                                                toast.success(result.message);
                                                setDocuments(prev => prev.map(d => ({ ...d, status: 'PENDING' as const })));
                                            } catch (err: any) {
                                                const msg = err?.response?.data?.message || err?.message || 'Erro ao reprocessar a base';
                                                toast.error(msg);
                                            }
                                        }}
                                        className="px-4 py-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-500/30 flex items-center gap-2"
                                        title="Reprocessar todos os documentos (corrige embeddings nulos)"
                                    >
                                        <RefreshCw size={14} /> Reindexar Tudo
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDocMode('files');
                                            setUploadFiles([]);
                                            setNewDoc({ title: '', sourceType: 'TEXT', rawContent: '' });
                                            setIsDocModalOpen(true);
                                        }}
                                        className="px-6 py-3 bg-white dark:bg-white/10 text-primary font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all shadow-md flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Inserir Conhecimento
                                    </button>
                                </div>
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
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-all text-primary"
                                                >
                                                    {selectedDocIds.length === documents.length ? <CheckSquare size={18} /> : <Square size={18} />}
                                                </button>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {selectedDocIds.length} selecionados
                                                </span>
                                            </div>

                                            <AnimatePresence>
                                                {selectedDocIds.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <button
                                                            onClick={handleBulkDownload}
                                                            disabled={isBulkDownloading}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                        >
                                                            {isBulkDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                                            Baixar Selecionados
                                                        </button>
                                                        <button
                                                            onClick={handleBulkDelete}
                                                            disabled={isBulkDeleting}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                                        >
                                                            {isBulkDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            Excluir Selecionados
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {documents.map(doc => {
                                                const isSelected = selectedDocIds.includes(doc.id);
                                                return (
                                                    <div
                                                        key={doc.id}
                                                        className={`p-5 rounded-3xl border transition-all group flex items-center justify-between ${isSelected
                                                            ? 'bg-primary/5 border-primary shadow-md'
                                                            : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 hover:shadow-lg'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <button
                                                                onClick={() => toggleDocSelection(doc.id)}
                                                                className={`p-1 rounded-md transition-all ${isSelected ? 'text-primary' : 'text-slate-300 hover:text-slate-400'}`}
                                                            >
                                                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </button>
                                                            <DocTypeIcon sourceType={doc.sourceType} />
                                                            <div className="truncate">
                                                                <p className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-white truncate">{doc.title}</p>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${doc.status === 'READY' ? 'bg-emerald-500/10 text-emerald-600' : doc.status === 'ERROR' ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                                                        {doc.status}
                                                                    </span>
                                                                    {doc.isVectorized && (
                                                                        <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-primary/10 text-primary flex items-center gap-1">
                                                                            <Zap size={8} className="fill-current" /> Vetorizado no Banco
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                                        {doc.vectorizedCount !== undefined ? `${doc.vectorizedCount} / ${doc.chunkCount}` : doc.chunkCount} Vetores
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-4 flex-shrink-0">
                                                            <button
                                                                onClick={() => handleDownloadDoc(doc)}
                                                                className="p-2 hover:text-primary transition-all text-slate-400"
                                                                title="Baixar arquivo original"
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                            {(doc.status === 'ERROR' || (doc.status === 'READY' && (doc.chunkCount === 0 || doc.isVectorized === false))) && (
                                                                <button
                                                                    onClick={async () => {
                                                                        try {
                                                                            await AIKnowledgeService.reprocessDocument(doc.id);
                                                                            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'PENDING' as const } : d));
                                                                            toast.success('Documento enviado para reprocessamento');
                                                                        } catch (err: any) {
                                                                            const msg = err?.response?.data?.message || err?.message || 'Erro ao reprocessar documento';
                                                                            toast.error(msg);
                                                                        }
                                                                    }}
                                                                    className="p-2 hover:text-amber-500 transition-all text-slate-400"
                                                                    title={doc.status === 'ERROR' ? 'Reprocessar documento com erro' : 'Reprocessar (0 vetores — embedding pode ter falhado)'}
                                                                >
                                                                    <RefreshCw size={16} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteDoc(doc.id)}
                                                                className="p-2 hover:text-rose-500 transition-all text-slate-400"
                                                                title="Remover Documento"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Integração Local (Agente Windows) */}
                            <div className="px-8 pb-8">
                                <WebhookIntegrationCard
                                    webhookEnabled={webhookEnabled}
                                    webhookApiKey={webhookApiKey}
                                    webhookTogglingId={webhookTogglingId}
                                    showApiKey={showApiKey}
                                    setShowApiKey={setShowApiKey}
                                    backendPublicUrl={backendPublicUrl}
                                    onToggleWebhook={handleToggleWebhook}
                                    onRotateKey={handleRotateKey}
                                    syncLogs={syncLogs}
                                    showSyncLogs={showSyncLogs}
                                    setShowSyncLogs={setShowSyncLogs}
                                    loadingSyncLogs={loadingSyncLogs}
                                    onLoadSyncLogs={handleLoadSyncLogs}
                                />
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
