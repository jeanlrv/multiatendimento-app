import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
    ActionExecutor,
    WorkflowContext,
    ActionResult,
} from '../../interfaces/action-executor.interface';

@Injectable()
export class SplitTrafficAction implements ActionExecutor {
    async execute(
        context: WorkflowContext,
        params: any,
    ): Promise<ActionResult> {

        // Frontend configuration comes in as percentageA (0 to 100)
        let percentageA = params?.percentageA;
        if (percentageA === undefined || percentageA === null) {
            percentageA = 50; // default 50/50
        }

        const payload = context.currentPayload as Record<string, any>;
        const seed = payload?.contactId || payload?.contact?.id || context.executionId;

        // Hash para consistência (mesmo contato cai sempre na mesma rota se for o mesmo node)
        const hash = createHash('md5')
            .update(`${seed}:split:${context.currentNodeId}`)
            .digest('hex');

        // Pega valor determinístico de 0 a 100
        const value = (parseInt(hash.substring(0, 8), 16) % 100) + 1; // 1 to 100

        const result = value <= percentageA ? 'a' : 'b';

        return {
            success: true,
            data: { result },
        };
    }
}
