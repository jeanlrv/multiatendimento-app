import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import * as nodemailer from 'nodemailer';
import { SMTPConfig } from '@prisma/client';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(
        private prisma: PrismaService,
        private crypto: CryptoService,
    ) { }

    private async getTransporter(config: SMTPConfig) {
        // Descriptografar senha antes de usar no transporter SMTP
        const password = this.crypto.decrypt(config.password);

        return nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: password,
            },
        });
    }

    async sendMail(to: string, subject: string, body: string, isHtml = true) {
        try {
            // Buscar configuração SMTP padrão e ativa
            const config = await this.prisma.sMTPConfig.findFirst({
                where: { isActive: true, isDefault: true },
            });

            if (!config) {
                this.logger.warn('Nenhuma configuração SMTP padrão encontrada. Usando modo mock.');
                this.logger.log(`[Email Mock] Para: ${to} | Assunto: ${subject}`);
                return false;
            }

            const transporter = await this.getTransporter(config);

            const mailOptions = {
                from: `"${config.fromName}" <${config.fromEmail}>`,
                to,
                subject,
                [isHtml ? 'html' : 'text']: body,
            };

            const info = await transporter.sendMail(mailOptions);
            this.logger.log(`Email enviado com sucesso: ${info.messageId}`);
            return true;
        } catch (error) {
            this.logger.error(`Erro ao enviar email para ${to}: ${error.message}`);
            return false;
        }
    }
}
