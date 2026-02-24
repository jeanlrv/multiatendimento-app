import { Injectable } from '@nestjs/common';
import {
    ActionExecutor,
    WorkflowContext,
    ActionResult
} from '../../interfaces/action-executor.interface';

@Injectable()
export class DelayAction implements ActionExecutor {

    async execute(
        context: WorkflowContext,
        params: any
    ): Promise<ActionResult> {

        const delayMs = Number(params?.delayMs ?? 0);

        if (!delayMs || delayMs <= 0) {
            return { success: true };
        }

        return {
            success: true,
            status: 'delayed',
            nextDelay: delayMs
        };
    }
}
