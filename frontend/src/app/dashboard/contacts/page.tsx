"use client";

import { useState, useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Download,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Trash,
    User,
    Mail,
    Copy,
    X,
    RefreshCcw,
    Save,
    Search,
    Plus,
    Upload,
    FileText,
    CheckCircle,
    AlertCircle,
    GitMerge,
    Building2,
    Link2,
    Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { ContactsService, Contact } from "@/services/contacts";
import { api } from "@/services/api";

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchInput, setSearchInput] = useState("");
    const search = useDebounce(searchInput, 400);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [lastPage, setLastPage] = useState(1);
    const [metrics, setMetrics] = useState({ total: 0, highRisk: 0 });
    const [selected, setSelected] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [downloadingCSV, setDownloadingCSV] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [mergingContact, setMergingContact] = useState<Contact | null>(null);
    const [mergeSearch, setMergeSearch] = useState('');
    const [mergeResults, setMergeResults] = useState<Contact[]>([]);
    const [isMerging, setIsMerging] = useState(false);

    // Reseta página quando busca muda
    useEffect(() => {
        setPage(1);
    }, [search]);

    const fetchContacts = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const res = await ContactsService.findAll(search, page, signal);
            setContacts(res.data);
            setTotal(res.total);
            setLastPage(res.lastPage);
            setMetrics(res.metrics);
        } catch (err: any) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
            toast.error("Erro ao carregar contatos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchContacts(controller.signal);
        return () => controller.abort();
    }, [search, page]);

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este contato? Esta ação é irreversível.")) return;
        try {
            await ContactsService.remove(id);
            toast.success("Contato excluído com sucesso");
            if (selected?.id === id) setSelected(null);
            fetchContacts();
        } catch {
            toast.error("Erro ao excluir contato");
        }
    };

    const searchMergeContacts = async (q: string) => {
        if (q.length < 2) { setMergeResults([]); return; }
        try {
            const res = await ContactsService.findAll(q, 1);
            setMergeResults((res.data || []).filter((c: Contact) => c.id !== mergingContact?.id));
        } catch { setMergeResults([]); }
    };

    const handleMergeContact = async (targetId: string) => {
        if (!mergingContact) return;
        setIsMerging(true);
        try {
            await api.post(`/contacts/${mergingContact.id}/merge`, { targetContactId: targetId });
            toast.success('Contatos mesclados com sucesso!');
            setMergingContact(null);
            setMergeSearch('');
            setMergeResults([]);
            if (selected?.id === mergingContact.id) setSelected(null);
            fetchContacts();
        } catch { toast.error('Erro ao mesclar contatos'); }
        finally { setIsMerging(false); }
    };

    const handleDownloadCSV = async () => {
        setDownloadingCSV(true);
        try {
            const blob = await ContactsService.exportCSV();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "contatos.csv";
            a.click();
            URL.revokeObjectURL(url);
            toast.success("CSV exportado com sucesso");
        } catch {
            toast.error("Erro ao exportar CSV");
        } finally {
            setDownloadingCSV(false);
        }
    };

    if (isModalOpen) {
        return (
            <ContactModal
                contact={editingContact}
                onClose={() => setIsModalOpen(false)}
                onSuccess={(updated?: Contact) => {
                    setIsModalOpen(false);
                    fetchContacts();
                    if (updated && selected?.id === updated.id) {
                        setSelected(updated);
                    }
                }}
            />
        );
    }

    if (showImportModal) {
        return (
            <div className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl relative">
                <button
                    onClick={() => setShowImportModal(false)}
                    className="absolute top-8 right-8 p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
                >
                    <X size={20} className="text-slate-400" />
                </button>
                <div className="mb-8">
                    <button
                        onClick={() => setShowImportModal(false)}
                        className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-4"
                    >
                        <ChevronLeft size={16} /> Voltar para Lista
                    </button>
                    <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white">
                        Importação em <span className="text-primary">Massa (CSV)</span>
                    </h2>
                    <p className="text-sm font-bold text-slate-500 mt-2">
                        Faça o upload do seu arquivo para realizar cadastro e edição (upsert).
                    </p>
                </div>
                <ImportCSVModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => { setShowImportModal(false); fetchContacts(); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 p-4 md:p-8 liquid-glass rounded-[2rem] md:rounded-[3rem]">
            {/* MÉTRICAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard label="Total de Contatos" value={metrics.total} />
                <MetricCard label="Alto Risco" value={metrics.highRisk} color="text-red-500" />
                <MetricCard label="Página Atual" value={page} />
            </div>

            {/* BUSCA E AÇÕES */}
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5 md:w-4 md:h-4" />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Buscar contatos (nome, número, email)..."
                        className="w-full pl-12 pr-4 py-4 md:py-3 rounded-[1.5rem] border border-slate-200 dark:border-white/10 dark:bg-black/30 bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white font-bold"
                    />
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-3">
                    <button
                        onClick={handleDownloadCSV}
                        disabled={downloadingCSV}
                        title="Exportar"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/10 px-6 py-4 md:py-3 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all shadow-sm"
                    >
                        {downloadingCSV ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="hidden md:inline">Exportar</span>
                    </button>
                    <button
                        onClick={() => setShowImportModal(true)}
                        title="Importar"
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/10 px-6 py-4 md:py-3 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest transition-all shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden md:inline">Importar</span>
                    </button>
                    <button
                        onClick={() => { setEditingContact(null); setIsModalOpen(true); }}
                        className="flex-[2] md:flex-none bg-primary text-white px-6 py-4 md:py-3 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all w-full md:w-auto"
                    >
                        <Plus className="w-5 h-5 md:w-4 md:h-4" />
                        Novo Contato
                    </button>
                </div>
            </div>

            {/* TABELA */}
            <div className="rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100/50 dark:bg-black/40 text-slate-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th className="p-5 md:p-6 whitespace-nowrap">Cliente</th>
                                <th className="p-5 md:p-6 whitespace-nowrap">Contato</th>
                                <th className="p-5 md:p-6 text-center whitespace-nowrap">Risco (IA)</th>
                                <th className="p-5 md:p-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="p-5 md:p-6">
                                            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse w-32 mb-2" />
                                            <div className="h-3 bg-slate-100 dark:bg-white/5 rounded animate-pulse w-20" />
                                        </td>
                                        <td className="p-5 md:p-6"><div className="h-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse w-24" /></td>
                                        <td className="p-5 md:p-6 flex justify-center"><div className="h-6 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse w-16" /></td>
                                        <td className="p-5 md:p-6"></td>
                                    </tr>
                                ))
                            ) : contacts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-16 text-center text-slate-400">
                                        <User className="w-16 h-16 mx-auto mb-4 opacity-20" strokeWidth={1.5} />
                                        <p className="font-black text-slate-600 dark:text-white mb-2">Carteira Vazia</p>
                                        <p className="text-sm font-bold opacity-60">Nenhum contato encontrado na pesquisa base.</p>
                                    </td>
                                </tr>
                            ) : (
                                contacts.map((c) => (
                                    <motion.tr
                                        key={c.id}
                                        onClick={() => setSelected(c)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="cursor-pointer hover:bg-white/60 dark:hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="p-5 md:p-6">
                                            <div className="font-black text-slate-900 dark:text-white md:text-base text-sm leading-tight">{c.name}</div>
                                            <div className="text-[11px] font-bold text-slate-500 mt-1">{c.email || "Sem e-mail arquivado"}</div>
                                            {c.customer ? (
                                                <div className="flex items-center gap-1 mt-1.5">
                                                    <Building2 size={10} className="text-primary flex-shrink-0" />
                                                    <span className="text-[10px] font-black text-primary truncate max-w-[160px]">{c.customer.name}</span>
                                                </div>
                                            ) : (
                                                <div className="text-[10px] font-bold text-slate-400 mt-1.5">Sem cliente</div>
                                            )}
                                        </td>
                                        <td className="p-5 md:p-6 font-bold text-slate-700 dark:text-slate-300 md:text-sm text-xs">
                                            {c.phoneNumber}
                                        </td>
                                        <td className="p-5 md:p-6 text-center">
                                            <RiskBadge score={c.riskScore || 0} />
                                        </td>
                                        <td className="p-5 md:p-6 text-right">
                                            <div className="flex justify-end gap-1 opacity-100 xl:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingContact(c);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="p-3 bg-white dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/10 rounded-[1rem] transition-all text-blue-500 shadow-sm md:shadow-none"
                                                    title="Editar"
                                                >
                                                    <Edit3 className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMergingContact(c);
                                                        setMergeSearch('');
                                                        setMergeResults([]);
                                                    }}
                                                    className="p-3 bg-white dark:bg-black/20 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-[1rem] transition-all text-violet-500 shadow-sm md:shadow-none"
                                                    title="Mesclar contato"
                                                >
                                                    <GitMerge className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(c.id);
                                                    }}
                                                    className="p-3 bg-white dark:bg-black/20 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-[1rem] transition-all text-rose-500 shadow-sm md:shadow-none"
                                                    title="Excluir"
                                                >
                                                    <Trash className="w-4 h-4 md:w-5 md:h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PAGINAÇÃO */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-500 bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] shadow-sm">
                <span className="text-center md:text-left">
                    {loading
                        ? "Sincronizando banco..."
                        : `Página ${page} de ${lastPage} (${total} registro${total !== 1 ? "s" : ""})`
                    }
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={page <= 1 || loading}
                        onClick={() => setPage(page - 1)}
                        className="p-3 bg-white dark:bg-black/40 rounded-[1rem] disabled:opacity-30 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4" /> <span className="hidden md:inline pr-2">Anterior</span>
                    </button>
                    <button
                        disabled={page >= lastPage || loading}
                        onClick={() => setPage(page + 1)}
                        className="p-3 bg-white dark:bg-black/40 rounded-[1rem] disabled:opacity-30 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                        <span className="hidden md:inline pl-2">Próxima</span> <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {selected && (
                <ContactDrawer
                    contact={selected}
                    onClose={() => setSelected(null)}
                    onEdit={(c: Contact) => {
                        setSelected(null);
                        setEditingContact(c);
                        setIsModalOpen(true);
                    }}
                    onContactUpdate={(c: Contact) => {
                        setSelected(c);
                        fetchContacts();
                    }}
                />
            )}

            {/* Modal: Mesclar Contato */}
            {mergingContact && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setMergingContact(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <GitMerge size={16} className="text-violet-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Mesclar Contato</h2>
                            </div>
                            <button onClick={() => setMergingContact(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"><X size={14} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300">
                                Os tickets e agendamentos de <strong>{mergingContact.name}</strong> serão transferidos para o contato de destino. O contato de origem será excluído.
                            </div>
                            <input
                                value={mergeSearch}
                                onChange={e => { setMergeSearch(e.target.value); searchMergeContacts(e.target.value); }}
                                placeholder="Buscar contato de destino..."
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                            />
                            <div className="max-h-52 overflow-y-auto space-y-2">
                                {mergeResults.length === 0 && mergeSearch.length >= 2 && (
                                    <p className="text-xs text-center text-slate-400 py-4">Nenhum contato encontrado</p>
                                )}
                                {mergeResults.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleMergeContact(c.id)}
                                        disabled={isMerging}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/20 text-left transition-all border border-transparent hover:border-violet-200 dark:hover:border-violet-800 disabled:opacity-50"
                                    >
                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                            {c.name?.charAt(0) || '#'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                                            <p className="text-[11px] text-slate-400">{c.phoneNumber}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Modal de Importação CSV ──────────────────────────────────────────────────

function ImportCSVModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (f: File) => {
        if (!f.name.endsWith('.csv')) { toast.error('Apenas arquivos .csv são aceitos'); return; }
        setFile(f);
        setResult(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const handleImport = async () => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await import('@/services/api').then(m => m.api.post('/contacts/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            }));
            setResult(data);
            if (data.created > 0 || data.updated > 0) {
                toast.success(`${data.created} criados, ${data.updated} atualizados`);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Erro ao importar CSV');
        } finally {
            setUploading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full overflow-hidden"
        >
            {/* O cabeçalho e botão de voltar agora são controlados pelo componente pai (ContactsPage) */}


            <div className="p-8 space-y-5">
                {/* Drop zone */}
                {!result && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => inputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${file ? 'border-primary/60 bg-primary/5' : 'border-slate-200 dark:border-white/10 hover:border-primary/40 hover:bg-primary/3'}`}
                    >
                        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileText size={32} className="text-primary" />
                                <p className="font-black text-slate-800 dark:text-white text-sm">{file.name}</p>
                                <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Upload size={32} className="opacity-40" />
                                <p className="text-sm font-bold">Arraste o CSV aqui ou clique para selecionar</p>
                                <p className="text-[10px]">Colunas: telefone, nome, email, notas</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Resultado */}
                {result && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Criados', value: result.created, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                { label: 'Atualizados', value: result.updated, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                { label: 'Falhas', value: result.failed, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                            ].map(m => (
                                <div key={m.label} className={`${m.bg} rounded-2xl p-4 text-center`}>
                                    <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                                </div>
                            ))}
                        </div>
                        {result.errors.length > 0 && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-1 max-h-32 overflow-y-auto">
                                {result.errors.map((e, i) => (
                                    <p key={i} className="text-[10px] text-rose-500 font-medium flex items-start gap-1.5">
                                        <AlertCircle size={10} className="mt-0.5 flex-shrink-0" /> {e}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3 pt-1">
                    <button
                        onClick={onClose}
                        className="px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-500/5 hover:text-rose-500 active:scale-95 transition-all"
                    >
                        {result ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!result ? (
                        <button
                            onClick={handleImport}
                            disabled={!file || uploading}
                            className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {uploading ? <RefreshCcw className="animate-spin h-4 w-4" /> : <><Upload size={14} /> Importar</>}
                        </button>
                    ) : (
                        <button
                            onClick={onSuccess}
                            className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <CheckCircle size={14} /> Concluir
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function MetricCard({ label, value, color = "text-primary" }: { label: string; value: number; color?: string }) {
    return (
        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <p className="text-xs uppercase opacity-50 font-bold tracking-widest">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
        </div>
    );
}

function RiskBadge({ score }: { score: number }) {
    let color = "bg-green-500/20 text-green-500 border-green-500/30";
    if (score > 80) color = "bg-red-500/20 text-red-500 border-red-500/30";
    else if (score > 50) color = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";

    return (
        <span className={`${color} px-3 py-1 rounded-full text-xs font-bold border`}>
            {score}
        </span>
    );
}

function ContactDrawer({
    contact,
    onClose,
    onEdit,
    onContactUpdate,
}: {
    contact: Contact;
    onClose: () => void;
    onEdit: (c: Contact) => void;
    onContactUpdate?: (c: Contact) => void;
}) {
    const router = useRouter();
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<any[]>([]);
    const [savingCustomer, setSavingCustomer] = useState(false);

    const searchCustomers = async (q: string) => {
        if (q.length < 2) { setCustomerResults([]); return; }
        try {
            const res = await api.get('/customers', { params: { search: q, limit: 10 } });
            setCustomerResults(res.data?.data || []);
        } catch { setCustomerResults([]); }
    };

    const handleLinkCustomer = async (customerId: string) => {
        setSavingCustomer(true);
        try {
            const updated = await ContactsService.update(contact.id, { customerId });
            onContactUpdate?.(updated);
            setShowCustomerModal(false);
            setCustomerSearch('');
            setCustomerResults([]);
            toast.success('Cliente vinculado com sucesso!');
        } catch { toast.error('Erro ao vincular cliente'); }
        finally { setSavingCustomer(false); }
    };

    const handleUnlinkCustomer = async () => {
        setSavingCustomer(true);
        try {
            const updated = await ContactsService.update(contact.id, { customerId: null });
            onContactUpdate?.(updated);
            toast.success('Cliente desvinculado');
        } catch { toast.error('Erro ao desvincular cliente'); }
        finally { setSavingCustomer(false); }
    };

    return (
        <div className="fixed inset-0 flex justify-end z-[100]">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full max-w-[420px] h-full bg-white dark:bg-[#0a0a0a] p-8 shadow-2xl relative z-10 border-l border-white/10 flex flex-col"
            >
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-black">{contact.name}</h2>
                        <RiskBadge score={contact.riskScore || 0} />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onEdit(contact)}
                            className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-all"
                            title="Editar Dados"
                        >
                            <Edit3 className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    {/* Cliente Vinculado */}
                    <Section label="Cliente Vinculado">
                        {contact.customer ? (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                    {contact.customer.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{contact.customer.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                                        {contact.customer.type === 'PERSON' ? 'Pessoa' : 'Empresa'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleUnlinkCustomer}
                                    disabled={savingCustomer}
                                    className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl transition-all disabled:opacity-50"
                                    title="Desvincular cliente"
                                >
                                    <Unlink className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
                                <Building2 className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                <p className="text-sm font-bold text-slate-400 flex-1">Nenhum cliente vinculado</p>
                                <button
                                    onClick={() => { setShowCustomerModal(true); setCustomerSearch(''); setCustomerResults([]); }}
                                    className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                >
                                    <Link2 className="w-3 h-3" /> Vincular
                                </button>
                            </div>
                        )}
                    </Section>

                    <Section label="Informações de Contato">
                        <InfoItem label="Telefone" value={contact.phoneNumber} icon={MessageSquare} />
                        <InfoItem label="E-mail" value={contact.email || "—"} icon={Mail} />
                    </Section>

                    {contact.notes && (
                        <Section label="Notas">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                                    {contact.notes}
                                </p>
                            </div>
                        </Section>
                    )}

                    {contact.information && (
                        <Section label="Informação Técnica / Fixa">
                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 relative group">
                                <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                                    {contact.information}
                                </p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(contact.information!);
                                        toast.success("Copiado para o clipboard");
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Copiar texto"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </Section>
                    )}

                    <Section label="Detalhes do Sistema">
                        <InfoItem
                            label="Cadastrado em"
                            value={new Date(contact.createdAt).toLocaleDateString("pt-BR")}
                        />
                        <InfoItem label="ID" value={contact.id} />
                    </Section>
                </div>

                <div className="pt-6 border-t border-white/10 mt-4">
                    <button
                        onClick={() => router.push(`/dashboard/tickets?search=${contact.phoneNumber}`)}
                        className="w-full bg-primary text-white p-4 rounded-2xl font-bold hover:opacity-90 transition-opacity"
                    >
                        Iniciar Conversa
                    </button>
                </div>
            </motion.div>

            {/* Modal: Vincular Cliente */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowCustomerModal(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-primary" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Vincular Cliente</h2>
                            </div>
                            <button onClick={() => setShowCustomerModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"><X size={14} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-slate-500 font-bold">
                                Associe <strong className="text-slate-700 dark:text-slate-300">{contact.name}</strong> a um cliente existente.
                            </p>
                            <input
                                value={customerSearch}
                                onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                                placeholder="Buscar cliente por nome..."
                                autoFocus
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="max-h-52 overflow-y-auto space-y-1.5">
                                {customerResults.length === 0 && customerSearch.length >= 2 && (
                                    <p className="text-xs text-center text-slate-400 py-4">Nenhum cliente encontrado</p>
                                )}
                                {customerSearch.length < 2 && (
                                    <p className="text-xs text-center text-slate-400 py-4">Digite ao menos 2 caracteres</p>
                                )}
                                {customerResults.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleLinkCustomer(c.id)}
                                        disabled={savingCustomer}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition-all border border-transparent hover:border-primary/20 disabled:opacity-50"
                                    >
                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                            {c.name?.charAt(0) || '#'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {c.type === 'PERSON' ? 'Pessoa' : 'Empresa'} · {c.status === 'ACTIVE' ? 'Ativo' : c.status === 'LEAD' ? 'Lead' : 'Inativo'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs uppercase text-gray-500 font-bold mb-3 tracking-widest">{label}</p>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function InfoItem({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
            {Icon && <Icon className="w-4 h-4 text-primary" />}
            <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold leading-none mb-1">{label}</p>
                <p className="text-sm font-medium">{value}</p>
            </div>
        </div>
    );
}

function ContactModal({
    contact,
    onClose,
    onSuccess,
}: {
    contact: Contact | null;
    onClose: () => void;
    onSuccess: (updated?: Contact) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [duplicates, setDuplicates] = useState<{ id: string; name: string; phoneNumber: string }[]>([]);
    const [formData, setFormData] = useState({
        name: contact?.name || "",
        phoneNumber: contact?.phoneNumber || "",
        email: contact?.email || "",
        notes: contact?.notes || "",
        information: contact?.information || "",
    });

    const checkDuplicate = async (phone: string) => {
        if (!phone || phone.length < 8) { setDuplicates([]); return; }
        try {
            const params = new URLSearchParams({ phone });
            if (contact?.id) params.set('excludeId', contact.id);
            const res = await fetch(`/api/contacts/check-duplicate?${params.toString()}`, {
                headers: { Authorization: `Bearer ${document.cookie.match(/token=([^;]+)/)?.[1] || ''}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDuplicates(data.duplicates || []);
            }
        } catch { setDuplicates([]); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: any = { ...formData };
            if (!payload.email?.trim()) delete payload.email;

            let result: Contact;
            if (contact) {
                result = await ContactsService.update(contact.id, payload);
                toast.success("Contato atualizado!");
            } else {
                result = await ContactsService.create(payload);
                toast.success("Contato criado!");
            }
            onSuccess(result);
        } catch (error: any) {
            if (error?.response?.status === 409) {
                toast.error("Já existe um contato com este número de telefone.");
            } else {
                toast.error("Erro ao salvar contato. Verifique os dados.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                <div>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-2"
                    >
                        <ChevronLeft size={16} /> Voltar para Lista
                    </button>
                    <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-slate-900 dark:text-white">
                        {contact ? "Sinalizar Alteração" : "Incorporar Novo Contato"}
                    </h2>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 md:flex-none px-8 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {contact ? "SALVAR" : "CADASTRAR"}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">
                        Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white"
                        placeholder="Ex: Jean Aero"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">
                            WhatsApp / Telefone <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            onBlur={(e) => checkDuplicate(e.target.value)}
                            className={`w-full p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-black/20 border focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white ${duplicates.length > 0 ? 'border-amber-400 dark:border-amber-500' : 'border-slate-200 dark:border-white/10'}`}
                            placeholder="5511999999999"
                        />
                        {duplicates.length > 0 && (
                            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">Possíveis duplicados:</p>
                                    {duplicates.map(d => (
                                        <p key={d.id} className="text-[11px] text-amber-600 dark:text-amber-500">{d.name} · {d.phoneNumber}</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">
                            E-mail (Opcional)
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white"
                            placeholder="jean@aero.com"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">
                        Notas (Editáveis pelos Operadores)
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white min-h-[120px] resize-y"
                        placeholder="Anotações corriqueiras e rápidas sobre o contato..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 block">
                        Informações Estratégicas (Fixo e visível para a IA)
                    </label>
                    <textarea
                        value={formData.information}
                        onChange={(e) => setFormData({ ...formData, information: e.target.value })}
                        className="w-full p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/50 outline-none transition-all font-bold text-slate-900 dark:text-white min-h-[150px] resize-y"
                        placeholder="Dados de acesso estáticos, histórico permanente, observações críticas."
                    />
                </div>
            </form>
        </motion.div>
    );
}
