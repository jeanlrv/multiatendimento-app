import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LockService } from './core/lock.service';
import { WorkflowOrchestrator } from './core/workflow.orchestrator';
import { WorkflowGraph } from './types/workflow-graph.types';
import { WorkflowContext } from './interfaces/action-executor.interface';
import { WorkflowsService } from './workflows.service';

@Processor('workflows')
@Injectable()
export class WorkflowsProcessor extends WorkerHost {
    private readonly logger = new Logger(WorkflowsProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly lockService: LockService,
        private readonly orchestrator: WorkflowOrchestrator,
        @Inject(forwardRef(() => WorkflowsService))
        private readonly workflowsService: WorkflowsService,
        @InjectQueue('workflows') private readonly workflowsQueue: Queue,
    ) {
        super();
    }

    async process(job: Job<any>): Promise<any> {
        if (job.name === 'check-timeouts') {
            return this.workflowsService.checkTimeouts();
        }

        const { workflowId, executionId, resumeNodeId, event, payload, companyId } = job.data;
        const isResuming = !!executionId && !!resumeNodeId;

        this.logger.log(`${isResuming ? 'Resuming' : 'Processing'} workflow ${workflowId} for company ${companyId} (event: ${event})`);

        const entityId = payload?.id || payload?.ticketId || 'unknown';
        const lockKey = `workflow-exec:${workflowId}:${entityId}`;
        let lockAcquired = false;
        let execution: any = null;

        try {
            // 1. Buscar a regra do workflow
            const rule = await this.prisma.workflowRule.findUnique({
                where: { id: workflowId },
            });

            if (!rule || !rule.isActive) {
                this.logger.warn(`Workflow ${workflowId} not found or inactive`);
                return { success: false, reason: 'inactive' };
            }

            // 2. Adquirir lock para evitar execuções simultâneas do mesmo workflow/entidade
            if (!isResuming) {
                lockAcquired = await this.lockService.acquire(lockKey, 30_000);
                if (!lockAcquired) {
                    this.logger.warn(`Workflow ${workflowId} already running for entity ${entityId} — skipping duplicate`);
                    return { success: false, reason: 'already_running' };
                }

                // Incrementar runCount
                await this.prisma.workflowRule.update({
                    where: { id: workflowId },
                    data: { runCount: { increment: 1 } }
                }).catch(err => this.logger.error(`Failed to increment runCount: ${err.message}`));
            }

            // 3. Buscar ou criar execução no banco
            if (isResuming) {
                execution = await this.prisma.workflowExecution.findUnique({ where: { id: executionId } });
                if (!execution) {
                    this.logger.error(`Execution ${executionId} not found for resumption`);
                    return { success: false, reason: 'execution_not_found' };
                }
                // Limpar status de espera
                await this.prisma.workflowExecution.update({
                    where: { id: execution.id },
                    data: { status: 'running' }
                });
            } else {
                execution = await this.prisma.workflowExecution.create({
                    data: {
                        workflowRuleId: workflowId,
                        companyId,
                        entityType: event.split('.')[0] || 'unknown',
                        entityId,
                        status: 'running',
                        steps: [],
                    },
                });
            }

            // 3. Inicializar contexto
            const graph = {
                nodes: rule.nodes as any,
                edges: rule.edges as any,
            } as WorkflowGraph;

            // Determinar nó inicial
            let currentNodeId: string;

            if (isResuming) {
                // Ao retomar, precisamos encontrar o PRÓXIMO nó a partir do nó que suspendeu
                const suspendNode = graph.nodes.find(n => n.id === resumeNodeId);
                const resultMock = { success: true, data: payload }; // Payload do evento que disparou a retomada
                currentNodeId = this.orchestrator.getNextNodeId(graph, suspendNode, resultMock);
            } else {
                const startNode = graph.nodes.find(n => n.type === 'trigger' && n.data?.event === event);
                if (!startNode) {
                    this.logger.error(`Start node not found for event ${event} in workflow ${workflowId}`);
                    return { success: false, reason: 'start_node_not_found' };
                }
                currentNodeId = startNode.id;
            }

            if (!currentNodeId) {
                this.logger.warn(`No node to execute (end of workflow or invalid state)`);
                await this.prisma.workflowExecution.update({
                    where: { id: execution.id },
                    data: { status: 'success' }
                });
                return { success: true, reason: 'completed' };
            }

            const context: WorkflowContext = {
                workflowId: rule.id,
                executionId: execution.id,
                companyId,
                entityType: execution.entityType,
                entityId: execution.entityId,
                currentNodeId: currentNodeId,
                payload: payload,
                variables: {
                    ...payload,
                    event
                },
                correlationId: execution.id
            };

            // 4. Executar ciclicamente até o fim ou suspensão
            const executedSteps = (execution.steps as any[]) || [];

            while (currentNodeId) {
                const result = await this.orchestrator.executeStep(graph, currentNodeId, context);

                executedSteps.push({
                    nodeId: currentNodeId,
                    status: result.status,
                    timestamp: new Date()
                });

                if (result.status === 'completed' && result.nextNodeId) {
                    currentNodeId = result.nextNodeId;
                    context.currentNodeId = currentNodeId;
                } else if (result.status === 'delayed' || result.status === 'waiting_event') {
                    // Tratar suspensão/atraso
                    await this.prisma.workflowExecution.update({
                        where: { id: execution.id },
                        data: {
                            status: result.status,
                            steps: executedSteps,
                        }
                    });

                    if (result.status === 'waiting_event' && result.suspendData) {
                        await this.prisma.workflowSuspension.create({
                            data: {
                                workflowExecutionId: execution.id,
                                stepId: currentNodeId,
                                eventName: result.suspendData.eventName,
                                correlationKey: result.suspendData.correlationKey,
                                timeoutAt: result.suspendData.timeoutAt
                            }
                        });
                    }

                    // Liberar lock imediatamente na suspensão (pode ficar suspenso por horas)
                    if (lockAcquired) {
                        await this.lockService.release(lockKey);
                        lockAcquired = false;
                    }

                    // Se for delay, re-enfileira no BullMQ
                    if (result.status === 'delayed' && result.delay) {
                        this.logger.log(`Workflow ${workflowId} delayed for ${result.delay}ms. Re-queueing job.`);
                        await this.workflowsQueue.add('execute-workflow', {
                            workflowId,
                            executionId: execution.id,
                            resumeNodeId: currentNodeId,
                            companyId,
                            event,
                            payload,
                        }, { delay: result.delay });
                    }

                    return { success: true, status: result.status };
                } else {
                    // Fim ou Falha
                    break;
                }
            }

            // 5. Finalizar execução no banco
            await this.prisma.workflowExecution.update({
                where: { id: execution.id },
                data: {
                    status: 'success',
                    steps: executedSteps,
                },
            });

            return { success: true, steps: executedSteps.length };

        } catch (error) {
            this.logger.error(`Error processing workflow job ${job.id}: ${error.message}`);

            // A1: Atualizar execução para 'failed' em caso de exceção
            if (execution?.id) {
                try {
                    await this.prisma.workflowExecution.update({
                        where: { id: execution.id },
                        data: { status: 'failed' },
                    });
                } catch (updateErr) {
                    this.logger.error(`Failed to update execution ${execution.id} to failed: ${updateErr.message}`);
                }
            }

            return { success: false, error: error.message };
        } finally {
            // Liberar lock ao terminar (sucesso, falha ou exceção não tratada)
            if (lockAcquired) {
                await this.lockService.release(lockKey);
            }
        }
    }
}
