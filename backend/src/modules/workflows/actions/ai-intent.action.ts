import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { AIService } from '../../ai/ai.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AIIntentAction implements ActionExecutor {
    private readonly logger = new Logger(AIIntentAction.name);

    constructor(
        private readonly aiService: AIService,
        private readonly prisma: PrismaService
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        const { agentId, promptTemplate } = params;
        const companyId = context.companyId;

        // Tentar obter a última mensagem do payload ou do banco
        let lastMessage = context.payload?.content || context.payload?.body;

        if (!lastMessage && context.entityType === 'ticket') {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: context.entityId },
                include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } }
            });
            lastMessage = ticket?.messages[0]?.content;
        }

        if (!lastMessage) {
            return { success: false, error: 'No message content found for AI intent analysis' };
        }

        this.logger.log(`Analyzing intent for message: "${lastMessage}" using agent ${agentId}`);

        try {
            const prompt = promptTemplate
                ? promptTemplate.replace('{{message}}', lastMessage)
                : `Analise a intenção da seguinte mensagem do cliente e responda APENAS um JSON no formato {"intent": "SAUDACAO|DUVIDA|RECLAMACAO|URGENTE", "isUrgent": boolean, "confidence": 0-1}:\n\n"${lastMessage}"`;

            const aiResponse = await this.aiService.chat(companyId, agentId, prompt);

            // Tentar extrair JSON da resposta
            const jsonMatch = aiResponse.match(/\{.*\}/s);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    success: true,
                    data: {
                        ...result,
                        rawResponse: aiResponse
                    }
                };
            }

            return {
                success: true,
                data: {
                    intent: 'UNKNOWN',
                    rawResponse: aiResponse
                }
            };
        } catch (error) {
            this.logger.error(`AI Intent Analysis failed: ${error.message}`);
            return { success: false, error: `AI Error: ${error.message}` };
        }
    }
}
