'use client';

import { useState, useEffect, useRef } from 'react';
import { AIKnowledgeService, KnowledgeBase, AIDocument } from '@/services/ai-knowledge';
import { AIAgentsService } from '@/services/ai-agents';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Plus, Trash2, FileText, Globe, FileUp, Loader2, CheckCircle, Activity, ChevronRight, ChevronLeft, Save, Zap, FileCode, UploadCloud, RefreshCw, Music, Youtube, Github, FileSpreadsheet, Presentation, BookOpen, Braces, AlignLeft, X, Download, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

// Mapeamento de sourceType → ícone e cor
const SOURCE_TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    TEXT: { icon: AlignLeft, color: 'bg-slate-100 text-slate-600', label: 'Texto' },
    TXT: { icon: AlignLeft, color: 'bg-slate-100 text-slate-600', label: 'TXT' },
    MD: { icon: FileText, color: 'bg-purple-100 text-purple-600', label: 'Markdown' },
    HTML: { icon: Globe, color: 'bg-orange-100 text-orange-600', label: 'HTML' },
    CSV: { icon: FileSpreadsheet, color: 'bg-green-100 text-green-600', label: 'CSV' },
    JSON: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'JSON' },
    YAML: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'YAML' },
    XML: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'XML' },
    RTF: { icon: AlignLeft, color: 'bg-slate-100 text-slate-600', label: 'RTF' },
    PDF: { icon: FileUp, color: 'bg-rose-100 text-rose-600', label: 'PDF' },
    DOCX: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Word' },
    XLSX: { icon: FileSpreadsheet, color: 'bg-green-100 text-green-600', label: 'Excel' },
    XLS: { icon: FileSpreadsheet, color: 'bg-green-100 text-green-600', label: 'Excel' },
    PPTX: { icon: Presentation, color: 'bg-orange-100 text-orange-600', label: 'PowerPoint' },
    EPUB: { icon: BookOpen, color: 'bg-violet-100 text-violet-600', label: 'EPUB' },
    CODE: { icon: FileCode, color: 'bg-cyan-100 text-cyan-600', label: 'Código' },
    AUDIO: { icon: Music, color: 'bg-pink-100 text-pink-600', label: 'Áudio' },
    URL: { icon: Globe, color: 'bg-sky-100 text-sky-600', label: 'Website' },
    YOUTUBE: { icon: Youtube, color: 'bg-red-100 text-red-600', label: 'YouTube' },
    GITHUB: { icon: Github, color: 'bg-slate-100 text-slate-700', label: 'GitHub' },
};

function DocTypeIcon({ sourceType, size = 20 }: { sourceType: string; size?: number }) {
    const meta = SOURCE_TYPE_META[sourceType?.toUpperCase()] || SOURCE_TYPE_META.TEXT;
    const Icon = meta.icon;
    return <div className={`p-3 rounded-xl ${meta.color}`}><Icon size={size} /></div>;
}

// Tipos que precisam de URL (não upload de arquivo)
const URL_INPUT_TYPES = new Set(['URL', 'YOUTUBE', 'GITHUB']);

// Accept string cobrindo todos os tipos de arquivo suportados
const ALL_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.epub,.txt,.md,.mdx,.markdown,.rtf,.csv,.json,.yaml,.yml,.xml,.html,.htm,.js,.ts,.jsx,.tsx,.py,.java,.go,.rb,.php,.cs,.cpp,.c,.rs,.swift,.kt,.sh,.sql,.mp3,.wav,.mp4,.ogg,.webm,.m4a';

// Tipos que exigem entrada de URL ou texto (não upload de arquivo)
const WEB_TYPES = [
    { value: 'TEXT', label: 'Texto Livre' },
    { value: 'URL', label: 'Website / URL' },
    { value: 'YOUTUBE', label: 'YouTube (transcrição automática)' },
    { value: 'GITHUB', label: 'Repositório GitHub / GitLab' },
    { value: 'HTML', label: 'Arquivo HTML (colar código)' },
];

function autoDetectSourceType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        pdf: 'PDF', doc: 'DOCX', docx: 'DOCX',
        xls: 'XLSX', xlsx: 'XLSX', ppt: 'PPTX', pptx: 'PPTX', epub: 'EPUB',
        txt: 'TXT', md: 'MD', mdx: 'MD', markdown: 'MD', rtf: 'RTF',
        csv: 'CSV', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML',
        html: 'HTML', htm: 'HTML',
        js: 'CODE', ts: 'CODE', jsx: 'CODE', tsx: 'CODE', py: 'CODE',
        java: 'CODE', go: 'CODE', rb: 'CODE', php: 'CODE', cs: 'CODE',
        cpp: 'CODE', c: 'CODE', rs: 'CODE', swift: 'CODE', kt: 'CODE',
        sh: 'CODE', sql: 'CODE',
        mp3: 'AUDIO', wav: 'AUDIO', mp4: 'AUDIO', ogg: 'AUDIO', webm: 'AUDIO', m4a: 'AUDIO',
    };
    return map[ext] || 'TEXT';
}

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

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBases = async () => {
        try {
            setLoading(true);
            const [data, embProviders] = await Promise.all([
                AIKnowledgeService.findAllBases(),
                AIAgentsService.getEmbeddingProviders().catch((e) => {
                    console.error('Falha ao buscar Embedding Providers na Knowledge Page:', e);
                    // Fallback de segurança para garantir que o "Nativo" esteja sempre disponível no UI
                    return [{
                        id: 'native',
                        name: 'Nativo (built-in CPU)',
                        models: [
                            { id: 'Xenova/all-MiniLM-L6-v2', name: 'all-MiniLM-L6-v2 (Padrão)', dimensions: 384 },
                            { id: 'Xenova/bge-micro-v2', name: 'bge-micro-v2 (Rápido)', dimensions: 384 }
                        ]
                    }];
                }),
            ]);
            setBases(data);
            setEmbeddingProviders(embProviders);
        } catch (error) {
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
            toast.success('Base de conhecimento criada com sucesso');
        } catch (error) {
            console.error('Erro ao salvar base:', error);
            toast.error('Erro ao criar base de conhecimento');
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
                // Upload todos os arquivos selecionados (em paralelo)
                await Promise.all(uploadFiles.map(file => AIKnowledgeService.uploadDocument(selectedBase.id, file)));
            } else {
                await AIKnowledgeService.addDocument(selectedBase.id, {
                    title: newDoc.title,
                    sourceType: newDoc.sourceType,
                    rawContent: newDoc.rawContent,
                    contentUrl: newDoc.contentUrl,
                });
            }

            setIsDocModalOpen(false);
            fetchDocuments(selectedBase.id);
            setUploadFiles([]);
            setNewDoc({ title: '', sourceType: 'TEXT', rawContent: '' });
            toast.success(docMode === 'files' ? `${uploadFiles.length} arquivo(s) enviado(s) para processamento` : 'Conhecimento adicionado para processamento');
        } catch (error) {
            console.error('Erro ao adicionar documento:', error);
            toast.error('Erro ao adicionar conhecimento');
        } finally {
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
            cancel: { label: 'Cancelar', onClick: () => { } },
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
            cancel: { label: 'Cancelar', onClick: () => { } },
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
            // Reset input para permitir re-seleção do mesmo arquivo
            e.target.value = '';
        }
    };

    if (isBaseModalOpen) {
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
                                onClick={() => setIsBaseModalOpen(false)}
                                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                            >
                                <ChevronLeft size={16} /> Voltar
                            </button>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                                Criar <span className="text-primary italic">Base Cognitiva</span>
                            </h3>
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSaveBase} className="space-y-6 max-w-2xl mx-auto w-full">
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Base</label>
                        <input required value={currentBase?.name} onChange={e => setCurrentBase({ ...currentBase, name: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Descrição</label>
                        <input value={currentBase?.description} onChange={e => setCurrentBase({ ...currentBase, description: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm outline-none" />
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

                                    // Fallback se o provider não tiver modelos carregados (ex: nativo em erro de API)
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
                        <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Sincronizar Base
                        </button>
                    </div>
                </form>
            </motion.div>
        );
    }

    if (isDocModalOpen) {
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
                            <FileText className="h-6 w-6 md:h-8 md:w-8" />
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => setIsDocModalOpen(false)}
                                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                            >
                                <ChevronLeft size={16} /> Voltar para Base
                            </button>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                                Inserir <span className="text-primary italic">Conhecimento</span>
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto w-full">
                    {/* Tab switcher */}
                    <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setDocMode('files')}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${docMode === 'files' ? 'bg-white dark:bg-primary text-primary dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                        >
                            Arquivos
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocMode('web')}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${docMode === 'web' ? 'bg-white dark:bg-primary text-primary dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
                        >
                            Web / Texto
                        </button>
                    </div>

                    <form onSubmit={handleAddDocument} className="space-y-6">
                        {docMode === 'files' ? (
                            <>
                                {/* Zona de upload — aceita todos os tipos, múltiplos arquivos */}
                                <label
                                    htmlFor="kb-file-upload"
                                    className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all group"
                                >
                                    <input
                                        type="file"
                                        id="kb-file-upload"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept={ALL_FILE_ACCEPT}
                                        multiple
                                        className="hidden"
                                    />
                                    <div className="h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <UploadCloud className="text-primary" size={28} />
                                    </div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter text-center">
                                        Clique para selecionar arquivos
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic text-center">
                                        PDF, Word, Excel, PowerPoint, TXT, CSV, JSON, Áudio e mais · Múltiplos arquivos · Max 50MB cada
                                    </p>
                                </label>

                                {/* Lista de arquivos selecionados */}
                                {uploadFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{uploadFiles.length} arquivo{uploadFiles.length > 1 ? 's' : ''} selecionado{uploadFiles.length > 1 ? 's' : ''}</p>
                                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                            {uploadFiles.map((file, idx) => {
                                                const detectedType = autoDetectSourceType(file.name);
                                                const meta = SOURCE_TYPE_META[detectedType] || SOURCE_TYPE_META.TEXT;
                                                const Icon = meta.icon;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                                                        <div className={`p-2 rounded-xl ${meta.color} flex-shrink-0`}><Icon size={14} /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{file.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{meta.label} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                                                            className="p-1 hover:text-rose-500 transition-all flex-shrink-0"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Tipo de fonte (apenas URL/texto) */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo de Fonte</label>
                                    <select
                                        value={newDoc.sourceType}
                                        onChange={e => setNewDoc({ ...newDoc, sourceType: e.target.value, rawContent: '', contentUrl: '' })}
                                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm"
                                    >
                                        {WEB_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Título */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome / Identificação</label>
                                    <input
                                        required
                                        value={newDoc.title}
                                        onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                                        placeholder="Ex: FAQ de Suporte, Site Institucional..."
                                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm"
                                    />
                                </div>

                                {/* Input de conteúdo conforme tipo */}
                                {newDoc.sourceType === 'TEXT' || newDoc.sourceType === 'HTML' ? (
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {newDoc.sourceType === 'HTML' ? 'Código HTML' : 'Conteúdo'}
                                        </label>
                                        <textarea
                                            required
                                            value={newDoc.rawContent}
                                            onChange={e => setNewDoc({ ...newDoc, rawContent: e.target.value })}
                                            className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-medium text-sm h-48 resize-none"
                                            placeholder={newDoc.sourceType === 'HTML' ? '<html>...</html>' : 'Cole aqui o conteúdo que a IA deve aprender...'}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            {newDoc.sourceType === 'YOUTUBE' ? 'URL do YouTube' : newDoc.sourceType === 'GITHUB' ? 'URL do Repositório' : 'URL'}
                                        </label>
                                        <input
                                            required
                                            value={newDoc.contentUrl}
                                            onChange={e => setNewDoc({ ...newDoc, contentUrl: e.target.value })}
                                            placeholder={
                                                newDoc.sourceType === 'YOUTUBE' ? 'https://youtube.com/watch?v=...' :
                                                    newDoc.sourceType === 'GITHUB' ? 'https://github.com/owner/repo' :
                                                        'https://...'
                                            }
                                            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-sm"
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                            <button
                                disabled={
                                    submitting ||
                                    (docMode === 'files' && uploadFiles.length === 0) ||
                                    (docMode === 'web' && !newDoc.title) ||
                                    (docMode === 'web' && URL_INPUT_TYPES.has(newDoc.sourceType) && !newDoc.contentUrl) ||
                                    (docMode === 'web' && (newDoc.sourceType === 'TEXT' || newDoc.sourceType === 'HTML') && !newDoc.rawContent)
                                }
                                type="submit"
                                className="w-full py-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                {docMode === 'files'
                                    ? (uploadFiles.length > 1 ? `Inserir ${uploadFiles.length} Arquivos` : 'Inserir Arquivo')
                                    : 'Inserir Conhecimento'}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`Reprocessar todos os documentos da base "${selectedBase.name}"?\n\nIsso vai regerar todos os embeddings. Documentos com provider inválido serão migrados para o embedding nativo (local).`)) return;
                                            try {
                                                const result = await AIKnowledgeService.reprocessBase(selectedBase.id);
                                                toast.success(result.message);
                                                setDocuments(prev => prev.map(d => ({ ...d, status: 'PENDING' as const })));
                                            } catch {
                                                toast.error('Erro ao reprocessar a base');
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
                                                                        } catch (error) {
                                                                            console.error('Erro ao reprocessar documento:', error);
                                                                            toast.error('Erro ao reprocessar documento');
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
                        </motion.div>
                    )}
                </div>
            </div>

        </div>
    );
}
