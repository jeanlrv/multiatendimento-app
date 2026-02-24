'use client';

import React from 'react';
import {
    Play,
    MessageSquare,
    GitBranch,
    Clock,
    Database,
    Mail,
    CalendarPlus,
    RefreshCw,
    StopCircle,
    Brain,
    Ticket,
    Split,
    Timer,
    Webhook,
    Tag,
    UserCircle,
    BarChart2
} from 'lucide-react';

export default function WorkflowToolbar() {

    const onDragStart = (
        event: React.DragEvent,
        nodeType: string,
        actionType?: string
    ) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        if (actionType) {
            event.dataTransfer.setData('application/actionType', actionType);
        }
        event.dataTransfer.effectAllowed = 'move';
    };

    const Section = ({ title, children }: any) => (
        <div className="space-y-3">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                {title}
            </div>
            {children}
        </div>
    );

    const Item = ({
        icon,
        label,
        color,
        nodeType,
        actionType
    }: any) => (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, nodeType, actionType)}
            className={`
                flex items-center gap-3 p-3 rounded-2xl cursor-grab
                border transition-all duration-200
                hover:scale-[1.03] hover:shadow-lg
                ${color}
            `}
        >
            {icon}
            <span className="text-xs font-bold">
                {label}
            </span>
        </div>
    );

    return (
        <div className="absolute left-6 top-6 z-10 w-72 max-h-[calc(100vh-8rem)]">
            <div className="
                p-6 rounded-3xl
                bg-white dark:bg-slate-900
                border border-slate-200 dark:border-white/10
                shadow-2xl
                space-y-6
                max-h-[calc(100vh-10rem)] overflow-y-auto
            ">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Componentes do Fluxo
                </h3>

                <Section title="Gatilhos">
                    <Item
                        icon={<Play size={16} className="text-emerald-500" />}
                        label="Novo Gatilho"
                        nodeType="trigger"
                        color="bg-emerald-500/10 border-emerald-500/20"
                    />
                </Section>

                <Section title="Ações">
                    <Item
                        icon={<MessageSquare size={16} className="text-blue-500" />}
                        label="Enviar Mensagem"
                        nodeType="action"
                        actionType="send_message"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<CalendarPlus size={16} className="text-blue-500" />}
                        label="Criar Agendamento"
                        nodeType="action"
                        actionType="create_schedule"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<RefreshCw size={16} className="text-blue-500" />}
                        label="Atualizar Status Agendamento"
                        nodeType="action"
                        actionType="update_schedule_status"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<Mail size={16} className="text-blue-500" />}
                        label="Enviar Email"
                        nodeType="action"
                        actionType="send_email"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<Ticket size={16} className="text-blue-500" />}
                        label="Atualizar Ticket"
                        nodeType="action"
                        actionType="update_ticket"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<Brain size={16} className="text-blue-500" />}
                        label="Análise de IA"
                        nodeType="action"
                        actionType="ai_intent"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<Webhook size={16} className="text-blue-500" />}
                        label="Integração Webhook"
                        nodeType="action"
                        actionType="http_webhook"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<Tag size={16} className="text-blue-500" />}
                        label="Adicionar Tag"
                        nodeType="action"
                        actionType="add_tag"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<UserCircle size={16} className="text-blue-500" />}
                        label="Transferir p/ Humano"
                        nodeType="action"
                        actionType="transfer_to_human"
                        color="bg-blue-500/10 border-blue-500/20"
                    />

                    <Item
                        icon={<BarChart2 size={16} className="text-purple-500" />}
                        label="Análise de Sentimento"
                        nodeType="action"
                        actionType="analyze_sentiment"
                        color="bg-purple-500/10 border-purple-500/20"
                    />
                </Section>

                <Section title="Controle">
                    <Item
                        icon={<GitBranch size={16} className="text-amber-500" />}
                        label="Condição (Se / Senão)"
                        nodeType="condition"
                        color="bg-amber-500/10 border-amber-500/20"
                    />

                    <Item
                        icon={<Clock size={16} className="text-violet-500" />}
                        label="Aguardar (Delay)"
                        nodeType="delay"
                        color="bg-violet-500/10 border-violet-500/20"
                    />

                    <Item
                        icon={<Split size={16} className="text-fuchsia-500" />}
                        label="Teste A/B (Divisão)"
                        nodeType="split_traffic"
                        color="bg-fuchsia-500/10 border-fuchsia-500/20"
                    />

                    <Item
                        icon={<Timer size={16} className="text-indigo-500" />}
                        label="Aguardar Evento"
                        nodeType="wait_for_event"
                        color="bg-indigo-500/10 border-indigo-500/20"
                    />
                </Section>

                <Section title="Terminal">
                    <Item
                        icon={<StopCircle size={16} className="text-rose-500" />}
                        label="Fim do Fluxo"
                        nodeType="end"
                        color="bg-rose-500/10 border-rose-500/20"
                    />
                </Section>
            </div>
        </div>
    );
}
