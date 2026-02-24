// ========================================
// IMPORTS (ReactFlow)
// ========================================

import { Node, Edge } from 'reactflow';


// ========================================
// EVENTS
// ========================================

export type WorkflowEvent =
    | 'ticket.created'
    | 'ticket.updated'
    | 'message.received'
    | 'contact.risk_high'
    | 'manual.trigger'

    // Ticket Events (Épico 3)
    | 'ticket.status_changed'
    | 'ticket.sla_breached'

    // Scheduling Events
    | 'schedule.created'
    | 'schedule.pending'
    | 'schedule.confirmed'
    | 'schedule.cancelled'
    | 'schedule.no_show';


// ========================================
// OPERATORS
// ========================================

export type WorkflowOperator =
    | '>'
    | '<'
    | '>='
    | '<='
    | '='
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
    | 'send_message'
    | 'create_schedule'
    | 'update_schedule_status'
    | 'update_ticket'
    | 'ai_intent'
    | 'send_email'
    | 'http_webhook'
    | 'add_tag'
    | 'transfer_to_human'
    | 'analyze_sentiment'
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
    status: 'success' | 'failed' | 'partial';
    steps: any[];
    logs: any[];
    duration?: number;
    retryCount: number;
    correlationId?: string;
    executedAt: string;
    workflowRule: {
        name: string;
    };
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

    // Delay
    delayMs?: number;

    [key: string]: any;
}


/**
 * 🔥 CORREÇÃO DEFINITIVA:
 * Agora usamos os tipos do ReactFlow.
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
