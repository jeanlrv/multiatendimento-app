import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    PlayCircle,
    MessageSquare,
    Calendar,
    AlertTriangle,
    Activity
} from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const getIcon = (event?: string) => {
    switch (event) {
        case 'message.received':
            return <MessageSquare size={16} />;
        case 'schedule.created':
        case 'schedule.confirmed':
        case 'schedule.cancelled':
        case 'schedule.no_show':
            return <Calendar size={16} />;
        case 'contact.risk_high':
            return <AlertTriangle size={16} />;
        default:
            return <PlayCircle size={16} />;
    }
};

const getEventLabel = (event?: string) => {
    switch (event) {
        case 'message.received': return 'Mensagem Recebida';
        case 'ticket.created': return 'Ticket Criado';
        case 'ticket.updated': return 'Ticket Atualizado';
        case 'schedule.created': return 'Agendamento Criado';
        case 'schedule.confirmed': return 'Agendamento Confirmado';
        case 'schedule.cancelled': return 'Agendamento Cancelado';
        case 'schedule.no_show': return 'Não Compareceu';
        case 'contact.risk_high': return 'Contato Risco Alto';
        case 'manual.trigger': return 'Disparo Manual';
        default: return 'Gatilho';
    }
};

const TriggerNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            relative px-4 py-4 rounded-2xl shadow-xl min-w-[220px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
            border-2 transition-all duration-300
            ${selected
                ? 'border-emerald-500 shadow-emerald-500/30 scale-[1.04]'
                : 'border-white/50 dark:border-white/10 hover:border-emerald-500/40'}
        `}>

            {/* Badge do Evento */}
            {data.event && (
                <div className="absolute -top-3 right-4 px-2 py-1 rounded-full bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest shadow-md">
                    {getEventLabel(data.event)}
                </div>
            )}

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-emerald-500 to-emerald-600 text-white
                    shadow-lg shadow-emerald-500/30
                    ${selected ? 'animate-pulse' : ''}
                `}>
                    {getIcon(data.event)}
                </div>

                <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Gatilho
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
                className="w-3 h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900"
            />

            {/* Glow quando selecionado */}
            {selected && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-4 ring-emerald-500/20" />
            )}
        </div>
    );
};

export default memo(TriggerNode);
