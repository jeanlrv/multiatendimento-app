import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TransferDepartmentAction implements ActionExecutor {
    private readonly logger = new Logger(TransferDepartmentAction.name);

    constructor(private readonly prisma: PrismaService) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing TransferDepartmentAction for workflow ${context.workflowId}`);

        const { departmentId } = params;
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ação suportada apenas para tickets' };
        }

        if (!departmentId) {
            return { success: false, error: 'ID do departamento de destino é obrigatório' };
        }

        try {
            // Verifica se o departamento existe para evitar erro de FK
            const dept = await this.prisma.department.findUnique({
                where: { id: departmentId }
            });

            if (!dept) {
                return { success: false, error: `Departamento ${departmentId} não encontrado` };
            }

            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: {
                    departmentId,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: {
                    ticketId,
                    departmentId
                }
            };
        } catch (error) {
            this.logger.error(`TransferDepartment Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
