import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class WorkflowAuditService {
    private readonly logger = new Logger(WorkflowAuditService.name);

    constructor(private readonly prisma: PrismaService) { }

    async logChange(
        userId: string,
        action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'REVERT',
        workflowId: string,
        oldData?: any,
        newData?: any,
        ipAddress?: string,
        userAgent?: string
    ) {
        try {
            const changes = this.calculateDiff(oldData, newData);

            await this.prisma.auditLog.create({
                data: {
                    userId,
                    action: `WORKFLOW_${action}`,
                    entity: 'WorkflowRule',
                    entityId: workflowId,
                    changes: changes,
                    ipAddress,
                    userAgent
                }
            });

            this.logger.log(`Audit log created for workflow ${workflowId} action ${action}`);
        } catch (error) {
            this.logger.error(`Failed to create audit log: ${error.message}`);
            // Non-blocking error
        }
    }

    private calculateDiff(oldData: any, newData: any): any {
        if (!oldData && !newData) return null;
        if (!oldData) return { type: 'create', new: newData };
        if (!newData) return { type: 'delete', old: oldData };

        // Simple shallow diff or JSON diff
        // For now, storing both or computing simple diff
        return {
            before: oldData,
            after: newData
        };
    }
}
