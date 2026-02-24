import { ActionExecutor, ActionResult, WorkflowContext } from '../../interfaces/action-executor.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WaitForEventAction implements ActionExecutor {
    private readonly logger = new Logger(WaitForEventAction.name);

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.debug(`Executing WaitForEvent: ${JSON.stringify(params)}`);

        const eventName = params.eventToWait;
        const timeoutMs = params.timeoutMs || 30000;

        if (!eventName) {
            return { success: false, error: 'Event name (eventToWait) is required for WaitForEvent action.' };
        }

        // Calcular timeout se fornecido
        let timeoutAt: Date | undefined;
        if (timeoutMs) {
            timeoutAt = new Date(Date.now() + timeoutMs);
        }

        // Determinar chave de correlação (padrão é o entityId do contexto — ticketId ou contactId)
        // Isso permite esperar "ticket.status_changed" especificamente para o ticket correto
        let correlationKey: string = context.entityId || context.executionId;

        // Se params.correlationKeyField for definido, resolve o valor via path na variáveis do contexto
        // Ex: correlationKeyField = "ticketId" → context.variables.ticketId
        // Ex: correlationKeyField = "contact.id" → context.variables.contact.id
        if (params.correlationKeyField) {
            const resolved = (params.correlationKeyField as string)
                .split('.')
                .reduce((acc: any, part: string) => acc?.[part], context.variables);
            if (resolved !== undefined && resolved !== null) {
                correlationKey = String(resolved);
            }
        }

        return {
            success: true,
            status: 'suspended',
            suspendData: {
                eventName,
                timeoutAt,
                correlationKey
            }
        };
    }
}
