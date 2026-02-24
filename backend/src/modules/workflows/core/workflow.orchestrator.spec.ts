import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowOrchestrator } from './workflow.orchestrator';
import { ActionRegistry } from './action.registry';
import { PrismaService } from '../../../database/prisma.service';
import { WorkflowGraph, WorkflowNode } from '../types/workflow-graph.types';
import { WorkflowContext, ActionExecutor, ActionResult } from '../interfaces/action-executor.interface';

// Mock Action Registry
const mockActionRegistry = {
    get: jest.fn(),
};

// Mock Prisma
const mockPrismaService = {
    workflowActionMetric: {
        upsert: jest.fn(),
    },
};

// Mock Executor
const mockExecutor: ActionExecutor = {
    execute: jest.fn().mockResolvedValue({ success: true, data: { result: 'success' } }),
};

describe('WorkflowOrchestrator', () => {
    let orchestrator: WorkflowOrchestrator;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkflowOrchestrator,
                { provide: ActionRegistry, useValue: mockActionRegistry },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        orchestrator = module.get<WorkflowOrchestrator>(WorkflowOrchestrator);
        mockActionRegistry.get.mockReturnValue(mockExecutor);
    });

    it('should be defined', () => {
        expect(orchestrator).toBeDefined();
    });

    it('should execute a simple action node successfully', async () => {
        const node: WorkflowNode = {
            id: 'node1',
            type: 'action',
            position: { x: 0, y: 0 },
            data: { label: 'Test Action', actionType: 'test_action', params: {} }
        };

        const graph: WorkflowGraph = {
            nodes: [node],
            edges: [{ id: 'e1', source: 'node1', target: 'node2' }]
        };

        const context: WorkflowContext = {
            workflowId: 'wf1',
            executionId: 'exec1',
            companyId: 'company1',
            entityType: 'ticket',
            entityId: 'ticket1',
            currentNodeId: 'node1',
            payload: {},
            currentPayload: {}
        };

        const result = await orchestrator.executeStep(graph, 'node1', context);

        expect(result.status).toBe('completed');
        expect(result.nextNodeId).toBe('node2');
        expect(mockActionRegistry.get).toHaveBeenCalledWith('test_action');
    });

    it('should handle condition nodes returning true', async () => {
        const node: WorkflowNode = {
            id: 'cond1',
            type: 'condition',
            position: { x: 0, y: 0 },
            data: {
                label: 'Check Value',
                conditions: [{ field: 'value', operator: 'equals', value: 10 }]
            }
        };

        const graph: WorkflowGraph = {
            nodes: [node],
            edges: [
                { id: 'e1', source: 'cond1', target: 'nodeTrue', sourceHandle: 'true' },
                { id: 'e2', source: 'cond1', target: 'nodeFalse', sourceHandle: 'false' }
            ]
        };

        const context: WorkflowContext = {
            workflowId: 'wf1',
            executionId: 'exec1',
            companyId: 'company1',
            entityType: 'ticket',
            entityId: 'ticket1',
            currentNodeId: 'cond1',
            payload: { value: 10 },
            currentPayload: { value: 10 }
        };

        // Mock executor for condition is registered as proper action, 
        // BUT logic is inside orchestrator/action depending on implementation.
        // Wait, ConditionAction is an executor registered as 'condition'.
        // The orchestrator calls the executor.

        // We need to verify if ConditionAction returns { result: true }
        const conditionExecutorMock = {
            execute: jest.fn().mockResolvedValue({ success: true, data: { result: true } })
        };
        mockActionRegistry.get.mockReturnValue(conditionExecutorMock);

        const result = await orchestrator.executeStep(graph, 'cond1', context);

        expect(result.status).toBe('completed');
        expect(result.nextNodeId).toBe('nodeTrue');
    });

    it('should handle timeout and fallback', async () => {
        const node: WorkflowNode = {
            id: 'nodeTimeout',
            type: 'action',
            position: { x: 0, y: 0 },
            data: { label: 'Slow Action', actionType: 'slow', params: {} },
            config: {
                timeoutMs: 100, // Short timeout
                onFailure: 'fallbackNode'
            }
        };

        // Mock slow executor
        const slowExecutor = {
            execute: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 500)))
        };
        mockActionRegistry.get.mockReturnValue(slowExecutor);

        const graph: WorkflowGraph = { nodes: [node], edges: [] };
        const context: WorkflowContext = {
            workflowId: 'wf1',
            executionId: 'exec1',
            companyId: 'company1',
            entityType: 'ticket',
            entityId: 'ticket1',
            currentNodeId: 'nodeTimeout',
            payload: {},
            currentPayload: {}
        };

        const result = await orchestrator.executeStep(graph, 'nodeTimeout', context);

        expect(result.status).toBe('completed'); // Because fallback is a valid "next step"
        expect(result.nextNodeId).toBe('fallbackNode');
    });
});
