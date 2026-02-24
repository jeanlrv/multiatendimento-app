import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UpdateTicketAction implements ActionExecutor {
    private readonly logger = new Logger(UpdateTicketAction.name);

    constructor(private readonly prisma: PrismaService) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ticket ID not found or invalid entity type for UpdateTicketAction' };
        }

        this.logger.log(`Updating ticket ${ticketId} with params: ${JSON.stringify(params)}`);

        try {
            const updateData: any = {};

            if (params.priority) updateData.priority = params.priority;
            if (params.status) updateData.status = params.status;
            if (params.departmentId) updateData.departmentId = params.departmentId;
            if (params.assignedUserId) updateData.assignedUserId = params.assignedUserId;
            if (params.mode) updateData.mode = params.mode;

            const updatedTicket = await (this.prisma as any).ticket.update({
                where: { id: ticketId },
                data: updateData,
            });

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
