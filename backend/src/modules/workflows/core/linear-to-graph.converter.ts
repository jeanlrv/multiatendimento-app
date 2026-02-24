import { Injectable } from '@nestjs/common';
import { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../types/workflow-graph.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LinearToGraphConverter {
    convert(legacyRule: any): WorkflowGraph {
        const nodes: WorkflowNode[] = [];
        const edges: WorkflowEdge[] = [];

        // Trigger Node
        const triggerId = uuidv4();
        nodes.push({
            id: triggerId,
            type: 'trigger',
            position: { x: 250, y: 50 },
            data: {
                label: legacyRule.trigger.event || 'Gatilho',
                event: legacyRule.trigger.event,
                conditions: legacyRule.trigger.conditions
            }
        });

        let previousNodeId = triggerId;
        let y = 150;

        // Actions
        if (Array.isArray(legacyRule.actions)) {
            for (const action of legacyRule.actions) {
                const nodeId = uuidv4();
                nodes.push({
                    id: nodeId,
                    type: 'action',
                    position: { x: 250, y },
                    data: {
                        label: action.type,
                        actionType: action.type,
                        params: action.params
                    }
                });

                edges.push({
                    id: uuidv4(),
                    source: previousNodeId,
                    target: nodeId
                });

                previousNodeId = nodeId;
                y += 100;
            }
        }

        // End Node
        const endId = uuidv4();
        nodes.push({
            id: endId,
            type: 'end', // Using 'end' as NodeType even if not strictly in type union yet? No, I defined 'end' in types.
            position: { x: 250, y },
            data: { label: 'Fim' }
        });

        edges.push({
            id: uuidv4(),
            source: previousNodeId,
            target: endId
        });

        return { nodes, edges };
    }
}
