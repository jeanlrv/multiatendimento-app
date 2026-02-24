'use client';

import React, {
    useCallback,
    useState,
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle,
} from 'react';

import {
    ReactFlow,
    addEdge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    type Node,
    ReactFlowProvider,
    useReactFlow,
    MarkerType
} from 'reactflow';

import 'reactflow/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import DelayNode from './nodes/DelayNode';
import SplitTrafficNode from './nodes/SplitTrafficNode';
import WaitForEventNode from './nodes/WaitForEventNode';
import EndNode from './nodes/EndNode';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowPropertiesPanel from './WorkflowPropertiesPanel';
import WorkflowSimulatorPanel from './WorkflowSimulatorPanel';
import WorkflowHistoryPanel from './WorkflowHistoryPanel';
import { Play, History as HistoryIcon } from 'lucide-react';

import { WorkflowRule, NodeData } from '../types/workflow.types';

type RFNode = Node<NodeData>;
type RFEdge = Edge;

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
    condition: ConditionNode,
    delay: DelayNode,
    split_traffic: SplitTrafficNode,
    wait_for_event: WaitForEventNode,
    end: EndNode,
};

const defaultNodes: RFNode[] = [
    {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 400, y: 100 },
        data: {
            label: 'Disparo Inicial',
            event: 'manual.trigger',
        },
    },
];

export interface WorkflowBuilderRef {
    getGraph: () => { nodes: RFNode[]; edges: RFEdge[] };
}

interface WorkflowBuilderProps {
    initialRule?: WorkflowRule | null;
}

const WorkflowBuilderContent = forwardRef<
    WorkflowBuilderRef,
    WorkflowBuilderProps
>(({ initialRule }, ref) => {

    const wrapperRef = useRef<HTMLDivElement>(null);

    const [nodes, setNodes, onNodesChange] =
        useNodesState<NodeData>([]);

    const [edges, setEdges, onEdgesChange] =
        useEdgesState([]);

    const [selectedNode, setSelectedNode] =
        useState<RFNode | null>(null);

    const [showSimulator, setShowSimulator] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const { screenToFlowPosition } = useReactFlow();

    useEffect(() => {
        if (initialRule?.nodes?.length) {
            setNodes(initialRule.nodes as RFNode[]);
            setEdges((initialRule.edges || []) as RFEdge[]);
        } else {
            setNodes(defaultNodes);
            setEdges([]);
        }
    }, [initialRule, setNodes, setEdges]);

    useImperativeHandle(ref, () => ({
        getGraph: () => ({ nodes, edges }),
    }));

    // ✅ CORREÇÃO DO ERRO AQUI
    const onConnect = useCallback(
        (connection: Connection) => {
            if (!connection.source || !connection.target) return;

            const newEdge: RFEdge = {
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle ?? null,
                targetHandle: connection.targetHandle ?? null,
                type: 'smoothstep',
                animated: true,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                },
                style: { strokeWidth: 2 },
            };

            setEdges((eds) => addEdge(newEdge, eds));
        },
        [setEdges]
    );

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const actionType = event.dataTransfer.getData('application/actionType');

            if (!type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: RFNode = {
                id: crypto.randomUUID(),
                type: type as any,
                position,
                data: {
                    label: 'Novo Bloco',
                    ...(actionType ? { actionType } : {}),
                },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    const onNodeClick = useCallback(
        (_: any, node: RFNode) => {
            setSelectedNode(node);
        },
        []
    );

    const onNodeUpdate = useCallback(
        (nodeId: string, newData: NodeData) => {
            setNodes((nds) =>
                nds.map((node) =>
                    node.id === nodeId
                        ? { ...node, data: newData }
                        : node
                )
            );
        },
        [setNodes]
    );

    const onNodeDelete = useCallback(
        (nodeId: string) => {
            setNodes((nds) =>
                nds.filter((n) => n.id !== nodeId)
            );

            setEdges((eds) =>
                eds.filter(
                    (e) =>
                        e.source !== nodeId &&
                        e.target !== nodeId
                )
            );

            setSelectedNode(null);
        },
        [setNodes, setEdges]
    );

    const onSimulateResult = useCallback((trace: any[]) => {
        // Find executed node IDs
        const executedIds = trace.map(t => t.nodeId);

        setNodes(nds => nds.map(n => {
            const step = trace.find(t => t.nodeId === n.id);
            if (step) {
                return {
                    ...n,
                    className: 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-slate-900 rounded-2xl shadow-emerald-500/50 z-50 bg-white/20',
                    data: { ...n.data, isSimulated: true, simError: step.error }
                };
            }
            return {
                ...n,
                className: 'opacity-40 grayscale transition-all duration-500', // fade out unexecuted
                data: { ...n.data, isSimulated: false }
            };
        }));

        setEdges(eds => eds.map(e => ({
            ...e,
            animated: executedIds.includes(e.source) && executedIds.includes(e.target) && !trace.find(t => t.nodeId === e.source)?.error,
            style: executedIds.includes(e.source) && executedIds.includes(e.target)
                ? { stroke: '#10b981', strokeWidth: 3 }
                : { stroke: '#cbd5e1', opacity: 0.3 }
        })));
    }, [setNodes, setEdges]);

    const onHistoryResult = useCallback((steps: any[]) => {
        // Find executed node IDs from history steps
        const executedIds = steps.map(s => s.nodeId);

        setNodes(nds => nds.map(n => {
            const step = steps.find(s => s.nodeId === n.id);
            if (step) {
                const isFailed = step.status === 'failed';
                return {
                    ...n,
                    className: `ring-4 ${isFailed ? 'ring-rose-500 shadow-rose-500/50' : 'ring-blue-500 shadow-blue-500/50'} ring-offset-2 ring-offset-slate-900 rounded-2xl z-50 bg-white/20`,
                    data: { ...n.data, isHistory: true, historyStatus: step.status }
                };
            }
            return {
                ...n,
                className: 'opacity-40 grayscale transition-all duration-500',
                data: { ...n.data, isHistory: false }
            };
        }));

        setEdges(eds => eds.map(e => {
            const isExecuted = executedIds.includes(e.source) && executedIds.includes(e.target);
            return {
                ...e,
                animated: isExecuted,
                style: isExecuted
                    ? { stroke: '#3b82f6', strokeWidth: 3 }
                    : { stroke: '#cbd5e1', opacity: 0.3 }
            };
        }));
    }, [setNodes, setEdges]);

    const clearSimulation = () => {
        setNodes(nds => nds.map(n => ({ ...n, className: '', data: { ...n.data, isSimulated: false, isHistory: false } })));
        setEdges(eds => eds.map(e => ({ ...e, animated: eds.length < 50, style: { strokeWidth: 2 } })));
    };

    return (
        <div className="
            w-full h-[750px] flex relative
            bg-gradient-to-br
            from-slate-50 to-slate-100
            dark:from-slate-900 dark:to-slate-800
            rounded-[2.5rem]
            overflow-hidden
            border border-white/10
            shadow-2xl
        ">

            <div
                className="flex-1 h-full relative"
                ref={wrapperRef}
            >

                <WorkflowToolbar />

                <div className="absolute top-6 right-6 z-40 flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (showHistory) clearSimulation();
                            setShowHistory(!showHistory);
                            setShowSimulator(false);
                        }}
                        disabled={!initialRule?.id}
                        className={`flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 ${showHistory
                            ? 'bg-blue-600 text-white shadow-blue-600/30'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-slate-200 dark:border-white/10'
                            }`}
                    >
                        <HistoryIcon size={16} />
                        {showHistory ? 'Fechar Histórico' : 'Ver Histórico'}
                    </button>

                    <button
                        onClick={() => {
                            if (showSimulator) clearSimulation();
                            setShowSimulator(!showSimulator);
                            setShowHistory(false);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl shadow-lg transition-all ${showSimulator
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                            }`}
                    >
                        <Play size={16} className={showSimulator ? 'hidden' : 'fill-current'} />
                        {showSimulator ? 'Fechar Simulador' : 'Dry Run (Simulador)'}
                    </button>
                </div>

                {showSimulator && (
                    <WorkflowSimulatorPanel
                        onClose={() => {
                            clearSimulation();
                            setShowSimulator(false);
                        }}
                        onSimulate={onSimulateResult}
                        nodes={nodes}
                        edges={edges}
                    />
                )}

                {showHistory && initialRule?.id && (
                    <WorkflowHistoryPanel
                        ruleId={initialRule.id}
                        onClose={() => {
                            clearSimulation();
                            setShowHistory(false);
                        }}
                        onSelectExecution={onHistoryResult}
                    />
                )}

                {selectedNode && !showSimulator && !showHistory && (
                    <WorkflowPropertiesPanel
                        selectedNode={selectedNode}
                        onChange={onNodeUpdate}
                        onDelete={onNodeDelete}
                        onClose={() =>
                            setSelectedNode(null)
                        }
                    />
                )}

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onNodeClick={onNodeClick}
                    fitView
                    snapToGrid
                    snapGrid={[20, 20]}
                >
                    <Background gap={20} size={1} />
                    <MiniMap pannable zoomable />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    );
});

WorkflowBuilderContent.displayName =
    'WorkflowBuilderContent';

const WorkflowBuilder = forwardRef<
    WorkflowBuilderRef,
    WorkflowBuilderProps
>((props, ref) => {
    return (
        <ReactFlowProvider>
            <WorkflowBuilderContent
                {...props}
                ref={ref}
            />
        </ReactFlowProvider>
    );
});

WorkflowBuilder.displayName =
    'WorkflowBuilder';

export default WorkflowBuilder;
