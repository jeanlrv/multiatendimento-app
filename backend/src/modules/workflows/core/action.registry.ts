import { ActionExecutor } from '../interfaces/action-executor.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ActionRegistry {
    private readonly actions = new Map<string, ActionExecutor>();
    private readonly logger = new Logger(ActionRegistry.name);

    register(type: string, executor: ActionExecutor) {
        if (this.actions.has(type)) {
            this.logger.warn(`Action type "${type}" is being overwritten.`);
        }
        this.actions.set(type, executor);
        this.logger.log(`Action "${type}" registered.`);
    }

    get(type: string): ActionExecutor | null {
        const executor = this.actions.get(type);
        if (!executor) {
            console.warn(`[ActionRegistry] Executor não encontrado para o tipo: ${type}`);
            return null;
        }
        return executor;
    }
}
