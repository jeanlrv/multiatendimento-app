// ========================================
// IMPORTS (ReactFlow)
// ========================================

import { Node, Edge } from 'reactflow';


// ========================================
// EVENTS
// ========================================

export type WorkflowEvent =
    // ── Ticket ──────────────────────────────────────────────────────────────
    | 'ticket.created'           // Novo ticket aberto
    | 'ticket.updated'           // Ticket editado (qualquer campo)
    | 'ticket.status_changed'    // Status mudou (OPEN → IN_PROGRESS → RESOLVED etc.)
    | 'ticket.resolved'          // Ticket finalizado (alias explícito para RESOLVED)
    | 'ticket.assigned'          // Ticket atribuído a um atendente
    | 'ticket.transferred'       // Ticket transferido para outro departamento
    | 'ticket.sla_breached'      // SLA violado

    // ── Mensagem ─────────────────────────────────────────────────────────────
    | 'message.received'         // Nova mensagem do cliente

    // ── Avaliação / CSAT ─────────────────────────────────────────────────────
    | 'evaluation.created'       // Análise sentimental gerada pela IA
    | 'evaluation.negative_score'// Score sentimental abaixo do threshold da empresa
    | 'csat.received'            // Cliente respondeu à pesquisa CSAT (1-5)

    // ── Contato ──────────────────────────────────────────────────────────────
    | 'contact.risk_high'        // Score de risco do contato acima do limite

    // ── Agendamento ──────────────────────────────────────────────────────────
    | 'schedule.created'
    | 'schedule.pending'
    | 'schedule.confirmed'
    | 'schedule.cancelled'
    | 'schedule.no_show'

    // ── Manual ───────────────────────────────────────────────────────────────
    | 'manual.trigger';          // Disparo manual via UI ou API


// ========================================
// OPERATORS
// ========================================

export type WorkflowOperator =
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'contains';

export interface WorkflowCondition {
    field: string;
    operator: WorkflowOperator;
    value: any;
}


// ========================================
// ACTION TYPES
// ========================================

export type WorkflowActionType =
    // Comunicação
    | 'send_message'
    | 'send_email'
    | 'http_webhook'
    // Ticket
    | 'update_ticket'
    | 'add_tag'
    | 'transfer_to_human'
    | 'transfer_department'
    // IA
    | 'ai_intent'
    | 'ai_respond'
    | 'analyze_sentiment'
    | 'notify_managers'
    // Agendamento
    | 'create_schedule'
    | 'update_schedule_status'
    | string;


// ========================================
// SCHEDULE STATUS (FRONT SAFE)
// ========================================

export type ScheduleStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'CANCELLED'
    | 'NO_SHOW';


// ========================================
// TRIGGER (LEGACY V1)
// ========================================

export interface WorkflowTrigger {
    event: WorkflowEvent;
    conditions?: WorkflowCondition[];
}


// ========================================
// ACTION (LEGACY V1)
// ========================================

export interface WorkflowAction {
    type: WorkflowActionType;
    params?: Record<string, any>;
}


// ========================================
// EXECUTION / STATS
// ========================================

export interface WorkflowExecution {
    id: string;
    workflowRuleId: string;
    entityType: string;
    entityId: string;
    status: 'success' | 'failed' | 'partial' | 'running' | 'waiting_event' | 'delayed';
    steps: any[];
    logs: any[];
    duration?: number;
    retryCount: number;
    correlationId?: string;
    executedAt: string;
    workflowRule: {
        name: string;
    };
    currentNodeId?: string | null;
    waitingFor?: {
        eventName: string;
        timeoutAt?: string | null;
    } | null;
}

export interface WorkflowStats {
    totalExecutions: number;
    totalFailures: number;
    successRate: number;
    lastExecution: string | null;
    executionsPerDay: {
        date: string;
        executions: number;
        failures: number;
    }[];
    averageDuration: number;
    topRules: {
        name: string;
        count: number;
    }[];
    failureRate: number;
}


// ========================================
// GRAPH V2 (ALINHADO AO REACTFLOW)
// ========================================

export type NodeType =
    | 'trigger'
    | 'action'
    | 'condition'
    | 'delay'
    | 'split_traffic'
    | 'wait_for_event'
    | 'end';

export interface NodeData {
    label?: string;

    // Trigger
    event?: WorkflowEvent;

    // Action
    actionType?: WorkflowActionType;
    params?: Record<string, any>;

    // Condition
    conditions?: WorkflowCondition[];
    conditionLogic?: 'AND' | 'OR';

    // Delay
    delayMs?: number;

    [key: string]: any;
}


/**
 * Usamos os tipos do ReactFlow para nós e arestas.
 */

export type WorkflowNode = Node<NodeData>;
export type WorkflowEdge = Edge;


// ========================================
// RULE
// ========================================

export interface WorkflowRule {
    id: string;
    name: string;
    description: string;
    isActive: boolean;

    // V1 (LEGACY)
    trigger?: WorkflowTrigger;
    actions?: WorkflowAction[];

    // V2 (GRAPH)
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];

    isTemplate?: boolean;

    _count?: {
        executions: number;
    };

    runCount: number;
    priority: number;
    environment: 'PRODUCTION' | 'TEST';
    version: number;
    createdAt: string;
    updatedAt: string;
}
