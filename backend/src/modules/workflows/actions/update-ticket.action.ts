import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';
import { resolveTemplate } from '../utils/resolve-template';

@Injectable()
export class UpdateTicketAction implements ActionExecutor {
    private readonly logger = new Logger(UpdateTicketAction.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ticket ID not found or invalid entity type for UpdateTicketAction' };
        }

        this.logger.log(`Updating ticket ${ticketId} with params: ${JSON.stringify(params)}`);

        try {
            const updateData: any = {};

            if (params.priority) updateData.priority = resolveTemplate(params.priority, context);
            if (params.status) updateData.status = resolveTemplate(params.status, context);
            if (params.departmentId) updateData.departmentId = resolveTemplate(params.departmentId, context);
            if (params.assignedUserId) updateData.assignedUserId = resolveTemplate(params.assignedUserId, context);
            if (params.mode) updateData.mode = resolveTemplate(params.mode, context);

            // Se estiver resolvendo, adicionar timestamps
            if (updateData.status === 'RESOLVED') {
                updateData.resolvedAt = new Date();
                updateData.closedAt = new Date();
            }

            const updatedTicket = await this.prisma.ticket.update({
                where: { id: ticketId },
                data: updateData,
                include: { contact: true },
            });

            // Emitir evento ticket.resolved para acionar CSAT e workflows downstream
            if (updateData.status === 'RESOLVED') {
                this.eventEmitter.emit('ticket.resolved', {
                    ticketId,
                    companyId: context.companyId,
                    connectionId: (updatedTicket as any).connectionId,
                    contact: (updatedTicket as any).contact,
                    departmentId: (updatedTicket as any).departmentId ?? null,
                });
                this.logger.log(`Ticket ${ticketId} resolvido via workflow — evento ticket.resolved emitido`);
            }

            return {
                success: true,
                data: {
                    ticketId: updatedTicket.id,
                    updatedFields: Object.keys(updateData)
                }
            };
        } catch (error) {
            this.logger.error(`Failed to update ticket ${ticketId}: ${error.message}`);
            return { success: false, error: `Prisma Error: ${error.message}` };
        }
    }
}
