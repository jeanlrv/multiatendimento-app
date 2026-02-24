import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { EvaluationsService } from '../../evaluations/evaluations.service';

@Injectable()
export class AnalyzeSentimentAction implements ActionExecutor {
    private readonly logger = new Logger(AnalyzeSentimentAction.name);

    constructor(
        private readonly evaluationsService: EvaluationsService
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        const ticketId = context.entityId || context.variables?.ticketId;
        const companyId = context.companyId;

        if (!ticketId || context.entityType !== 'ticket') {
            return {
                success: false,
                error: 'Ticket ID não encontrado ou tipo de entidade inválido para AnalyzeSentimentAction'
            };
        }

        this.logger.log(`Iniciando análise sentimental para o ticket ${ticketId} na empresa ${companyId}`);

        try {
            const evaluation = await this.evaluationsService.generateAISentimentAnalysis(companyId, ticketId);

            if (!evaluation) {
                return {
                    success: false,
                    error: 'Não foi possível gerar a análise sentimental. Verifique se o ticket tem mensagens e se o departamento possui um agente de IA configurado.'
                };
            }

            return {
                success: true,
                data: {
                    evaluationId: evaluation.id,
                    sentiment: evaluation.aiSentiment,
                    score: evaluation.aiSentimentScore
                }
            };
        } catch (error) {
            this.logger.error(`Falha na análise sentimental do ticket ${ticketId}: ${error.message}`);
            return { success: false, error: `Erro na Análise Sentimental: ${error.message}` };
        }
    }
}
