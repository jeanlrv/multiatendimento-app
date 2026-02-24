"use client";

import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes = [
    {
        id: '1',
        type: 'input',
        data: { label: 'Trigger: Ticket Criado' },
        position: { x: 250, y: 5 },
        style: { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '12px', padding: '12px', border: '1px solid #10b981' }
    },
    {
        id: '2',
        data: { label: 'Condition: Risk Score > 80' },
        position: { x: 100, y: 100 },
        style: { background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderRadius: '12px', padding: '12px', border: '1px solid #f59e0b' }
    },
    {
        id: '3',
        data: { label: 'Action: Notify Admin' },
        position: { x: 400, y: 200 },
        style: { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '12px', padding: '12px', border: '1px solid #ef4444' }
    },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export default function WorkflowBuilder() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div className="w-full h-[600px] glass-card rounded-[2.5rem] overflow-hidden shadow-2xl relative border-white/5">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
            </ReactFlow>
        </div>
    );
}
