'use client';

import React, { useEffect, useState } from 'react';
import { Node } from 'reactflow';
import {
    X,
    Save,
    Trash2,
    Settings,
    PlayCircle,
    Clock,
    GitBranch,
    MessageSquare,
    Calendar,
    Mail,
    Split,
    Timer
} from 'lucide-react';
import {
    WorkflowEvent,
    WorkflowActionType,
    ScheduleStatus,
    WorkflowCondition,
    WorkflowOperator
} from '../types/workflow.types';

interface WorkflowPropertiesPanelProps {
    selectedNode: Node | null;
    onChange: (nodeId: string, data: any) => void;
    onDelete?: (nodeId: string) => void;
    onClose: () => void;
}

const EVENT_LABELS: Record<WorkflowEvent, string> = {
    'ticket.created': 'Ticket Criado',
    'ticket.updated': 'Ticket Atualizado',
    'ticket.status_changed': 'Mudança de Status',
    'ticket.sla_breached': 'SLA Quebrado (Alerta!)',
    'message.received': 'Mensagem Recebida',
    'contact.risk_high': 'Contato com Risco Alto',
    'manual.trigger': 'Disparo Manual',
    'schedule.created': 'Agendamento Criado',
    'schedule.pending': 'Agendamento Pendente',
    'schedule.confirmed': 'Agendamento Confirmado',
    'schedule.cancelled': 'Agendamento Cancelado',
    'schedule.no_show': 'Cliente Não Compareceu',
};

const ACTION_LABELS: Record<string, string> = {
    send_message: 'Enviar Mensagem',
    create_schedule: 'Criar Agendamento',
    update_schedule_status: 'Atualizar Status de Agendamento',
    send_email: 'Enviar Email',
    update_ticket: 'Atualizar Ticket',
    ai_intent: 'Análise de IA',
    http_webhook: 'Webhook HTTP',
    add_tag: 'Adicionar Tag',
    transfer_to_human: 'Transferir para Humano',
    ai_respond: 'Responder por IA',
    transfer_department: 'Transferir Departamento',
    analyze_sentiment: 'Análise de Sentimento',
};

export default function WorkflowPropertiesPanel({
    selectedNode,
    onChange,
    onDelete,
    onClose,
}: WorkflowPropertiesPanelProps) {

    const [label, setLabel] = useState('');
    const [config, setConfig] = useState<any>({});

    useEffect(() => {
        if (!selectedNode) return;

        const data = selectedNode.data as any;

        setLabel(data.label || '');

        setConfig({
            event: data.event,
            delayMs: data.delayMs,
            actionType: data.actionType,
            params: data.params || {},
            conditions: data.conditions || []
        });
    }, [selectedNode]);

    const handleSave = () => {
        if (!selectedNode) return;

        onChange(selectedNode.id, {
            ...selectedNode.data,
            label,
            ...config
        });
    };

    if (!selectedNode) return null;

    const renderIcon = () => {
        switch (selectedNode.type) {
            case 'trigger': return <PlayCircle size={16} />;
            case 'action': return <MessageSquare size={16} />;
            case 'condition': return <GitBranch size={16} />;
            case 'delay': return <Clock size={16} />;
            case 'split_traffic': return <Split size={16} />;
            case 'wait_for_event': return <Timer size={16} />;
            default: return <Settings size={16} />;
        }
    };

    return (
        <div className="
            absolute right-6 top-6 bottom-6 w-96
            bg-white dark:bg-slate-900
            rounded-3xl shadow-2xl border
            border-slate-200 dark:border-white/10
            flex flex-col z-20
        ">

            {/* HEADER */}
            <div className="p-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {renderIcon()}
                    <h3 className="text-sm font-black uppercase tracking-widest">
                        Configuração do Bloco
                    </h3>
                </div>

                <button onClick={onClose}>
                    <X size={18} />
                </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Nome */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">
                        Nome do Bloco
                    </label>
                    <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full mt-2 px-3 py-2 rounded-xl border text-sm"
                        placeholder="Ex: Enviar mensagem de boas-vindas"
                    />
                </div>

                {/* TRIGGER */}
                {selectedNode.type === 'trigger' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Evento que inicia o fluxo
                        </label>

                        <select
                            value={config.event || ''}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    event: e.target.value
                                })
                            }
                            className="w-full mt-2 px-3 py-2 rounded-xl border text-sm"
                        >
                            <option value="">Selecione um evento</option>
                            {Object.keys(EVENT_LABELS).map((ev) => (
                                <option key={ev} value={ev}>
                                    {EVENT_LABELS[ev as WorkflowEvent]}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* DELAY */}
                {selectedNode.type === 'delay' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Tempo de Espera (segundos)
                        </label>

                        <input
                            type="number"
                            value={config.delayMs ? config.delayMs / 1000 : 0}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    delayMs: Number(e.target.value) * 1000
                                })
                            }
                            className="w-full mt-2 px-3 py-2 rounded-xl border text-sm"
                        />
                    </div>
                )}

                {/* SPLIT TRAFFIC */}
                {selectedNode.type === 'split_traffic' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Porcentagem da Rota A (%)
                        </label>

                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.params?.percentageA || 50}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    params: { percentageA: Number(e.target.value) }
                                })
                            }
                            className="w-full mt-2 px-3 py-2 rounded-xl border text-sm"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">
                            A Rota B ficará com {100 - (config.params?.percentageA || 50)}% do tráfego.
                        </p>
                    </div>
                )}

                {/* CONDITION */}
                {selectedNode.type === 'condition' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Lógica de Grupo
                            </label>
                            <select
                                value={config.params?.logic || 'AND'}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        params: { ...config.params, logic: e.target.value }
                                    })
                                }
                                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold border-none"
                            >
                                <option value="AND">E (AND)</option>
                                <option value="OR">OU (OR)</option>
                            </select>
                            <button
                                onClick={() => {
                                    const newCond: WorkflowCondition = { field: '', operator: '=', value: '' };
                                    setConfig({ ...config, conditions: [...(config.conditions || []), newCond] });
                                }}
                                className="text-[10px] font-bold text-blue-500 hover:text-blue-600 px-2 py-1 bg-blue-50 dark:bg-slate-800 rounded-lg"
                            >
                                + Adicionar
                            </button>
                        </div>

                        {!config.conditions?.length ? (
                            <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                Nenhuma regra configurada.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {config.conditions.map((cond: WorkflowCondition, index: number) => (
                                    <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 relative group">
                                        <button
                                            onClick={() => {
                                                const newConds = [...config.conditions];
                                                newConds.splice(index, 1);
                                                setConfig({ ...config, conditions: newConds });
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>

                                        <input
                                            placeholder="Campo (ex: ticket.priority)"
                                            value={cond.field}
                                            onChange={(e) => {
                                                const newConds = [...config.conditions];
                                                newConds[index].field = e.target.value;
                                                setConfig({ ...config, conditions: newConds });
                                            }}
                                            className="w-full px-3 py-1.5 rounded-lg border text-xs"
                                        />

                                        <div className="flex gap-2">
                                            <select
                                                value={cond.operator}
                                                onChange={(e) => {
                                                    const newConds = [...config.conditions];
                                                    newConds[index].operator = e.target.value as WorkflowOperator;
                                                    setConfig({ ...config, conditions: newConds });
                                                }}
                                                className="w-1/3 px-2 py-1.5 rounded-lg border text-xs font-bold"
                                            >
                                                <option value="=">Igual (=)</option>
                                                <option value="!=">Diferente (!=)</option>
                                                <option value=">">Maior ({'>'})</option>
                                                <option value="<">Menor ({'<'})</option>
                                                <option value=">=">Maior/Igual ({'>='})</option>
                                                <option value="<=">Menor/Igual ({'<='})</option>
                                                <option value="contains">Contém</option>
                                            </select>

                                            <input
                                                placeholder="Valor"
                                                value={cond.value}
                                                onChange={(e) => {
                                                    const newConds = [...config.conditions];
                                                    newConds[index].value = e.target.value;
                                                    setConfig({ ...config, conditions: newConds });
                                                }}
                                                className="w-2/3 px-3 py-1.5 rounded-lg border text-xs"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500">
                            Se todas as regras forem verdadeiras, o fluxo segue pela rota "Verdadeiro". Senão, "Falso".
                        </p>
                    </div>
                )}

                {/* WAIT FOR EVENT */}
                {selectedNode.type === 'wait_for_event' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Evento a Aguardar
                            </label>

                            <input
                                placeholder="Ex: message.received"
                                value={config.params?.eventToWait || ''}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        params: { ...config.params, eventToWait: e.target.value }
                                    })
                                }
                                className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Tempo Máximo (Timeout em ms)
                            </label>

                            <input
                                type="number"
                                placeholder="Tempo limite em ms"
                                value={config.params?.timeoutMs || 30000}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        params: { ...config.params, timeoutMs: Number(e.target.value) }
                                    })
                                }
                                className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                Default: 30000ms (30 segundos). Se o evento não ocorrer, seguirá pela rota Timeout.
                            </p>
                        </div>
                    </div>
                )}

                {/* ACTION */}
                {selectedNode.type === 'action' && (
                    <div className="space-y-5">

                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Tipo de Ação
                            </label>

                            <select
                                value={config.actionType || ''}
                                onChange={(e) =>
                                    setConfig({
                                        actionType: e.target.value,
                                        params: {}
                                    })
                                }
                                className="w-full mt-2 px-3 py-2 rounded-xl border text-sm"
                            >
                                <option value="">Selecione</option>
                                {Object.keys(ACTION_LABELS).map((key) => (
                                    <option key={key} value={key}>
                                        {ACTION_LABELS[key as WorkflowActionType]}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* SEND MESSAGE */}
                        {config.actionType === 'send_message' && (
                            <textarea
                                placeholder="Digite a mensagem que será enviada..."
                                value={config.params?.message || ''}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        params: {
                                            ...config.params,
                                            message: e.target.value
                                        }
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border text-sm"
                            />
                        )}

                        {/* CREATE SCHEDULE */}
                        {config.actionType === 'create_schedule' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="ID do Usuário"
                                    value={config.params?.userId || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                userId: e.target.value
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <input
                                    placeholder="ID do Departamento"
                                    value={config.params?.departmentId || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                departmentId: e.target.value
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />
                            </div>
                        )}

                        {/* UPDATE STATUS */}
                        {config.actionType === 'update_schedule_status' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="ID do Agendamento"
                                    value={config.params?.scheduleId || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                scheduleId: e.target.value
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <select
                                    value={config.params?.status || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                status: e.target.value as ScheduleStatus
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                >
                                    <option value="">Selecione o status</option>
                                    <option value="PENDING">Pendente</option>
                                    <option value="CONFIRMED">Confirmado</option>
                                    <option value="CANCELLED">Cancelado</option>
                                    <option value="NO_SHOW">Não Compareceu</option>
                                </select>
                            </div>
                        )}

                        {/* UPDATE TICKET */}
                        {config.actionType === 'update_ticket' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        Prioridade
                                    </label>
                                    <select
                                        value={config.params?.priority || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: {
                                                    ...config.params,
                                                    priority: e.target.value || undefined
                                                }
                                            })
                                        }
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="LOW">Baixa</option>
                                        <option value="MEDIUM">Média</option>
                                        <option value="HIGH">Alta</option>
                                        <option value="CRITICAL">Crítica</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        Status
                                    </label>
                                    <select
                                        value={config.params?.status || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: {
                                                    ...config.params,
                                                    status: e.target.value || undefined
                                                }
                                            })
                                        }
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="OPEN">Aberto</option>
                                        <option value="IN_PROGRESS">Em Andamento</option>
                                        <option value="RESOLVED">Resolvido</option>
                                        <option value="CLOSED">Fechado</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        Modo
                                    </label>
                                    <select
                                        value={config.params?.mode || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: {
                                                    ...config.params,
                                                    mode: e.target.value || undefined
                                                }
                                            })
                                        }
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="AI">IA</option>
                                        <option value="HUMAN">Humano</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* AI INTENT */}
                        {config.actionType === 'ai_intent' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="ID do Agente de IA"
                                    value={config.params?.agentId || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                agentId: e.target.value
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <textarea
                                    placeholder='Prompt Template (use {{message}} para a mensagem do cliente)'
                                    value={config.params?.promptTemplate || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: {
                                                ...config.params,
                                                promptTemplate: e.target.value
                                            }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm min-h-[80px]"
                                />
                            </div>
                        )}

                        {/* SEND EMAIL */}
                        {config.actionType === 'send_email' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="Para: {{contact.email}}"
                                    value={config.params?.to || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, to: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <input
                                    placeholder="Assunto do Email"
                                    value={config.params?.subject || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, subject: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <textarea
                                    placeholder="Corpo do Email (HTML suportado)..."
                                    value={config.params?.body || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, body: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm min-h-[100px]"
                                />
                            </div>
                        )}

                        {/* ADD TAG */}
                        {config.actionType === 'add_tag' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="Nome da Tag (Ex: VIP)"
                                    value={config.params?.tagName || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, tagName: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />
                                <p className="text-[10px] text-slate-500">
                                    A tag será criada automaticamente caso não exista.
                                </p>
                            </div>
                        )}

                        {/* TRANSFER TO HUMAN */}
                        {config.actionType === 'transfer_to_human' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        ID do Departamento Destino (Opcional)
                                    </label>
                                    <input
                                        placeholder="Se vazio, mantém atual"
                                        value={config.params?.departmentId || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: { ...config.params, departmentId: e.target.value }
                                            })
                                        }
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* AI RESPOND */}
                        {config.actionType === 'ai_respond' && (
                            <div className="space-y-3">
                                <input
                                    placeholder="ID do Agente de IA"
                                    value={config.params?.agentId || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, agentId: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />

                                <textarea
                                    placeholder='Prompt Customizado (Ex: Responda de forma curta...)'
                                    value={config.params?.customPrompt || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, customPrompt: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm min-h-[80px]"
                                />

                                <input
                                    placeholder="Mensagem de Fallback (Opcional)"
                                    value={config.params?.fallbackMessage || ''}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            params: { ...config.params, fallbackMessage: e.target.value }
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border text-sm"
                                />
                            </div>
                        )}

                        {/* TRANSFER DEPARTMENT */}
                        {config.actionType === 'transfer_department' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        ID do Departamento Destino
                                    </label>
                                    <input
                                        placeholder="Obrigatório"
                                        value={config.params?.departmentId || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: { ...config.params, departmentId: e.target.value }
                                            })
                                        }
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                                        Aviso: O ticket será movido imediatamente.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ANALYZE SENTIMENT */}
                        {config.actionType === 'analyze_sentiment' && (
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                                <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Análise de Sentimento Automática</p>
                                <p className="text-[11px] text-purple-600 dark:text-purple-400">
                                    Esta ação analisa as últimas mensagens do ticket e salva o sentimento detectado (positivo, neutro ou negativo) como metadado do ticket. Nenhuma configuração adicional necessária.
                                </p>
                            </div>
                        )}

                        {/* HTTP WEBHOOK */}
                        {config.actionType === 'http_webhook' && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <select
                                        value={config.params?.method || 'POST'}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: { ...config.params, method: e.target.value }
                                            })
                                        }
                                        className="w-1/3 px-3 py-2 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>

                                    <input
                                        placeholder="URL do Webhook"
                                        value={config.params?.url || ''}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                params: { ...config.params, url: e.target.value }
                                            })
                                        }
                                        className="w-2/3 px-3 py-2 rounded-xl border text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        Headers (JSON)
                                    </label>
                                    <textarea
                                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                                        value={typeof config.params?.headers === 'object' ? JSON.stringify(config.params.headers, null, 2) : config.params?.headers || ''}
                                        onChange={(e) => {
                                            try {
                                                const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                                                setConfig({
                                                    ...config,
                                                    params: { ...config.params, headers: parsed }
                                                });
                                            } catch (err) {
                                                // If non-valid JSON while typing, just store as string
                                                setConfig({
                                                    ...config,
                                                    params: { ...config.params, headers: e.target.value }
                                                });
                                            }
                                        }}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-mono text-[11px] min-h-[60px]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">
                                        Body / Payload (JSON)
                                    </label>
                                    <textarea
                                        placeholder='{"event": "{{event}}", "ticketId": "{{ticketId}}"}'
                                        value={typeof config.params?.body === 'object' ? JSON.stringify(config.params.body, null, 2) : config.params?.body || ''}
                                        onChange={(e) => {
                                            try {
                                                const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                                                setConfig({
                                                    ...config,
                                                    params: { ...config.params, body: parsed }
                                                });
                                            } catch (err) {
                                                // If non-valid JSON while typing, just store as string
                                                setConfig({
                                                    ...config,
                                                    params: { ...config.params, body: e.target.value }
                                                });
                                            }
                                        }}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-mono text-[11px] min-h-[100px]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="p-6 border-t flex flex-col gap-3">
                <button
                    onClick={handleSave}
                    className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:scale-105 transition-all"
                >
                    Salvar Configuração
                </button>

                {onDelete && (
                    <button
                        onClick={() => onDelete(selectedNode.id)}
                        className="py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:scale-105 transition-all"
                    >
                        Excluir Bloco
                    </button>
                )}
            </div>

        </div>
    );
}
