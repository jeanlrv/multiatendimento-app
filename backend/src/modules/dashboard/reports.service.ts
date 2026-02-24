import { Injectable, Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard/dashboard.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private dashboardService: DashboardService,
        private mailService: MailService,
        private prisma: PrismaService
    ) { }

    async sendDailyReport(companyId: string, email: string) {
        this.logger.log(`Gerando relatório diário para: ${email} (Empresa: ${companyId})`);

        // Pegar stats das últimas 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const stats = await this.dashboardService.getStats(companyId, {
            startDate: yesterday.toISOString(),
            departmentId: 'ALL'
        });

        const html = this.generateReportHtml(stats);

        return await this.mailService.sendMail(
            email,
            `Relatório de Desempenho Diário - KSZap - ${new Date().toLocaleDateString('pt-BR')}`,
            html,
            true
        );
    }

    private generateReportHtml(stats: any) {
        return `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background-color: #f8fafc;">
                <div style="background-color: #1e293b; color: white; padding: 40px 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Resumo Executivo KSZap</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.7; font-size: 14px;">Performance das últimas 24 horas</p>
                </div>
                
                <div style="padding: 32px 24px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                        <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Tickets Ativos</p>
                            <h2 style="margin: 8px 0 0 0; color: #2563eb; font-size: 28px;">${stats.tickets.active}</h2>
                        </div>
                        <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Resolvidos</p>
                            <h2 style="margin: 8px 0 0 0; color: #10b981; font-size: 28px;">${stats.tickets.resolved}</h2>
                        </div>
                    </div>

                    <div style="background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 32px;">
                        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b;">Qualidade do Atendimento</h3>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 32px; font-weight: bold; color: #2563eb;">${stats.satisfaction}</div>
                            <div style="font-size: 12px; color: #64748b;">Índice de satisfação calculada via IA</div>
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">Ver Dashboard Completo</a>
                    </div>
                </div>

                <div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                    Este é um relatório automático gerado pelo sistema KSZap.
                </div>
            </div>
        `;
    }
}
