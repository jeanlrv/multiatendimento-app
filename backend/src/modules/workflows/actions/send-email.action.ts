import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SendEmailAction implements ActionExecutor {
    private readonly logger = new Logger(SendEmailAction.name);

    constructor(
        private readonly mailService: MailService,
        private readonly prisma: PrismaService
    ) { }

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing SendEmailAction for workflow ${context.workflowId}`);

        let { to, subject, body } = params;

        // Try to resolve "to" from context if not provided manually
        if (!to) {
            if (context.entityType === 'ticket' && context.entityId) {
                const ticket = await (this.prisma as any).ticket.findUnique({
                    where: { id: context.entityId },
                    include: { contact: true }
                });
                to = ticket?.contact?.email;
            } else if (context.entityType === 'contact' && context.entityId) {
                const contact = await (this.prisma as any).contact.findUnique({
                    where: { id: context.entityId }
                });
                to = contact?.email;
            }
        }

        if (!to) {
            return { success: false, error: 'Endereço de email de destino não encontrado' };
        }

        // Resolve template variables
        let resolvedSubject = subject || 'Notificação do Sistema';
        let resolvedBody = body || '';

        const resolveTemplate = (text: string) => {
            if (!text.includes('{{')) return text;
            return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_: string, path: string) => {
                const value = path.split('.').reduce((acc: any, part: string) => acc?.[part], context.variables);
                return value !== undefined ? String(value) : `{{${path}}}`;
            });
        };

        resolvedSubject = resolveTemplate(resolvedSubject);
        resolvedBody = resolveTemplate(resolvedBody);

        try {
            const success = await this.mailService.sendMail(to, resolvedSubject, resolvedBody, true);

            if (!success) {
                return { success: false, error: 'Falha ao enviar email pelo MailService' };
            }

            return {
                success: true,
                data: { to, subject: resolvedSubject }
            };
        } catch (error) {
            this.logger.error(`SendEmail Error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}
