'use client';

import { MonitorSmartphone, Loader2, Copy, RotateCcw, Clock, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { KBSyncLog } from '@/services/ai-knowledge';

function maskedKey(key: string) {
    return key.slice(0, 8) + '••••••••••••••••' + key.slice(-4);
}

function formatFileSize(bytes?: number) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
        .then(() => toast.success(`${label} copiado`))
        .catch(() => toast.error('Falha ao copiar'));
}

type Props = {
    webhookEnabled: boolean;
    webhookApiKey: string | null;
    webhookTogglingId: string | null;
    showApiKey: boolean;
    setShowApiKey: (v: boolean | ((prev: boolean) => boolean)) => void;
    backendPublicUrl: string;
    onToggleWebhook: () => void;
    onRotateKey: () => void;
    syncLogs: KBSyncLog[];
    showSyncLogs: boolean;
    setShowSyncLogs: (v: boolean) => void;
    loadingSyncLogs: boolean;
    onLoadSyncLogs: () => void;
};

export function WebhookIntegrationCard({
    webhookEnabled, webhookApiKey, webhookTogglingId,
    showApiKey, setShowApiKey, backendPublicUrl,
    onToggleWebhook, onRotateKey,
    syncLogs, showSyncLogs, setShowSyncLogs, loadingSyncLogs, onLoadSyncLogs,
}: Props) {
    return (
        <div className={`rounded-2xl border overflow-hidden transition-colors ${webhookEnabled ? 'border-primary/40 bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'}`}>
            {/* Header — clicável para toggle */}
            <button
                onClick={onToggleWebhook}
                disabled={!!webhookTogglingId}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${webhookEnabled ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                        <MonitorSmartphone size={16} />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Integração Local (Agente Windows)</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5 text-slate-400">Upload automático de arquivos para esta base</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {webhookTogglingId ? (
                        <Loader2 size={16} className="animate-spin text-primary" />
                    ) : (
                        <>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${webhookEnabled ? 'text-primary' : 'text-slate-400'}`}>
                                {webhookEnabled ? 'Ativo' : 'Inativo'}
                            </span>
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${webhookEnabled ? 'bg-primary' : 'bg-slate-400 dark:bg-slate-600'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${webhookEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                        </>
                    )}
                </div>
            </button>

            {webhookEnabled && (
                <div className="px-6 py-4 space-y-4">
                    {/* API Key */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">API Key</label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 truncate">
                                {webhookApiKey ? (showApiKey ? webhookApiKey : maskedKey(webhookApiKey)) : '—'}
                            </code>
                            <button
                                onClick={() => setShowApiKey(v => !v)}
                                className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                {showApiKey ? 'Ocultar' : 'Revelar'}
                            </button>
                            {webhookApiKey && (
                                <button
                                    onClick={() => copyToClipboard(webhookApiKey, 'API Key')}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-primary hover:text-white transition-all"
                                    title="Copiar API Key"
                                >
                                    <Copy size={14} />
                                </button>
                            )}
                            <button
                                onClick={onRotateKey}
                                className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all"
                                title="Rotacionar chave (invalida a atual)"
                            >
                                <RotateCcw size={14} />
                            </button>
                        </div>
                    </div>

                    {/* URL do Webhook */}
                    {webhookApiKey && (
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">URL de Upload</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-[10px] font-mono bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 truncate">
                                    {backendPublicUrl}/api/ai/knowledge/webhook/{webhookApiKey}/upload
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`${backendPublicUrl}/api/ai/knowledge/webhook/${webhookApiKey}/upload`, 'URL')}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-primary hover:text-white transition-all flex-shrink-0"
                                    title="Copiar URL"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle size={10} /> Esta chave permite gravar nesta base. Configure-a apenas no servidor do ERP.
                    </p>
                </div>
            )}

            {/* Log de Sincronização */}
            {webhookEnabled && (
                <div className="border-t border-slate-200 dark:border-white/10">
                    <button
                        onClick={showSyncLogs ? () => setShowSyncLogs(false) : onLoadSyncLogs}
                        className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Log de Sincronização</span>
                            {syncLogs.length > 0 && (
                                <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">{syncLogs.length}</span>
                            )}
                        </div>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSyncLogs ? 'rotate-180' : ''}`} />
                    </button>

                    {showSyncLogs && (
                        <div className="px-6 pb-4">
                            {loadingSyncLogs ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 size={20} className="animate-spin text-primary" />
                                </div>
                            ) : syncLogs.length === 0 ? (
                                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4">Nenhuma sincronização registrada</p>
                            ) : (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-end mb-2">
                                        <button onClick={onLoadSyncLogs} className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:opacity-70 transition-opacity">
                                            <RefreshCw size={10} /> Atualizar
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 pb-1">
                                        <span>Arquivo</span><span>Tamanho</span><span>Status</span><span>Data</span>
                                    </div>
                                    {syncLogs.map(log => (
                                        <div key={log.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 group" title={log.errorMessage || ''}>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {log.agentHostname && (
                                                    <span className="text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded flex-shrink-0">{log.agentHostname}</span>
                                                )}
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{log.filename}</span>
                                            </div>
                                            <span className="text-[9px] text-slate-400 font-mono">{formatFileSize(log.fileSize)}</span>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                                                log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600' :
                                                log.status === 'REPLACED' ? 'bg-blue-500/10 text-blue-600' :
                                                'bg-rose-500/10 text-rose-600'
                                            }`}>
                                                {log.status === 'SUCCESS' ? '✓ OK' : log.status === 'REPLACED' ? '↺ Sub.' : '✕ Erro'}
                                            </span>
                                            <span className="text-[8px] text-slate-400 font-mono flex-shrink-0">
                                                {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
