import { Node, Edge } from 'reactflow';
import { WorkflowNode as FEWorkflowNode, WorkflowEdge as FEWorkflowEdge } from '../types/workflow.types';

// Using FE types for now to avoid cross-project import issues if monorepo setup is tricky
// Ideally we share types, but for now we map.

/**
 * Converte de Graph DB (Backend) para ReactFlow (Frontend)
 */
export const toReactFlow = (nodes: FEWorkflowNode[], edges: FEWorkflowEdge[]): { nodes: Node[], edges: Edge[] } => {
    const rfNodes: Node[] = nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        // ReactFlow specific properties can be added here
        selectable: true,
        connectable: true,
    }));

    const rfEdges: Edge[] = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
        type: edge.type || 'default', // 'smoothstep', 'step', etc.
        animated: edge.type === 'smoothstep' ? false : true, // Example logic
        label: edge.label,
        data: edge.data,
    }));

    return { nodes: rfNodes, edges: rfEdges };
};

/**
 * Converte de ReactFlow (Frontend) para Graph DB (Backend)
 * Sanitiza propriedades exclusivas de UI.
 */
export const fromReactFlow = (nodes: Node[], edges: Edge[]): { nodes: FEWorkflowNode[], edges: FEWorkflowEdge[] } => {
    const dbNodes: FEWorkflowNode[] = nodes.map(node => ({
        id: node.id,
        type: node.type as any, // Cast to NodeType
        position: { x: node.position.x, y: node.position.y },
        data: node.data,
        config: node.data.config as any // Assuming config is part of data in ReactFlow for editing
    }));

    const dbEdges: FEWorkflowEdge[] = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        label: (edge.label as string) || undefined,
        data: edge.data
    }));

    return { nodes: dbNodes, edges: dbEdges };
};
