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
    Split,
    Timer,
} from 'lucide-react';
import {
    WorkflowEvent,
    WorkflowActionType,
    ScheduleStatus,
    WorkflowCondition,
    WorkflowOperator
} from '../types/workflow.types';

// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE CAMPOS DO SISTEMA
// ─────────────────────────────────────────────────────────────

interface FieldMeta {
    value: string;
    label: string;
    group: string;
    /** Valores enum disponíveis para este campo (vazio = texto/número livre) */
    values?: { value: string; label: string }[];
    /** Tipo para habilitar operadores certos */
    type?: 'string' | 'number' | 'boolean' | 'enum';
}

const FIELD_CATALOG: FieldMeta[] = [
    // Ticket
    { value: 'ticket.status',          label: 'Status do Ticket',        group: 'Ticket', type: 'enum',    values: [{ value: 'OPEN', label: 'Aberto' }, { value: 'IN_PROGRESS', label: 'Em Atendimento' }, { value: 'PAUSED', label: 'Pausado' }, { value: 'RESOLVED', label: 'Finalizado' }] },
    { value: 'ticket.priority',        label: 'Prioridade',              group: 'Ticket', type: 'enum',    values: [{ value: 'LOW', label: 'Baixa' }, { value: 'MEDIUM', label: 'Média' }, { value: 'HIGH', label: 'Alta' }, { value: 'CRITICAL', label: 'Urgente' }] },
    { value: 'ticket.mode',            label: 'Modo',                    group: 'Ticket', type: 'enum',    values: [{ value: 'AI', label: 'IA' }, { value: 'HUMANO', label: 'Humano' }, { value: 'HIBRIDO', label: 'Híbrido' }] },
    { value: 'ticket.unreadMessages',  label: 'Mensagens Não Lidas',     group: 'Ticket', type: 'number'   },
    { value: 'ticket.subject',         label: 'Assunto',                 group: 'Ticket', type: 'string'   },
    { value: 'ticket.departmentId',    label: 'Departamento (ID)',       group: 'Ticket', type: 'string'   },
    { value: 'ticket.assignedUserId',  label: 'Responsável (ID)',        group: 'Ticket', type: 'string'   },
    // Contato
    { value: 'contact.name',           label: 'Nome do Contato',         group: 'Contato', type: 'string'  },
    { value: 'contact.email',          label: 'Email',                   group: 'Contato', type: 'string'  },
    { value: 'contact.phoneNumber',    label: 'Telefone',                group: 'Contato', type: 'string'  },
    { value: 'contact.riskScore',      label: 'Score de Risco (0 a 1)', group: 'Contato', type: 'number'  },
    { value: 'contact.notes',          label: 'Notas do Contato',        group: 'Contato', type: 'string'  },
    // Mensagem
    { value: 'message.content',        label: 'Conteúdo da Mensagem',    group: 'Mensagem', type: 'string' },
    { value: 'message.messageType',    label: 'Tipo de Mídia',           group: 'Mensagem', type: 'enum',  values: [{ value: 'TEXT', label: 'Texto' }, { value: 'IMAGE', label: 'Imagem' }, { value: 'AUDIO', label: 'Áudio' }, { value: 'VIDEO', label: 'Vídeo' }, { value: 'DOCUMENT', label: 'Documento' }, { value: 'STICKER', label: 'Sticker' }] },
    { value: 'message.fromMe',         label: 'Enviado por Mim?',        group: 'Mensagem', type: 'enum',  values: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }] },
    // Agendamento
    { value: 'schedule.status',        label: 'Status do Agendamento',   group: 'Agendamento', type: 'enum', values: [{ value: 'PENDING', label: 'Pendente' }, { value: 'CONFIRMED', label: 'Confirmado' }, { value: 'CANCELLED', label: 'Cancelado' }, { value: 'NO_SHOW', label: 'Não Compareceu' }] },
];

// Grupos distintos do catálogo
const FIELD_GROUPS = Array.from(new Set(FIELD_CATALOG.map(f => f.group)));

// Operadores que fazem sentido por tipo
const OPERATORS_FOR_TYPE: Record<string, WorkflowOperator[]> = {
    string:  ['=', '!=', 'contains'],
    number:  ['=', '!=', '>', '<', '>=', '<='],
    boolean: ['=', '!='],
    enum:    ['=', '!='],
};

const OPERATOR_LABELS: Record<WorkflowOperator, string> = {
    '=':        'Igual (=)',
    '!=':       'Diferente (!=)',
    '>':        'Maior (>)',
    '<':        'Menor (<)',
    '>=':       'Maior/Igual (>=)',
    '<=':       'Menor/Igual (<=)',
    'contains': 'Contém',
};

// ─────────────────────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<WorkflowEvent, string> = {
    'ticket.created':       'Ticket Criado',
    'ticket.updated':       'Ticket Atualizado',
    'ticket.status_changed':'Mudança de Status',
    'ticket.sla_breached':  'SLA Quebrado (Alerta!)',
    'message.received':     'Mensagem Recebida',
    'contact.risk_high':    'Contato com Risco Alto',
    'manual.trigger':       'Disparo Manual',
    'schedule.created':     'Agendamento Criado',
    'schedule.pending':     'Agendamento Pendente',
    'schedule.confirmed':   'Agendamento Confirmado',
    'schedule.cancelled':   'Agendamento Cancelado',
    'schedule.no_show':     'Cliente Não Compareceu',
};

const ACTION_LABELS: Record<string, string> = {
    send_message:            'Enviar Mensagem',
    create_schedule:         'Criar Agendamento',
    update_schedule_status:  'Atualizar Status de Agendamento',
    send_email:              'Enviar Email',
    update_ticket:           'Atualizar Ticket',
    ai_intent:               'Análise de Intenção (IA)',
    ai_respond:              'Responder por IA',
    http_webhook:            'Webhook HTTP',
    add_tag:                 'Adicionar Tag',
    transfer_to_human:       'Transferir para Humano',
    transfer_department:     'Transferir Departamento',
    analyze_sentiment:       'Análise de Sentimento',
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTE: Linha de Condição
// ─────────────────────────────────────────────────────────────

function ConditionRow({
    cond,
    onChange,
    onRemove,
}: {
    cond: WorkflowCondition;
    onChange: (updated: WorkflowCondition) => void;
    onRemove: () => void;
}) {
    const fieldMeta = FIELD_CATALOG.find(f => f.value === cond.field);
    const allowedOperators = fieldMeta ? OPERATORS_FOR_TYPE[fieldMeta.type || 'string'] : Object.keys(OPERATOR_LABELS) as WorkflowOperator[];

    return (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 relative group border border-slate-200 dark:border-white/10">
            {/* Botão remover */}
            <button
                type="button"
                onClick={onRemove}
                className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X size={12} />
            </button>

            {/* Seletor de campo */}
            <select
                value={cond.field}
                onChange={(e) => {
                    const newField = e.target.value;
                    const newMeta = FIELD_CATALOG.find(f => f.value === newField);
                    const defaultOp = newMeta ? OPERATORS_FOR_TYPE[newMeta.type || 'string'][0] : '=';
                    onChange({ field: newField, operator: defaultOp, value: '' });
                }}
                className="w-full px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 dark:border-slate-700"
            >
                <option value="">— Selecione um campo —</option>
                {FIELD_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                        {FIELD_CATALOG.filter(f => f.group === group).map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </optgroup>
                ))}
                {/* Campo personalizado (path manual) */}
                {cond.field && !FIELD_CATALOG.find(f => f.value === cond.field) && (
                    <option value={cond.field}>{cond.field} (personalizado)</option>
                )}
            </select>

            {/* Campo personalizado: se não encontrado no catálogo, mostra input */}
            {!fieldMeta && cond.field && (
                <input
                    value={cond.field}
                    onChange={(e) => onChange({ ...cond, field: e.target.value })}
                    placeholder="Caminho do campo (ex: ticket.subject)"
                    className="w-full px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 dark:border-slate-700"
                />
            )}
            {!cond.field && (
                <input
                    value=""
                    onChange={(e) => onChange({ ...cond, field: e.target.value })}
                    placeholder="Ou digite o caminho manualmente (ex: contact.riskScore)"
                    className="w-full px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 dark:border-slate-700 text-slate-400"
                />
            )}

            {/* Operador + Valor */}
            <div className="flex gap-2">
                <select
                    value={cond.operator}
                    onChange={(e) => onChange({ ...cond, operator: e.target.value as WorkflowOperator })}
                    className="w-2/5 px-2 py-1.5 rounded-lg border text-xs font-bold bg-white dark:bg-slate-900 dark:border-slate-700"
                >
                    {allowedOperators.map(op => (
                        <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                    ))}
                </select>

                {/* Valor: enum → select, outros → input */}
                {fieldMeta?.values && fieldMeta.values.length > 0 ? (
                    <select
                        value={cond.value}
                        onChange={(e) => onChange({ ...cond, value: e.target.value })}
                        className="flex-1 px-2 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 dark:border-slate-700"
                    >
                        <option value="">— Selecione —</option>
                        {fieldMeta.values.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        placeholder={fieldMeta?.type === 'number' ? '0' : 'Valor'}
                        type={fieldMeta?.type === 'number' ? 'number' : 'text'}
                        value={cond.value}
                        onChange={(e) => onChange({ ...cond, value: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-900 dark:border-slate-700"
                    />
                )}
            </div>

            {/* Hint de variável dinâmica */}
            {fieldMeta && (
                <p className="text-[9px] text-slate-400 font-mono">campo: {cond.field}</p>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// PAINEL PRINCIPAL
// ─────────────────────────────────────────────────────────────

interface WorkflowPropertiesPanelProps {
    selectedNode: Node | null;
    onChange: (nodeId: string, data: any) => void;
    onDelete?: (nodeId: string) => void;
    onClose: () => void;
}

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
            case 'trigger':       return <PlayCircle size={16} />;
            case 'action':        return <MessageSquare size={16} />;
            case 'condition':     return <GitBranch size={16} />;
            case 'delay':         return <Clock size={16} />;
            case 'split_traffic': return <Split size={16} />;
            case 'wait_for_event':return <Timer size={16} />;
            default:              return <Settings size={16} />;
        }
    };

    // Helper: caixa de dica de variáveis de template
    const TemplateTip = ({ fields }: { fields: string[] }) => (
        <div className="flex flex-wrap gap-1 mt-1">
            {fields.map(f => (
                <code key={f} className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400 cursor-default select-all">
                    {`{{${f}}}`}
                </code>
            ))}
        </div>
    );

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

                <button onClick={onClose} className="hover:text-rose-500 transition-colors">
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
                        className="w-full mt-2 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                        placeholder="Ex: Verificar prioridade do ticket"
                    />
                </div>

                {/* ── TRIGGER ── */}
                {selectedNode.type === 'trigger' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Evento que inicia o fluxo
                        </label>
                        <select
                            value={config.event || ''}
                            onChange={(e) => setConfig({ ...config, event: e.target.value })}
                            className="w-full mt-2 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Selecione um evento</option>
                            {Object.keys(EVENT_LABELS).map((ev) => (
                                <option key={ev} value={ev}>
                                    {EVENT_LABELS[ev as WorkflowEvent]}
                                </option>
                            ))}
                        </select>

                        {config.event && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-[10px] text-blue-700 dark:text-blue-300 space-y-1">
                                <p className="font-black uppercase tracking-widest">Variáveis disponíveis</p>
                                {config.event.startsWith('ticket') && (
                                    <TemplateTip fields={['ticketId', 'ticket.status', 'ticket.priority', 'contact.name', 'contact.phoneNumber']} />
                                )}
                                {config.event === 'message.received' && (
                                    <TemplateTip fields={['message.content', 'message.messageType', 'ticketId', 'contact.name']} />
                                )}
                                {config.event === 'contact.risk_high' && (
                                    <TemplateTip fields={['contact.name', 'contact.riskScore', 'contact.phoneNumber']} />
                                )}
                                {config.event.startsWith('schedule') && (
                                    <TemplateTip fields={['schedule.status', 'schedule.startTime', 'contact.name']} />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── DELAY ── */}
                {selectedNode.type === 'delay' && (
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Tempo de Espera
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Segundos', ms: 1000 },
                                { label: 'Minutos', ms: 60_000 },
                                { label: 'Horas', ms: 3_600_000 },
                            ].map(({ label: unit, ms }) => (
                                <button
                                    key={unit}
                                    type="button"
                                    onClick={() => setConfig({ ...config, delayMs: ms * 1 })}
                                    className="text-[9px] font-black uppercase py-1.5 px-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-primary/10 hover:text-primary transition-all"
                                >
                                    1 {unit.slice(0, -1)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                min={1}
                                value={config.delayMs ? Math.round(config.delayMs / 1000) : 30}
                                onChange={(e) => setConfig({ ...config, delayMs: Number(e.target.value) * 1000 })}
                                className="w-2/3 mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                            />
                            <span className="text-xs text-slate-500 font-bold">segundos</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            = {config.delayMs ? (config.delayMs / 60000).toFixed(1) : '0.5'} minutos
                        </p>
                    </div>
                )}

                {/* ── SPLIT TRAFFIC ── */}
                {selectedNode.type === 'split_traffic' && (
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                            Divisão de Tráfego (Rota A / Rota B)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.params?.percentageA ?? 50}
                            onChange={(e) => setConfig({ ...config, params: { percentageA: Number(e.target.value) } })}
                            className="w-full mt-3 accent-primary"
                        />
                        <div className="flex justify-between text-xs font-black mt-1">
                            <span className="text-green-600">A: {config.params?.percentageA ?? 50}%</span>
                            <span className="text-blue-600">B: {100 - (config.params?.percentageA ?? 50)}%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                            Contatos são roteados de forma determinística (mesmo contato sempre segue o mesmo caminho).
                        </p>
                    </div>
                )}

                {/* ── CONDITION ── */}
                {selectedNode.type === 'condition' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Lógica de Grupo
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={config.params?.logic || 'AND'}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, logic: e.target.value } })}
                                    className="px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold border dark:border-slate-700"
                                >
                                    <option value="AND">E (AND) — todas as regras</option>
                                    <option value="OR">OU (OR) — qualquer regra</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newCond: WorkflowCondition = { field: '', operator: '=', value: '' };
                                        setConfig({ ...config, conditions: [...(config.conditions || []), newCond] });
                                    }}
                                    className="text-[10px] font-bold text-blue-500 hover:text-blue-600 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg whitespace-nowrap"
                                >
                                    + Regra
                                </button>
                            </div>
                        </div>

                        {!config.conditions?.length ? (
                            <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                Nenhuma regra configurada. Clique em "+ Regra" para começar.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {config.conditions.map((cond: WorkflowCondition, index: number) => (
                                    <div key={index}>
                                        {index > 0 && (
                                            <p className="text-[9px] font-black text-center text-slate-400 uppercase tracking-widest my-1">
                                                {config.params?.logic === 'OR' ? '— OU —' : '— E —'}
                                            </p>
                                        )}
                                        <ConditionRow
                                            cond={cond}
                                            onChange={(updated) => {
                                                const newConds = [...config.conditions];
                                                newConds[index] = updated;
                                                setConfig({ ...config, conditions: newConds });
                                            }}
                                            onRemove={() => {
                                                const newConds = [...config.conditions];
                                                newConds.splice(index, 1);
                                                setConfig({ ...config, conditions: newConds });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-[10px] text-amber-700 dark:text-amber-300 space-y-1">
                            <p className="font-black">✓ Rota Verdadeiro  ✗ Rota Falso</p>
                            <p>Conecte diferentes nós às saídas verdes (Sim) e vermelhas (Não) do bloco de condição.</p>
                        </div>
                    </div>
                )}

                {/* ── WAIT FOR EVENT ── */}
                {selectedNode.type === 'wait_for_event' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Evento a Aguardar
                            </label>
                            <select
                                value={config.params?.eventToWait || ''}
                                onChange={(e) => setConfig({ ...config, params: { ...config.params, eventToWait: e.target.value } })}
                                className="w-full mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                            >
                                <option value="">Selecione um evento</option>
                                {Object.keys(EVENT_LABELS).map((ev) => (
                                    <option key={ev} value={ev}>{EVENT_LABELS[ev as WorkflowEvent]}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Tempo Máximo de Espera
                            </label>
                            <div className="grid grid-cols-4 gap-1 mt-2 mb-2">
                                {[
                                    { label: '5min',  ms: 300_000 },
                                    { label: '30min', ms: 1_800_000 },
                                    { label: '1h',    ms: 3_600_000 },
                                    { label: '24h',   ms: 86_400_000 },
                                ].map(({ label: l, ms }) => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => setConfig({ ...config, params: { ...config.params, timeoutMs: ms } })}
                                        className={`text-[9px] font-black py-1.5 rounded-lg transition-all ${(config.params?.timeoutMs === ms) ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary'}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    min={1}
                                    value={config.params?.timeoutMs ? Math.round(config.params.timeoutMs / 60000) : 30}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, timeoutMs: Number(e.target.value) * 60000 } })}
                                    className="w-2/3 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                />
                                <span className="text-xs text-slate-500 font-bold">minutos</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                                Se o evento não ocorrer dentro do prazo, o fluxo seguirá pela rota Timeout.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── ACTION ── */}
                {selectedNode.type === 'action' && (
                    <div className="space-y-5">

                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">
                                Tipo de Ação
                            </label>
                            <select
                                value={config.actionType || ''}
                                onChange={(e) => setConfig({ actionType: e.target.value, params: {} })}
                                className="w-full mt-2 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                            >
                                <option value="">Selecione</option>
                                <optgroup label="Comunicação">
                                    <option value="send_message">Enviar Mensagem</option>
                                    <option value="send_email">Enviar Email</option>
                                </optgroup>
                                <optgroup label="Ticket">
                                    <option value="update_ticket">Atualizar Ticket</option>
                                    <option value="add_tag">Adicionar Tag</option>
                                    <option value="transfer_to_human">Transferir para Humano</option>
                                    <option value="transfer_department">Transferir Departamento</option>
                                </optgroup>
                                <optgroup label="IA">
                                    <option value="ai_intent">Análise de Intenção (IA)</option>
                                    <option value="ai_respond">Responder por IA</option>
                                    <option value="analyze_sentiment">Análise de Sentimento</option>
                                </optgroup>
                                <optgroup label="Agendamento">
                                    <option value="create_schedule">Criar Agendamento</option>
                                    <option value="update_schedule_status">Atualizar Status de Agendamento</option>
                                </optgroup>
                                <optgroup label="Integrações">
                                    <option value="http_webhook">Webhook HTTP</option>
                                </optgroup>
                            </select>
                        </div>

                        {/* ── send_message ── */}
                        {config.actionType === 'send_message' && (
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Mensagem</label>
                                <textarea
                                    placeholder="Olá {{contact.name}}, seu ticket foi registrado!"
                                    value={config.params?.message || ''}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, message: e.target.value } })}
                                    className="w-full px-3 py-2 rounded-xl border text-sm min-h-[80px] dark:bg-slate-800 dark:border-slate-700"
                                />
                                <p className="text-[9px] text-slate-400">Variáveis disponíveis:</p>
                                <TemplateTip fields={['contact.name', 'contact.phoneNumber', 'ticket.status', 'ticket.priority']} />
                            </div>
                        )}

                        {/* ── send_email ── */}
                        {config.actionType === 'send_email' && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Para</label>
                                    <input
                                        placeholder="{{contact.email}} ou email@exemplo.com"
                                        value={config.params?.to || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, to: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Assunto</label>
                                    <input
                                        placeholder="Seu ticket foi atualizado"
                                        value={config.params?.subject || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, subject: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Corpo (HTML suportado)</label>
                                    <textarea
                                        placeholder="Olá {{contact.name}}, ..."
                                        value={config.params?.body || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, body: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm min-h-[100px] dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── update_ticket ── */}
                        {config.actionType === 'update_ticket' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Prioridade</label>
                                    <select
                                        value={config.params?.priority || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, priority: e.target.value || undefined } })}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="LOW">Baixa</option>
                                        <option value="MEDIUM">Média</option>
                                        <option value="HIGH">Alta</option>
                                        <option value="CRITICAL">Urgente</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Status</label>
                                    <select
                                        value={config.params?.status || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, status: e.target.value || undefined } })}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="OPEN">Aberto</option>
                                        <option value="IN_PROGRESS">Em Atendimento</option>
                                        <option value="PAUSED">Pausado</option>
                                        <option value="RESOLVED">Finalizado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Modo</label>
                                    <select
                                        value={config.params?.mode || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, mode: e.target.value || undefined } })}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    >
                                        <option value="">Não alterar</option>
                                        <option value="AI">IA Automático</option>
                                        <option value="HUMANO">Humano</option>
                                        <option value="HIBRIDO">Híbrido</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Responsável (opcional)</label>
                                    <input
                                        placeholder="UUID do usuário"
                                        value={config.params?.assignedUserId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, assignedUserId: e.target.value || undefined } })}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── add_tag ── */}
                        {config.actionType === 'add_tag' && (
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400">Nome da Tag</label>
                                <input
                                    placeholder="Ex: VIP, Urgente, Reclamação..."
                                    value={config.params?.tagName || ''}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, tagName: e.target.value } })}
                                    className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                />
                                <p className="text-[10px] text-slate-500">A tag é criada automaticamente se não existir.</p>
                            </div>
                        )}

                        {/* ── transfer_to_human ── */}
                        {config.actionType === 'transfer_to_human' && (
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400">ID do Departamento Destino (opcional)</label>
                                <input
                                    placeholder="Se vazio, mantém o departamento atual"
                                    value={config.params?.departmentId || ''}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, departmentId: e.target.value || undefined } })}
                                    className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                />
                                <p className="text-[10px] text-slate-400">O modo do ticket muda para Humano automaticamente.</p>
                            </div>
                        )}

                        {/* ── transfer_department ── */}
                        {config.actionType === 'transfer_department' && (
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-400">ID do Departamento Destino</label>
                                <input
                                    placeholder="Obrigatório — UUID do departamento"
                                    value={config.params?.departmentId || ''}
                                    onChange={(e) => setConfig({ ...config, params: { ...config.params, departmentId: e.target.value } })}
                                    className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                />
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                                    ⚠ O ticket é movido imediatamente para este departamento.
                                </div>
                            </div>
                        )}

                        {/* ── ai_intent ── */}
                        {config.actionType === 'ai_intent' && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Agente de IA</label>
                                    <input
                                        placeholder="UUID do agente (ver página de Agentes)"
                                        value={config.params?.agentId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, agentId: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Prompt de Intenção (opcional)</label>
                                    <textarea
                                        placeholder="Classifique a intenção do usuário em: COMPRA, SUPORTE, CANCELAMENTO, OUTRO. Responda apenas com JSON: {intent: '...'}"
                                        value={config.params?.promptTemplate || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, promptTemplate: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm min-h-[80px] dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400">Variável disponível: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono">{`{{message}}`}</code></p>
                            </div>
                        )}

                        {/* ── ai_respond ── */}
                        {config.actionType === 'ai_respond' && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Agente de IA</label>
                                    <input
                                        placeholder="UUID do agente (ver página de Agentes)"
                                        value={config.params?.agentId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, agentId: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Prompt Customizado (opcional)</label>
                                    <textarea
                                        placeholder="Responda de forma curta e amigável considerando o histórico do ticket."
                                        value={config.params?.promptTemplate || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, promptTemplate: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm min-h-[80px] dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Mensagem de Fallback (opcional)</label>
                                    <input
                                        placeholder="Em caso de falha da IA, enviar esta mensagem"
                                        value={config.params?.fallbackMessage || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, fallbackMessage: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── analyze_sentiment ── */}
                        {config.actionType === 'analyze_sentiment' && (
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
                                <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Análise de Sentimento Automática</p>
                                <p className="text-[11px] text-purple-600 dark:text-purple-400">
                                    Analisa as últimas mensagens do ticket e salva o sentimento detectado (positivo, neutro ou negativo). Nenhuma configuração necessária.
                                </p>
                            </div>
                        )}

                        {/* ── create_schedule ── */}
                        {config.actionType === 'create_schedule' && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Responsável</label>
                                    <input
                                        placeholder="UUID do usuário responsável"
                                        value={config.params?.userId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, userId: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Departamento</label>
                                    <input
                                        placeholder="UUID do departamento"
                                        value={config.params?.departmentId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, departmentId: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Data/Hora de Início</label>
                                    <input
                                        type="datetime-local"
                                        value={config.params?.startTime || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, startTime: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Data/Hora de Fim</label>
                                    <input
                                        type="datetime-local"
                                        value={config.params?.endTime || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, endTime: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Observações</label>
                                    <textarea
                                        placeholder="Agendamento criado automaticamente pelo fluxo..."
                                        value={config.params?.notes || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, notes: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── update_schedule_status ── */}
                        {config.actionType === 'update_schedule_status' && (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">ID do Agendamento</label>
                                    <input
                                        placeholder="UUID do agendamento (ou {{schedule.id}})"
                                        value={config.params?.scheduleId || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, scheduleId: e.target.value } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Novo Status</label>
                                    <select
                                        value={config.params?.status || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, status: e.target.value as ScheduleStatus } })}
                                        className="w-full px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    >
                                        <option value="">Selecione o status</option>
                                        <option value="PENDING">Pendente</option>
                                        <option value="CONFIRMED">Confirmado</option>
                                        <option value="CANCELLED">Cancelado</option>
                                        <option value="NO_SHOW">Não Compareceu</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* ── http_webhook ── */}
                        {config.actionType === 'http_webhook' && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <select
                                        value={config.params?.method || 'POST'}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, method: e.target.value } })}
                                        className="w-1/3 px-3 py-2 rounded-xl border text-sm font-bold dark:bg-slate-800 dark:border-slate-700"
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                    <input
                                        placeholder="https://..."
                                        value={config.params?.url || ''}
                                        onChange={(e) => setConfig({ ...config, params: { ...config.params, url: e.target.value } })}
                                        className="w-2/3 px-3 py-2 rounded-xl border text-sm dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Headers (JSON)</label>
                                    <textarea
                                        placeholder={'{"Authorization": "Bearer token"}'}
                                        value={typeof config.params?.headers === 'object' ? JSON.stringify(config.params.headers, null, 2) : config.params?.headers || ''}
                                        onChange={(e) => {
                                            try { setConfig({ ...config, params: { ...config.params, headers: JSON.parse(e.target.value) } }); }
                                            catch { setConfig({ ...config, params: { ...config.params, headers: e.target.value } }); }
                                        }}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-mono text-[11px] min-h-[60px] dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Body / Payload (JSON)</label>
                                    <textarea
                                        placeholder={'{"ticketId": "{{ticketId}}", "status": "{{ticket.status}}"}'}
                                        value={typeof config.params?.body === 'object' ? JSON.stringify(config.params.body, null, 2) : config.params?.body || ''}
                                        onChange={(e) => {
                                            try { setConfig({ ...config, params: { ...config.params, body: JSON.parse(e.target.value) } }); }
                                            catch { setConfig({ ...config, params: { ...config.params, body: e.target.value } }); }
                                        }}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border text-sm font-mono text-[11px] min-h-[100px] dark:bg-slate-800 dark:border-slate-700"
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
                    className="py-3 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                    <Save size={16} /> Salvar Configuração
                </button>

                {onDelete && (
                    <button
                        onClick={() => onDelete(selectedNode.id)}
                        className="py-3 bg-red-500/10 text-red-500 border border-red-200 dark:border-red-900 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} /> Excluir Bloco
                    </button>
                )}
            </div>

        </div>
    );
}
