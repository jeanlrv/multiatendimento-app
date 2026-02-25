import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UpdateWorkflowDto } from './dtos/update-workflow.dto';
import { SimulateWorkflowDto } from './dtos/simulate-workflow.dto';
import { CreateWorkflowDto } from './dtos/create-workflow.dto';
import { AIService } from '../ai/ai.service';
import { ConditionAction } from './actions/control/condition.action';
import { SplitTrafficAction } from './actions/control/split-traffic.action';

@Injectable()
export class WorkflowsService implements OnModuleInit {
    private readonly logger = new Logger(WorkflowsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AIService,
        @InjectQueue('workflows') private readonly workflowsQueue: Queue,
    ) { }

    /* ============================================================
       🔥 BUSCAR WORKFLOWS ATIVOS PELO EVENTO (GRAPH V2)
    ============================================================ */

    async findActiveByEvent(event: string, companyId: string) {
        return (this.prisma as any).workflowRule.findMany({
            where: {
                companyId,
                isActive: true,
                trigger: {
                    path: ['event'],
                    equals: event,
                },
            },
            orderBy: {
                priority: 'desc',
            },
        });
    }

    /* ============================================================
       CRUD RULES
    ============================================================ */

    async findAllRules(companyId: string) {
        return (this.prisma as any).workflowRule.findMany({
            where: { companyId },
            include: {
                _count: { select: { executions: true } },
            },
            orderBy: { priority: 'desc' },
        });
    }

    async createRule(companyId: string, data: CreateWorkflowDto) {
        return (this.prisma as any).workflowRule.create({
            data: {
                name: data.name,
                description: data.description || '',
                companyId,
                isActive: data.isActive ?? true,
                priority: data.priority ?? 0,
                environment: data.environment || 'PRODUCTION',
                trigger: (data.trigger || { event: 'manual.trigger' }) as any,
                actions: (data.actions || []) as any,
                nodes: (data.nodes || []) as any,
                edges: (data.edges || []) as any,
            } as any,
        });
    }

    async updateRule(id: string, companyId: string, data: UpdateWorkflowDto) {
        // Garantir que pertence à empresa
        await (this.prisma as any).workflowRule.findFirstOrThrow({
            where: { id, companyId }
        });

        return (this.prisma as any).workflowRule.update({
            where: { id },
            data: data as any,
        });
    }

    async deleteRule(id: string, companyId: string) {
        // Garantir que pertence à empresa
        await (this.prisma as any).workflowRule.findFirstOrThrow({
            where: { id, companyId }
        });

        return (this.prisma as any).workflowRule.delete({
            where: { id },
        });
    }

    async duplicateRule(id: string, companyId: string) {
        const original = await (this.prisma as any).workflowRule.findFirst({
            where: { id, companyId },
        });

        if (!original) throw new NotFoundException('Workflow not found');

        const { id: _, createdAt, updatedAt, runCount, ...data } = original;

        return (this.prisma as any).workflowRule.create({
            data: {
                ...data,
                companyId,
                name: `${original.name} (Cópia)`,
                isActive: false,
                runCount: 0,
            },
        });
    }

    /* ============================================================
       EXECUÇÕES
    ============================================================ */

    async findAllExecutions(companyId: string, query?: any) {
        const where: any = { companyId };

        if (query?.status) where.status = query.status;
        if (query?.ruleId) where.workflowRuleId = query.ruleId;

        const page = Math.max(1, Number(query?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query?.limit) || 10));
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            (this.prisma as any).workflowExecution.findMany({
                where,
                include: { workflowRule: true },
                orderBy: { executedAt: 'desc' },
                take: limit,
                skip,
            }),
            (this.prisma as any).workflowExecution.count({ where }),
        ]);

        return { items, total };
    }

    async getRuleStats(id: string, companyId: string) {
        const [total, failures] = await Promise.all([
            (this.prisma as any).workflowExecution.count({ where: { workflowRuleId: id, companyId } }),
            (this.prisma as any).workflowExecution.count({ where: { workflowRuleId: id, status: 'failed', companyId } }),
        ]);

        return {
            totalExecutions: total,
            totalFailures: failures,
            successRate: total > 0 ? Math.round(((total - failures) / total) * 100) : 100,
        };
    }

    async getAllRuleStats(companyId: string) {
        const [totals, failures] = await Promise.all([
            (this.prisma as any).workflowExecution.groupBy({
                by: ['workflowRuleId'],
                where: { companyId },
                _count: { id: true },
            }),
            (this.prisma as any).workflowExecution.groupBy({
                by: ['workflowRuleId'],
                where: { companyId, status: 'failed' },
                _count: { id: true },
            }),
        ]);

        const failureMap = new Map(failures.map(r => [r.workflowRuleId, r._count.id]));

        const result: Record<string, { totalExecutions: number; totalFailures: number; successRate: number }> = {};
        for (const row of totals) {
            const total = (row as any)._count.id;
            const failed = (failureMap.get(row.workflowRuleId) as any) || 0;
            result[row.workflowRuleId] = {
                totalExecutions: total,
                totalFailures: failed,
                successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
            };
        }

        return result;
    }

    async getAnalytics(companyId: string) {
        const [total, failures, durationAgg] = await Promise.all([
            (this.prisma as any).workflowExecution.count({ where: { companyId } }),
            (this.prisma as any).workflowExecution.count({ where: { companyId, status: 'failed' } }),
            (this.prisma as any).workflowExecution.aggregate({
                where: { companyId },
                _avg: { duration: true },
            }),
        ]);

        return {
            totalExecutions: total,
            failureRate: total > 0 ? (failures / total) * 100 : 0,
            averageDuration: Math.round(durationAgg._avg.duration ?? 0),
        };
    }

    /* ============================================================
       VERSIONAMENTO
    ============================================================ */

    async findAllVersions(workflowId: string, companyId: string) {
        // Garantir que o workflow pertence à empresa
        await (this.prisma as any).workflowRule.findFirstOrThrow({
            where: { id: workflowId, companyId }
        });

        return (this.prisma as any).workflowVersion.findMany({
            where: { workflowId },
            orderBy: { version: 'desc' },
        });
    }

    async createVersion(
        id: string,
        companyId: string,
        description: string,
        userId: string,
    ) {
        const rule = await (this.prisma as any).workflowRule.findFirst({
            where: { id, companyId },
        });

        if (!rule)
            throw new NotFoundException('Workflow rule not found');

        const [version] = await (this.prisma as any).$transaction([
            (this.prisma as any).workflowVersion.create({
                data: {
                    workflowId: id,
                    version: rule.version + 1,
                    trigger: rule.trigger as any,
                    actions: rule.actions as any,
                    nodes: (rule as any).nodes,
                    edges: (rule as any).edges,
                    description,
                    commitMessage: description,
                    createdBy: userId,
                } as any,
            }),
            (this.prisma as any).workflowRule.update({
                where: { id },
                data: { version: { increment: 1 } },
            }),
        ]);

        return version;
    }

    async restoreVersion(id: string, companyId: string, versionId: string) {
        const version = await (this.prisma as any).workflowVersion.findUnique({
            where: { id: versionId },
        });

        if (!version || version.workflowId !== id) {
            throw new NotFoundException('Version not found');
        }

        // Garantir que o workflow pertence à empresa
        await (this.prisma as any).workflowRule.findFirstOrThrow({
            where: { id, companyId }
        });

        return (this.prisma as any).workflowRule.update({
            where: { id },
            data: {
                trigger: version.trigger,
                actions: version.actions,
                nodes: (version as any).nodes,
                edges: (version as any).edges,
                version: { increment: 1 },
            },
        });
    }

    /* ============================================================
       SIMULAÇÃO
    ============================================================ */

    async simulate(data: SimulateWorkflowDto, companyId: string) {
        let nodes = data.nodes || [];
        let edges = data.edges || [];

        if (nodes.length === 0 && data.ruleId) {
            const rule = await (this.prisma as any).workflowRule.findFirst({
                where: { id: data.ruleId, companyId },
            });

            if (!rule) throw new NotFoundException('Workflow rule not found');
            nodes = rule.nodes as any[];
            edges = rule.edges as any[];
        }

        if (nodes.length === 0) {
            return { success: false, message: 'No nodes provided for simulation' };
        }

        const trace = [];
        let currentNode = nodes.find(n => n.type === 'trigger' && n.data?.event === data.event);

        if (!currentNode) {
            // Se não encontrou por evento exato, tenta achar o primeiro trigger
            currentNode = nodes.find(n => n.type === 'trigger');
        }

        if (!currentNode) {
            return { success: false, message: 'Nó inicial (Trigger) não encontrado' };
        }

        const context: any = {
            workflowId: 'SIMULATION',
            executionId: 'SIMULATION',
            companyId,
            variables: { ...data.payload, event: data.event },
            currentPayload: data.payload,
        };

        const conditionAction = new ConditionAction();
        const splitAction = new SplitTrafficAction();

        let pathIndex = 0;
        const maxSteps = 50;

        while (currentNode && pathIndex < maxSteps) {
            const stepTrace: any = {
                nodeId: currentNode.id,
                type: currentNode.type,
                label: currentNode.data?.label || currentNode.type,
                actionType: currentNode.data?.actionType
            };

            trace.push(stepTrace);
            context.currentNodeId = currentNode.id;

            let nextEdge = null;
            const outEdges = edges.filter(e => e.source === currentNode.id);

            try {
                if (currentNode.type === 'condition') {
                    const result = await conditionAction.execute(context, currentNode.data?.params || currentNode.data);
                    const isTrueStr = String((result.data as any)?.result);
                    stepTrace.result = isTrueStr === 'true';
                    nextEdge = outEdges.find(e => String(e.sourceHandle) === isTrueStr);
                } else if (currentNode.type === 'split_traffic') {
                    const result = await splitAction.execute(context, currentNode.data?.params || currentNode.data);
                    const handle = String((result.data as any)?.result); // 'a' or 'b'
                    stepTrace.result = handle.toUpperCase();
                    nextEdge = outEdges.find(e => String(e.sourceHandle) === handle);
                } else if (currentNode.type === 'wait_for_event') {
                    stepTrace.result = 'Simulated Wait (Proceeds to Success)';
                    nextEdge = outEdges.find(e => e.sourceHandle === 'success');
                } else if (currentNode.type === 'end') {
                    break;
                } else {
                    // Triggers, Actions, Delays
                    stepTrace.result = 'Executed via Mock';
                    nextEdge = outEdges[0];
                }
            } catch (err) {
                stepTrace.error = err.message;
                break;
            }

            if (nextEdge) {
                currentNode = nodes.find(n => n.id === nextEdge.target);
            } else {
                currentNode = null;
            }

            pathIndex++;
        }

        return {
            success: true,
            trace,
            message: 'Simulação concluída com sucesso',
        };
    }

    /* ============================================================
       DISPARO MANUAL
    ============================================================ */

    async runManual(id: string, companyId: string) {
        const rule = await (this.prisma as any).workflowRule.findFirst({
            where: { id, companyId },
        });

        if (!rule)
            throw new NotFoundException('Workflow rule not found');

        const job = await this.workflowsQueue.add('execute-workflow', {
            workflowId: rule.id,
            companyId,
            event: 'manual.trigger',
            payload: {},
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false, // manter jobs falhos para diagnóstico
        });

        return {
            executionId: job.id,
            message: 'Workflow queued',
        };
    }

    /* Agendamento de monitoramento de timeouts */
    async onModuleInit() {
        this.logger.log('Scheduling workflow timeout checks (every 1 minute)');
        await this.workflowsQueue.add('check-timeouts', {}, {
            repeat: { pattern: '*/1 * * * *' }, // Cron: Every minute
            removeOnComplete: true,
            removeOnFail: true,
        });
    }

    async checkTimeouts() {
        const now = new Date();
        const expired = await (this.prisma as any).workflowSuspension.findMany({
            where: {
                timeoutAt: { lte: now }
            },
            include: { execution: true }
        });

        if (expired.length === 0) return;

        this.logger.log(`Found ${expired.length} expired workflow suspensions. Resuming with timeout.`);

        for (const suspension of expired) {
            await this.workflowsQueue.add('execute-workflow', {
                workflowId: suspension.execution.workflowRuleId,
                executionId: suspension.workflowExecutionId,
                resumeNodeId: suspension.stepId,
                companyId: suspension.execution.companyId,
                event: suspension.eventName,
                payload: { timeout: true },
            });

            await (this.prisma as any).workflowSuspension.delete({ where: { id: suspension.id } });
        }
    }

    async seedDefaultAeroWorkflow(companyId: string, aiAgentId?: string) {
        // 1. Verificar se já existe um Aero Flow ativo
        const existing = await (this.prisma as any).workflowRule.findFirst({
            where: { companyId, name: 'Aero Default Flow (V1)' },
        });

        if (existing) return existing;

        // 2. Garantir que temos um agente de IA
        let agentId = aiAgentId;
        if (!agentId) {
            const agents = await this.aiService.findAllAgents(companyId);
            if (agents.length === 0) {
                this.logger.warn(`No AI Agents found for company ${companyId}. Can't seed Aero flow.`);
                throw new NotFoundException('Nenhum Agente de IA encontrado para configurar o fluxo Aero.');
            }
            agentId = agents[0].id;
        }

        this.logger.log(`Seeding Aero Default Flow for company ${companyId}`);

        // 3. Criar o Grafo do Aero Flow
        return (this.prisma as any).workflowRule.create({
            data: {
                name: 'Aero Default Flow (V1)',
                description: 'Fluxo completo: Recepção IA, Transferência de Setor e Análise Sentimental após 30min.',
                companyId,
                isActive: true,
                priority: 200,
                trigger: { event: 'message.received' },
                nodes: [
                    {
                        id: 'node_start',
                        type: 'trigger',
                        position: { x: 0, y: 100 },
                        data: { event: 'message.received', label: 'Mensagem Recebida' }
                    },
                    {
                        id: 'node_reception',
                        type: 'ai_intent',
                        position: { x: 250, y: 100 },
                        data: {
                            label: 'Recepção IA',
                            agentId,
                            promptTemplate: 'Você é um assistente de recepção. Analise a mensagem: "{{message}}". Identifique o departamento (Suporte, Vendas, Financeiro) e responda JSON: {"intent": "TRANSFERENCIA", "department": "nome-do-departamento", "message": "resposta educada ao cliente"}'
                        }
                    },
                    {
                        id: 'node_transfer',
                        type: 'action',
                        position: { x: 500, y: 100 },
                        data: {
                            label: 'Transferir Setor',
                            actionType: 'update_ticket',
                            params: { mode: 'HUMANO' } // Transfere para humano no departamento identificado (simplificado)
                        }
                    },
                    {
                        id: 'node_wait_resolve',
                        type: 'wait_for_event',
                        position: { x: 750, y: 100 },
                        data: {
                            label: 'Aguardar Resolução',
                            eventToWait: 'ticket.status_changed',
                            timeoutMs: 0 // Sem timeout, aguarda indefinidamente a resolução
                        }
                    },
                    {
                        id: 'node_delay_feedback',
                        type: 'delay',
                        position: { x: 1000, y: 100 },
                        data: {
                            label: 'Esperar 30min',
                            delayMs: 1800000, // 30 minutos
                            delayType: 'fixed'
                        }
                    },
                    {
                        id: 'node_sentiment',
                        type: 'action',
                        position: { x: 1250, y: 100 },
                        data: {
                            label: 'Análise Sentimental',
                            actionType: 'analyze_sentiment'
                        }
                    },
                    {
                        id: 'node_end',
                        type: 'end',
                        position: { x: 1500, y: 100 },
                        data: { label: 'Fim' }
                    }
                ],
                edges: [
                    { id: 'e1', source: 'node_start', target: 'node_reception' },
                    { id: 'e2', source: 'node_reception', target: 'node_transfer' },
                    { id: 'e3', source: 'node_transfer', target: 'node_wait_resolve' },
                    { id: 'e4', source: 'node_wait_resolve', target: 'node_delay_feedback', sourceHandle: 'success' },
                    { id: 'e5', source: 'node_delay_feedback', target: 'node_sentiment' },
                    { id: 'e6', source: 'node_sentiment', target: 'node_end' }
                ]
            } as any
        });
    }
}
