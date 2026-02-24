import React, { useState } from 'react';
import { Play, X, Loader2, Braces } from 'lucide-react';
import { workflowService } from '../services/workflow.service';

interface WorkflowSimulatorPanelProps {
    onClose: () => void;
    onSimulate: (trace: any[]) => void;
    nodes: any[];
    edges: any[];
}

export default function WorkflowSimulatorPanel({ onClose, onSimulate, nodes, edges }: WorkflowSimulatorPanelProps) {
    const [payloadStr, setPayloadStr] = useState('{\n  "contactId": "123",\n  "isUrgent": true,\n  "ticketPriority": "HIGH"\n}');
    const [event, setEvent] = useState('message.received');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<any[]>([]);

    const handleSimulate = async () => {
        try {
            setError('');
            setLoading(true);
            const payload = JSON.parse(payloadStr);

            const res = await workflowService.simulate({
                event,
                payload,
                nodes,
                edges
            });

            if (res.success && res.trace) {
                setResult(res.trace);
                onSimulate(res.trace); // Envia para o Builder pintar os nós
            } else {
                setError(res.message || 'Erro ao simular');
            }
        } catch (err: any) {
            setError(err.message || 'JSON Inválido ou erro na API');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="absolute top-4 right-4 w-96 max-h-[90%] overflow-y-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-gradient-to-r from-emerald-500/10 to-transparent">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Play size={18} className="fill-current" />
                    <h3 className="font-bold text-sm">Simulador (Dry Run)</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                    <X size={16} />
                </button>
            </div>

            <div className="p-5 flex-1 space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Evento Disparador</label>
                    <select
                        value={event}
                        onChange={(e) => setEvent(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                        <option value="message.received">Mensagem Recebida</option>
                        <option value="ticket.created">Ticket Criado</option>
                        <option value="ticket.updated">Ticket Atualizado</option>
                        <option value="ticket.status_changed">Mudança de Status do Ticket</option>
                        <option value="ticket.sla_breached">SLA Quebrado</option>
                        <option value="contact.risk_high">Contato com Risco Alto</option>
                        <option value="schedule.created">Agendamento Criado</option>
                        <option value="schedule.pending">Agendamento Pendente</option>
                        <option value="schedule.confirmed">Agendamento Confirmado</option>
                        <option value="schedule.cancelled">Agendamento Cancelado</option>
                        <option value="schedule.no_show">Cliente Não Compareceu</option>
                        <option value="manual.trigger">Gatilho Manual</option>
                    </select>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Braces size={12} /> Payload (Simulação)
                    </label>
                    <textarea
                        value={payloadStr}
                        onChange={(e) => setPayloadStr(e.target.value)}
                        className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-800 font-mono text-xs rounded-xl border-none outline-none focus:ring-2 focus:ring-emerald-500 resize-none whitespace-pre"
                        spellCheck={false}
                    />
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-100 dark:border-rose-900/50">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleSimulate}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
                    {loading ? 'Simulando...' : 'Iniciar Simulação'}
                </button>

                {result.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Rastro de Execução</h4>
                        <div className="space-y-2 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
                            {result.map((step, idx) => (
                                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white dark:border-slate-900 bg-emerald-500 text-white shadow shrink-0 z-10 text-[9px] font-bold">
                                        {idx + 1}
                                    </div>
                                    <div className={`w-[calc(100%-2rem)] p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-sm ml-2 ${idx === result.length - 1 ? 'ring-1 ring-emerald-500' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{step.label}</span>
                                            <span className="text-[9px] font-bold uppercase text-slate-400">{step.type}</span>
                                        </div>
                                        {step.result && (
                                            <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                                                ➜ {String(step.result)}
                                            </div>
                                        )}
                                        {step.error && (
                                            <div className="mt-1 text-[10px] text-rose-500 truncate">
                                                ❌ {step.error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
