import React, { useState, useEffect } from 'react';
import { History, X, Loader2, Clock, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { workflowService } from '../services/workflow.service';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WorkflowHistoryPanelProps {
    ruleId: string;
    onClose: () => void;
    onSelectExecution: (steps: any[]) => void;
}

export default function WorkflowHistoryPanel({ ruleId, onClose, onSelectExecution }: WorkflowHistoryPanelProps) {
    const [executions, setExecutions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const res = await workflowService.getExecutions({ ruleId, limit: 15 });
                setExecutions(res.items || []);
            } catch (err) {
                console.error('Failed to fetch executions', err);
            } finally {
                setLoading(false);
            }
        };

        if (ruleId) fetchHistory();
    }, [ruleId]);

    return (
        <div className="absolute top-4 right-4 w-96 max-h-[90%] overflow-y-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-transparent">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <History size={18} />
                    <h3 className="font-bold text-sm">Histórico de Execuções</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 flex-1 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        <span className="text-xs">Carregando histórico...</span>
                    </div>
                ) : executions.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs italic font-medium">
                        Nenhuma execução encontrada para este workflow.
                    </div>
                ) : (
                    executions.map((exec) => (
                        <button
                            key={exec.id}
                            onClick={() => {
                                setSelectedId(exec.id);
                                onSelectExecution(exec.steps || []);
                            }}
                            className={`w-full p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 ${selectedId === exec.id
                                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-500'
                                    : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-blue-200'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                    {exec.status === 'success' ? (
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                    ) : exec.status === 'failed' ? (
                                        <AlertCircle size={14} className="text-rose-500" />
                                    ) : (
                                        <Clock size={14} className="text-amber-500" />
                                    )}
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {exec.status === 'success' ? 'Sucesso' : exec.status === 'failed' ? 'Falha' : 'Em curso'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {exec.executedAt ? format(new Date(exec.executedAt), 'HH:mm:ss', { locale: ptBR }) : '--:--:--'}
                                </span>
                            </div>

                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Entidade: {exec.entityType} ({exec.entityId?.slice(0, 8)}...)
                            </div>

                            <div className="flex items-center justify-between mt-1">
                                <div className="text-[10px] text-slate-400">
                                    {exec.executedAt ? format(new Date(exec.executedAt), "d 'de' MMMM", { locale: ptBR }) : 'Data ignorada'}
                                </div>
                                <div className="text-[10px] font-bold text-blue-500 flex items-center gap-0.5">
                                    Ver no Grafo <Play size={8} className="fill-current" />
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
