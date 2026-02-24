import { Injectable } from '@nestjs/common';
import {
    ActionExecutor,
    WorkflowContext,
    ActionResult
} from '../interfaces/action-executor.interface';
import { SchedulingService } from '../../scheduling/scheduling.service';

@Injectable()
export class CreateScheduleAction implements ActionExecutor {

    constructor(
        private readonly schedulingService: SchedulingService
    ) { }

    async execute(
        context: WorkflowContext,
        params: any
    ): Promise<ActionResult> {

        const contactId =
            context.payload?.contactId ||
            context.payload?.contact?.id ||
            (context.entityType === 'contact' ? context.entityId : null);

        if (!contactId) {
            return {
                success: false,
                error: 'contactId não encontrado no contexto. payload: ' + JSON.stringify(context.payload)
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

        await this.schedulingService.createSchedule(companyId, {
            contactId,
            userId: params?.userId,
            departmentId: params?.departmentId,
            startTime: params?.startTime,
            endTime: params?.endTime,
            notes: params?.notes
        });

        return { success: true };
    }
}
