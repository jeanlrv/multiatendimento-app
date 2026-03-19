import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TransferToHumanAction implements ActionExecutor {
    private readonly logger = new Logger(TransferToHumanAction.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing TransferToHumanAction for workflow ${context.workflowId}`);

        const { departmentId, queueId } = params;
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ação suportada apenas para tickets' };
        }

        try {
            // Check if ticket exists
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId }
            });

            if (!ticket) {
                return { success: false, error: 'Ticket não encontrado' };
            }

            // Build update data object
            const updateData: any = {
                mode: 'HUMANO',
                status: 'OPEN', // Ensure it's open if it's going to a human
                updatedAt: new Date()
            };

            if (departmentId) {
                updateData.departmentId = departmentId;
            }

            if (queueId) {
                updateData.queueId = queueId;
            }

            // Update ticket
            const updatedTicket = await this.prisma.ticket.update({
                where: { id: ticketId },
                data: updateData,
                include: {
                    contact: { select: { name: true, phoneNumber: true } },
                    department: { select: { id: true, name: true } },
                },
            });

            // Emitir eventos para que o WebSocket notifique o frontend
            this.eventEmitter.emit('ticket.status_changed', {
                ticketId,
                companyId: ticket.companyId,
                newStatus: 'OPEN',
                ticket: updatedTicket,
            });

            this.eventEmitter.emit('ticket.human_queue', {
                ticketId,
                companyId: ticket.companyId,
                departmentId: departmentId || ticket.departmentId,
                contactName: updatedTicket.contact?.name || 'Contato',
            });

            return {
                success: true,
                data: {
                    ticketId,
                    previousMode: ticket.mode,
                    newMode: 'HUMAN',
                    departmentId: departmentId || ticket.departmentId
                }
            };
        } catch (error) {
            this.logger.error(`TransferToHuman Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
