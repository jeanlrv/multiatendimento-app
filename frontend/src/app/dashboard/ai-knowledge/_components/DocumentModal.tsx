'use client';

import { motion } from 'framer-motion';
import {
    FileText, Globe, FileUp, Loader2, Zap, FileCode, UploadCloud,
    Music, Youtube, Github, FileSpreadsheet, Presentation, BookOpen,
    Braces, AlignLeft, X, ChevronLeft,
} from 'lucide-react';

export const SOURCE_TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    TEXT: { icon: AlignLeft, color: 'bg-slate-100 text-slate-600', label: 'Texto' },
    TXT: { icon: AlignLeft, color: 'bg-slate-100 text-slate-600', label: 'TXT' },
    MD: { icon: FileText, color: 'bg-purple-100 text-purple-600', label: 'Markdown' },
    HTML: { icon: Globe, color: 'bg-orange-100 text-orange-600', label: 'HTML' },
    CSV: { icon: FileSpreadsheet, color: 'bg-green-100 text-green-600', label: 'CSV' },
    JSON: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'JSON' },
    YAML: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'YAML' },
    XML: { icon: Braces, color: 'bg-yellow-100 text-yellow-600', label: 'XML' },
    XSD: { icon: FileCode, color: 'bg-amber-100 text-amber-700', label: 'XSD' },
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

export function DocTypeIcon({ sourceType, size = 20 }: { sourceType: string; size?: number }) {
    const meta = SOURCE_TYPE_META[sourceType?.toUpperCase()] || SOURCE_TYPE_META.TEXT;
    const Icon = meta.icon;
    return <div className={`p-3 rounded-xl ${meta.color}`}><Icon size={size} /></div>;
}

export const URL_INPUT_TYPES = new Set(['URL', 'YOUTUBE', 'GITHUB']);

export const ALL_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.epub,.txt,.md,.mdx,.markdown,.rtf,.csv,.json,.yaml,.yml,.xml,.xsd,.html,.htm,.js,.ts,.jsx,.tsx,.py,.java,.go,.rb,.php,.cs,.cpp,.c,.rs,.swift,.kt,.sh,.sql,.mp3,.wav,.mp4,.ogg,.webm,.m4a,.opus,.oga,.aac,.amr,.3gp,.3gpp';

export const WEB_TYPES = [
    { value: 'TEXT', label: 'Texto Livre' },
    { value: 'URL', label: 'Website / URL' },
    { value: 'YOUTUBE', label: 'YouTube (transcrição automática)' },
    { value: 'GITHUB', label: 'Repositório GitHub / GitLab' },
    { value: 'HTML', label: 'Arquivo HTML (colar código)' },
];

export function autoDetectSourceType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        pdf: 'PDF', doc: 'DOCX', docx: 'DOCX',
        xls: 'XLSX', xlsx: 'XLSX', ppt: 'PPTX', pptx: 'PPTX', epub: 'EPUB',
        txt: 'TXT', md: 'MD', mdx: 'MD', markdown: 'MD', rtf: 'RTF',
        csv: 'CSV', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', xsd: 'XSD',
        html: 'HTML', htm: 'HTML',
        js: 'CODE', ts: 'CODE', jsx: 'CODE', tsx: 'CODE', py: 'CODE',
        java: 'CODE', go: 'CODE', rb: 'CODE', php: 'CODE', cs: 'CODE',
        cpp: 'CODE', c: 'CODE', rs: 'CODE', swift: 'CODE', kt: 'CODE',
        sh: 'CODE', sql: 'CODE',
        mp3: 'AUDIO', wav: 'AUDIO', mp4: 'AUDIO', ogg: 'AUDIO', webm: 'AUDIO', m4a: 'AUDIO',
        opus: 'AUDIO', oga: 'AUDIO', aac: 'AUDIO', amr: 'AUDIO', '3gp': 'AUDIO', '3gpp': 'AUDIO',
    };
    return map[ext] || 'TEXT';
}

type NewDoc = { title: string; sourceType: string; rawContent?: string; contentUrl?: string };

type Props = {
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    submitting: boolean;
    docMode: 'files' | 'web';
    setDocMode: (mode: 'files' | 'web') => void;
    uploadFiles: File[];
    setUploadFiles: React.Dispatch<React.SetStateAction<File[]>>;
    newDoc: NewDoc;
    setNewDoc: React.Dispatch<React.SetStateAction<NewDoc>>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function DocumentModal({
    onClose, onSubmit, submitting, docMode, setDocMode,
    uploadFiles, setUploadFiles, newDoc, setNewDoc, fileInputRef, handleFileChange,
}: Props) {
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
                            onClick={onClose}
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

                <form onSubmit={onSubmit} className="space-y-6">
                    {docMode === 'files' ? (
                        <>
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
