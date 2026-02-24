export type NodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'wait_for_event' | 'end' | 'split_traffic';

export interface NodePosition {
    x: number;
    y: number;
}

export interface NodeData {
    label: string;
    [key: string]: unknown; // Allow strictly typed extensions
}

export interface WorkflowNode {
    id: string;
    type: NodeType;
    position: NodePosition;
    data: NodeData;
    // Configurações específicas de execução
    config?: {
        timeoutMs?: number;
        retry?: {
            attempts: number;
            backoff: 'fixed' | 'exponential';
            delayMs: number;
        };
        onFailure?: string; // Node ID para fallback
    };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string;
    animated?: boolean;
    label?: string;
    data?: {
        condition?: boolean | string; // Para branches (true/false ou expressão)
    };
}

export interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    viewport?: { x: number; y: number; zoom: number };
}

// Definições específicas para cada tipo de nó

export interface DelayNodeData extends NodeData {
    delayMs?: number;
    delayPath?: string; // Caminho no contexto para pegar o delay dinâmico
    delayType: 'fixed' | 'dynamic' | 'relative';
}

export interface ConditionNodeData extends NodeData {
    conditions: Array<{
        field: string;
        operator: string;
        value: unknown;
    }>;
}

export interface ActionNodeData extends NodeData {
    actionType: string; // 'send_message', 'update_ticket', etc.
    params: Record<string, unknown>;
}

export interface WaitNodeData extends NodeData {
    event: string;
    timeoutMs: number;
}

export type WorkflowEvent =
    | 'ticket.created'
    | 'ticket.updated'
    | 'message.received'
    | 'contact.risk_high'
    | 'manual.trigger'
    | 'schedule.created'
    | 'schedule.pending'
    | 'schedule.confirmed'
    | 'schedule.cancelled'
    | 'schedule.no_show';
