export interface SuspendData {
    eventName: string;
    timeoutAt?: Date;
    correlationKey?: string;
}

export interface ActionResult {
    success: boolean;
    error?: string;
    data?: any;

    status?: 'suspended' | 'delayed';
    nextDelay?: number;
    suspendData?: SuspendData;
}

export interface WorkflowContext {
    workflowId: string;
    executionId: string;
    companyId: string;
    entityType: string;
    entityId: string;
    currentNodeId: string;
    payload: any;
    currentPayload?: any; // Adicionado para suportar payloads dinâmicos em branches
    variables?: Record<string, any>;
    correlationId?: string;
}

export interface ActionExecutor {
    execute(
        context: WorkflowContext,
        params?: any
    ): Promise<ActionResult>;
}
