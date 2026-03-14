import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { PrismaService } from '../../../database/prisma.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class SendMessageAction implements ActionExecutor {
    private readonly logger = new Logger(SendMessageAction.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsAppService,
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing SendMessage for workflow ${context.workflowId}`);

        const { message, to } = params;

        const ticketId = context.entityId || context.variables?.ticketId;

        if (!ticketId || context.entityType !== 'ticket') {
            return { success: false, error: 'Ticket ID não encontrado para envio de mensagem' };
        }

        try {
            // Resolve template variables in the message
            let resolvedMessage = message || '';
            if (resolvedMessage.includes('{{')) {
                resolvedMessage = resolvedMessage.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_: string, path: string) => {
                    const value = path.split('.').reduce((acc: any, part: string) => acc?.[part], context.variables);
                    return value !== undefined ? String(value) : `{{${path}}}`;
                });
            }

            // Create the message in the database
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { contact: true },
            });

            if (!ticket) {
                return { success: false, error: `Ticket ${ticketId} não encontrado` };
            }

            if (!ticket.connectionId) {
                return { success: false, error: `Ticket ${ticketId} não possui conexão WhatsApp associada` };
            }

            const phoneNumber = ticket.contact?.phoneNumber;
            if (!phoneNumber) {
                return { success: false, error: `Contato do ticket ${ticketId} não possui número de telefone` };
            }

            // Envia via Z-API antes de criar o registro
            await this.whatsappService.sendMessage(
                ticket.connectionId,
                phoneNumber,
                resolvedMessage,
                context.companyId,
            );

            const createdMessage = await this.prisma.message.create({
                data: {
                    ticketId,
                    content: resolvedMessage,
                    fromMe: true,
                    origin: 'AI',
                    messageType: 'TEXT',
                    status: 'SENT',
                    sentAt: new Date(),
                },
            });

            // Update ticket timestamps
            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: {
                    updatedAt: new Date(),
                    ...(ticket.firstResponseAt ? {} : { firstResponseAt: new Date() }),
                },
            });

            this.logger.log(`Message sent and saved: ${createdMessage.id} for ticket ${ticketId}`);

            return {
                success: true,
                data: {
                    messageId: createdMessage.id,
                    ticketId,
                    status: 'sent',
                    timestamp: new Date(),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to send message: ${error.message}`);
            return { success: false, error: `SendMessage Error: ${error.message}` };
        }
    }
}
