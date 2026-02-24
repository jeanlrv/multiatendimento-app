import { Injectable } from '@nestjs/common';
import {
    ActionExecutor,
    WorkflowContext,
    ActionResult
} from '../interfaces/action-executor.interface';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class UpdateScheduleStatusAction implements ActionExecutor {

    constructor(
        private readonly schedulingService: SchedulingService
    ) { }

    async execute(
        context: WorkflowContext,
        params: any
    ): Promise<ActionResult> {

        const scheduleId =
            params?.scheduleId ||
            context.currentPayload?.scheduleId;

        const status = params?.status as ScheduleStatus;

        if (!scheduleId || !status) {
            return {
                success: false,
                error: 'scheduleId ou status não informado'
            };
        }
        const companyId =
            context.variables?.companyId ||
            params?.companyId;

        if (!companyId) {
            return {
                success: false,
                error: 'companyId não encontrado no contexto'
            };
        }

        await this.schedulingService.updateStatus(
            companyId,
            scheduleId,
            status
        );

        return { success: true };
    }
}
