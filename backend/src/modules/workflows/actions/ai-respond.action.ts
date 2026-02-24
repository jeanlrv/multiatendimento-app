import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { AIService } from '../../ai/ai.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AIRespondAction implements ActionExecutor {
    private readonly logger = new Logger(AIRespondAction.name);

    constructor(
        private readonly aiService: AIService,
        private readonly whatsappService: WhatsAppService,
        private readonly prisma: PrismaService,
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing AIRespondAction for workflow ${context.workflowId}`);

        const { agentId, promptTemplate, fallbackMessage } = params;
        const companyId = context.companyId;
        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'AI Respond suportado apenas para tickets' };
        }

        try {
            // 1. Obter última mensagem para contexto
            let lastMessage = context.payload?.content || context.payload?.body;

            if (!lastMessage) {
                const ticket = await (this.prisma as any).ticket.findUnique({
                    where: { id: ticketId },
                    include: { messages: { orderBy: { sentAt: 'desc' }, take: 1 } }
                });
                lastMessage = ticket?.messages[0]?.content || '';
            }

            // 2. Preparar prompt
            let prompt = promptTemplate || `Responda de forma curta e cordial à seguinte mensagem do cliente:\n\n"${lastMessage}"`;

            // Resolver variáveis de template no prompt
            if (prompt.includes('{{message}}')) {
                prompt = prompt.replace('{{message}}', lastMessage);
            }

            // 3. Chamar IA
            this.logger.log(`Calling AI for ticket ${ticketId} using agent ${agentId}`);
            let aiResponse = await this.aiService.chat(companyId, agentId, prompt);

            if (!aiResponse && fallbackMessage) {
                aiResponse = fallbackMessage;
            }

            if (!aiResponse) {
                return { success: false, error: 'AI falhou em gerar uma resposta e não há fallback.' };
            }

            // 4. Enviar mensagem
            const ticketDetail = await (this.prisma as any).ticket.findUnique({
                where: { id: ticketId },
                include: { contact: true },
            });

            if (!ticketDetail || !ticketDetail.connectionId || !ticketDetail.contact?.phoneNumber) {
                return { success: false, error: 'Dados insuficientes do ticket para envio via WhatsApp' };
            }

            await this.whatsappService.sendMessage(
                ticketDetail.connectionId,
                ticketDetail.contact.phoneNumber,
                aiResponse,
                companyId,
            );

            // 5. Salvar mensagem no banco
            const createdMessage = await (this.prisma as any).message.create({
                data: {
                    ticketId,
                    content: aiResponse,
                    fromMe: true,
                    origin: 'AI',
                    messageType: 'TEXT',
                    status: 'SENT',
                    sentAt: new Date(),
                },
            });

            // 6. Atualizar ticket
            await (this.prisma as any).ticket.update({
                where: { id: ticketId },
                data: {
                    updatedAt: new Date(),
                    ...(ticketDetail.firstResponseAt ? {} : { firstResponseAt: new Date() }),
                },
            });

            return {
                success: true,
                data: {
                    response: aiResponse,
                    messageId: createdMessage.id
                }
            };

        } catch (error) {
            this.logger.error(`AI Respond Action failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
