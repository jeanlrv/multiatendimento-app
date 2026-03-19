export interface ActionParams {
    message?: string;
    targetDepartmentId?: string;
    targetUserId?: string;
    key?: string;
    value?: string;
    tagId?: string;
    [key: string]: any; // Payload flexível dependendo do tipo da ação
}

export interface WorkflowNodeData {
    label?: string;
    type: 'trigger' | 'condition' | 'action' | 'logic';
    subType?: string;
    actionType?: string; // SEND_MESSAGE, TRANSFER, SET_TAG, etc.
    conditionType?: string; // TIME_BASED, FIELD_MATCH, HAS_TAG, etc.
    params?: ActionParams;
}

export interface WorkflowNode {
    id: string;
    type: string; // ReactFlow node type
    position: { x: number; y: number };
    data: WorkflowNodeData;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string;
}

export interface SimulateWorkflowParams {
    workflowId: string;
    ticketId: string;
}

export interface WorkflowExecutionResult {
    success: boolean;
    logs: string[];
    finalNodeId?: string;
}
