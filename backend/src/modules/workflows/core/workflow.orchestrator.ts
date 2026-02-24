import { Injectable, Logger } from '@nestjs/common';
import { ActionRegistry } from './action.registry';
import { WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../types/workflow-graph.types';
import { WorkflowException } from '../exceptions/workflow.exception';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class WorkflowOrchestrator {
    private readonly logger = new Logger(WorkflowOrchestrator.name);

    constructor(
        private readonly actionRegistry: ActionRegistry,
        private readonly prisma: PrismaService
    ) { }

    async executeStep(
        graph: WorkflowGraph,
        currentNodeId: string,
        context: WorkflowContext,
        attempt: number = 1
    ): Promise<{
        nextNodeId?: string;
        status: 'completed' | 'failed' | 'delayed' | 'waiting' | 'retry' | 'waiting_event';
        delay?: number;
        suspendData?: { eventName: string; timeoutAt?: Date; correlationKey?: string }
    }> {

        const node = graph.nodes.find(n => n.id === currentNodeId);
        if (!node) {
            throw new WorkflowException(`Node ${currentNodeId} not found in graph`, 'NODE_NOT_FOUND');
        }

        this.logger.log(`Executing node ${node.id} type=${node.type} attempt=${attempt}`);
        const startTime = Date.now();

        try {
            // 1. Determinar o tipo de ação (registry key)
            const registryKey = (node.type === 'action' ? node.data['actionType'] : node.type) as string;

            // 2. Atalho para nós 'end'
            if (node.type === 'end') {
                return { status: 'completed', nextNodeId: undefined };
            }

            // 3. Obter executor
            const executor = this.actionRegistry.get(registryKey);
            if (!executor) {
                this.logger.warn(`No executor found for node ${node.id} type ${node.type} (${registryKey}). Skipping execution.`);
                // Segue adiante sem executar nada, apenas calculando nextNode
                const nextNodeId = this.getNextNodeId(graph, node, { success: true, data: {} } as ActionResult);
                return { status: 'completed', nextNodeId };
            }

            // 4. Executar lógica com Timeout
            const timeoutMs = node.config?.timeoutMs || 30000;

            const actionPromise = executor.execute(context, node.data['params'] || node.data);
            const timeoutPromise = new Promise<ActionResult>((_, reject) =>
                setTimeout(() => reject(new Error('Action timed out')), timeoutMs)
            );

            const actionResult = await Promise.race([actionPromise, timeoutPromise])
                .catch(err => ({ success: false, error: err.message } as ActionResult));

            // Métricas
            const duration = Date.now() - startTime;
            await this.updateMetrics(context.workflowId, node.id, registryKey, actionResult.success ? 'completed' : 'failed', duration);

            if (!actionResult.success) {
                // Fallback Logic
                if (node.config?.onFailure) {
                    this.logger.warn(`Node ${node.id} failed. Switching to fallback: ${node.config.onFailure}`);
                    return { status: 'completed', nextNodeId: node.config.onFailure };
                }
                throw new Error(actionResult.error || 'Action failed');
            }

            // 5. Tratar Resultados Especiais (Suspended, Delayed)
            if (actionResult.status === 'suspended' && actionResult.suspendData) {
                this.logger.log(`Workflow suspended at ${node.id} for event: ${actionResult.suspendData.eventName}`);
                return {
                    status: 'waiting_event',
                    nextNodeId: this.getNextNodeId(graph, node, actionResult),
                    suspendData: actionResult.suspendData
                };
            }

            if (actionResult.status === 'delayed' && actionResult.nextDelay) {
                return {
                    status: 'delayed',
                    delay: actionResult.nextDelay,
                    nextNodeId: this.getNextNodeId(graph, node, actionResult)
                };
            }

            // 6. Sucesso Padrão
            const nextNodeId = this.getNextNodeId(graph, node, actionResult);
            return { status: 'completed', nextNodeId };

        } catch (error) {
            this.logger.warn(`Error executing node ${node.id}: ${error.message}`);

            // Metrics (Fail)
            const registryKey = (node.type === 'action' ? node.data['actionType'] : node.type) as string;
            await this.updateMetrics(context.workflowId, node.id, registryKey, 'failed', Date.now() - startTime);

            // Retry Logic
            if (node.config && node.config.retry) {
                const { attempts, backoff, delayMs } = node.config.retry;
                if (attempt < attempts) {
                    let waitTime = delayMs;
                    if (backoff === 'exponential') {
                        waitTime = delayMs * Math.pow(2, attempt - 1);
                    }
                    this.logger.log(`Scheduling retry ${attempt + 1}/${attempts} for node ${node.id}`);
                    return { status: 'retry', delay: waitTime, nextNodeId: node.id };
                }
            }

            return { status: 'failed' };
        }
    }

    private async updateMetrics(workflowId: string, nodeId: string, actionType: string, status: 'completed' | 'failed', duration: number) {
        try {
            const stats = await this.prisma.workflowActionMetric.findUnique({
                where: {
                    workflowRuleId_nodeId_actionType: {
                        workflowRuleId: workflowId,
                        nodeId: nodeId,
                        actionType: actionType,
                    },
                },
            });

            if (stats) {
                const totalExecutions = stats.totalExecutions + 1;
                const totalFailures = stats.totalFailures + (status === 'failed' ? 1 : 0);

                // Média ponderada da duração: (Média Anterior * N-1 + Nova Duração) / N
                const currentAvg = stats.averageDuration || 0;
                const newAverageDuration = ((currentAvg * (totalExecutions - 1)) + duration) / totalExecutions;

                await this.prisma.workflowActionMetric.update({
                    where: { id: stats.id },
                    data: {
                        totalExecutions,
                        totalFailures,
                        averageDuration: Math.round(newAverageDuration),
                        lastExecutedAt: new Date(),
                    },
                });
            } else {
                await this.prisma.workflowActionMetric.create({
                    data: {
                        workflowRuleId: workflowId,
                        nodeId: nodeId,
                        actionType: actionType,
                        totalExecutions: 1,
                        totalFailures: status === 'failed' ? 1 : 0,
                        averageDuration: duration,
                        lastExecutedAt: new Date(),
                    },
                });
            }
        } catch (e) {
            this.logger.error(`Failed to update metrics: ${e.message}`);
        }
    }

    public getNextNodeId(graph: WorkflowGraph, node: WorkflowNode, result: ActionResult): string | undefined {
        let edges = graph.edges.filter(e => e.source === node.id);

        // Lógica para Condition Node ou Split Traffic
        if (node.type === 'condition' || node.type === 'split_traffic') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resultData = (result.data as any)?.result;
            const handleId = String(resultData); // 'true', 'false', 'A', 'B'...

            // Tenta encontrar aresta específica do handle
            const specificEdge = edges.find(e => e.sourceHandle === handleId);
            if (specificEdge) return specificEdge.target;

            // Fallback (ex: se result for true e não tiver handle 'true', pega qualquer? Não, condition exige handle)
        }

        // Lógica Padrão (Action, Trigger, Delay...)
        // Retorna a primeira aresta encontrada (assumindo saída única por enquanto)
        if (edges.length === 0) return undefined;
        return edges[0].target;
    }

}
