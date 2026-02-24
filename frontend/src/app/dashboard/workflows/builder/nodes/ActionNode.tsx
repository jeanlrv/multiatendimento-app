import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    Activity,
    MessageSquare,
    Database,
    Mail,
    CalendarPlus,
    RefreshCw,
    Webhook,
    Tag,
    UserCircle,
    Brain,
    Ticket
} from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const getIcon = (type?: string) => {
    switch (type) {
        case 'send_message': return <MessageSquare size={16} />;
        case 'create_schedule': return <CalendarPlus size={16} />;
        case 'update_schedule_status': return <RefreshCw size={16} />;
        case 'send_email': return <Mail size={16} />;
        case 'update_ticket': return <Ticket size={16} />;
        case 'ai_intent': return <Brain size={16} />;
        case 'http_webhook': return <Webhook size={16} />;
        case 'add_tag': return <Tag size={16} />;
        case 'transfer_to_human': return <UserCircle size={16} />;
        default: return <Activity size={16} />;
    }
};

const getActionLabel = (type?: string) => {
    switch (type) {
        case 'send_message': return 'Enviar Mensagem';
        case 'create_schedule': return 'Criar Agendamento';
        case 'update_schedule_status': return 'Atualizar Status';
        case 'send_email': return 'Enviar Email';
        case 'update_ticket': return 'Atualizar Ticket';
        case 'ai_intent': return 'Análise de IA';
        case 'http_webhook': return 'Integração Webhook';
        case 'add_tag': return 'Adicionar Tag';
        case 'transfer_to_human': return 'Transferir p/ Humano';
        default: return 'Ação';
    }
};

const ActionNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            relative px-4 py-4 rounded-2xl shadow-xl min-w-[220px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
            border-2 transition-all duration-300
            ${selected
                ? 'border-blue-500 shadow-blue-500/30 scale-[1.04]'
                : 'border-white/50 dark:border-white/10 hover:border-blue-500/40'}
        `}>

            {/* Badge do Tipo */}
            {data.actionType && (
                <div className="absolute -top-3 right-4 px-2 py-1 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest shadow-md">
                    {getActionLabel(data.actionType)}
                </div>
            )}

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-blue-500 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-blue-500 to-blue-600 text-white
                    shadow-lg shadow-blue-500/30
                    ${selected ? 'animate-pulse' : ''}
                `}>
                    {getIcon(data.actionType)}
                </div>

                <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Ação
                    </h3>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {data.label}
                    </p>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 !bg-blue-500 !border-2 !border-white dark:!border-slate-900"
            />

            {/* Glow Extra quando selecionado */}
            {selected && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-4 ring-blue-500/20" />
            )}
        </div>
    );
};

export default memo(ActionNode);
