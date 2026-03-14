import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TransferDepartmentAction implements ActionExecutor {
    private readonly logger = new Logger(TransferDepartmentAction.name);

    constructor(private readonly prisma: PrismaService) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing TransferDepartmentAction for workflow ${context.workflowId}`);

        const { departmentId, departmentName, mode } = params;
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ação suportada apenas para tickets' };
        }

        if (!departmentId && !departmentName) {
            return { success: false, error: 'É necessário informar o ID ou nome do departamento de destino' };
        }

        try {
            // Buscar departamento: ID tem prioridade; fallback por nome
            let dept: any;
            if (departmentId) {
                dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
            } else {
                // Busca pelo nome dentro da empresa do ticket
                const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { companyId: true } });
                dept = await this.prisma.department.findFirst({
                    where: { companyId: ticket?.companyId, name: { equals: departmentName, mode: 'insensitive' } }
                });
            }

            if (!dept) {
                return { success: false, error: `Departamento "${departmentId || departmentName}" não encontrado` };
            }

            const updateData: any = { departmentId: dept.id, updatedAt: new Date() };
            if (mode) updateData.mode = mode;

            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: updateData
            });

            return {
                success: true,
                data: { ticketId, departmentId: dept.id, departmentName: dept.name }
            };
        } catch (error) {
            this.logger.error(`TransferDepartment Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
