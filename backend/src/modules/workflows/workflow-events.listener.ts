import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkflowEventsListener {
    private readonly logger = new Logger(WorkflowEventsListener.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly workflowsService: WorkflowsService,
        @InjectQueue('workflows') private readonly workflowsQueue: Queue,
    ) { }

    // 🔥 Escuta TODOS eventos do sistema
    @OnEvent('*', { async: true })
    async handleAllEvents(payload: any, eventName: string) {
        // Ignorar eventos internos do workflow para evitar loops
        if (eventName.startsWith('workflow.')) return;

        const companyId = payload.companyId || (payload.ticket && payload.ticket.companyId);

        if (!companyId) {
            this.logger.warn(`Event ${eventName} received without companyId. Skipping workflow trigger.`);
            return;
        }

        this.logger.log(`Event received: ${eventName} for company: ${companyId}`);

        // 0️⃣ Verificar se há workflows suspensos aguardando este evento
        // Extraímos chaves potenciais do payload para bater com o correlationKey (ex: id do ticket, id do contato)
        const potentialCorrelationKeys = [
            payload?.id,
            payload?.ticketId,
            payload?.ticket?.id,
            payload?.contactId,
            payload?.contact?.id,
            payload?.executionId
        ].filter(k => k !== undefined && k !== null).map(String);

        const suspensions = await this.prisma.workflowSuspension.findMany({
            where: {
                eventName,
                execution: {
                    companyId,
                    status: 'waiting_event'
                },
                OR: [
                    { correlationKey: null }, // Aguarda qualquer evento desse tipo na empresa
                    { correlationKey: { in: potentialCorrelationKeys } } // Aguarda evento para esta entidade específica
                ]
            },
            include: { execution: true }
        });

        if (suspensions.length > 0) {
            for (const suspension of suspensions) {
                this.logger.log(`Resuming workflow execution ${suspension.workflowExecutionId} for event ${eventName}`);

                await this.workflowsQueue.add('execute-workflow', {
                    workflowId: suspension.execution.workflowRuleId,
                    executionId: suspension.workflowExecutionId,
                    resumeNodeId: suspension.stepId,
                    companyId,
                    event: eventName,
                    payload,
                }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: false });

                // Remover suspensão após retomar
                await this.prisma.workflowSuspension.delete({ where: { id: suspension.id } });
            }
            // Importante: Se for um evento de continuação, podemos ou não querer disparar novos workflows.
            // Geralmente eventos de estado (ticket.status_changed) são para continuação.
        }

        // 1️⃣ Buscar workflows ativos com esse trigger para esta empresa
        const workflows = await this.workflowsService.findActiveByEvent(eventName, companyId);

        if (!workflows || workflows.length === 0) {
            this.logger.log(`No workflows found for event: ${eventName} in company ${companyId}`);
            return;
        }

        // 2️⃣ Enfileirar execução de cada workflow
        for (const workflow of workflows) {
            await this.workflowsQueue.add('execute-workflow', {
                workflowId: workflow.id,
                companyId,
                event: eventName,
                payload,
            }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: false });

            this.logger.log(
                `Workflow ${workflow.id} queued for execution (event: ${eventName})`,
            );
        }
    }
}
