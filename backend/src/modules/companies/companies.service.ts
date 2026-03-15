import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class CompaniesService {
    private readonly logger = new Logger(CompaniesService.name);

    constructor(private prisma: PrismaService) { }

    async findOne(id: string) {
        const company = await this.prisma.company.findUnique({
            where: { id },
        });

        if (!company) {
            throw new NotFoundException(`Empresa com ID ${id} não encontrada`);
        }

        return company;
    }

    async updateBranding(id: string, data: UpdateBrandingDto) {
        return this.prisma.company.update({
            where: { id },
            data: {
                logoUrl: data.logoUrl,
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
            },
        });
    }

    async findAll() {
        return this.prisma.company.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async create(data: CreateCompanyDto) {
        return this.prisma.company.create({
            data: {
                name: data.name,
                primaryColor: data.primaryColor ?? '#3B82F6',
                secondaryColor: data.secondaryColor ?? '#1E293B',
                limitTokens: data.limitTokens ?? 100000,
                limitTokensPerHour: data.limitTokensPerHour ?? 0,
                limitTokensPerDay: data.limitTokensPerDay ?? 0,
                plan: data.plan ?? 'STARTER',
                maxUsers: data.maxUsers ?? 3,
                maxDepartments: data.maxDepartments ?? 1,
                maxWhatsApp: data.maxWhatsApp ?? 1,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            }
        });
    }

    async update(id: string, data: UpdateCompanyDto) {
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
        if (data.secondaryColor !== undefined) updateData.secondaryColor = data.secondaryColor;
        if (data.limitTokens !== undefined) updateData.limitTokens = data.limitTokens;
        if (data.limitTokensPerHour !== undefined) updateData.limitTokensPerHour = data.limitTokensPerHour;
        if (data.limitTokensPerDay !== undefined) updateData.limitTokensPerDay = data.limitTokensPerDay;
        if (data.plan !== undefined) updateData.plan = data.plan;
        if (data.maxUsers !== undefined) updateData.maxUsers = data.maxUsers;
        if (data.maxDepartments !== undefined) updateData.maxDepartments = data.maxDepartments;
        if (data.maxWhatsApp !== undefined) updateData.maxWhatsApp = data.maxWhatsApp;
        if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

        return this.prisma.company.update({
            where: { id },
            data: updateData,
        });
    }

    async remove(id: string) {
        return this.prisma.company.delete({
            where: { id },
        });
    }

    /**
     * LGPD Art.18 — Portabilidade: exporta todos os dados da empresa em formato JSON.
     */
    async exportData(companyId: string) {
        const [company, users, contacts, tickets, tags, departments] = await Promise.all([
            this.prisma.company.findUnique({ where: { id: companyId } }),
            this.prisma.user.findMany({
                where: { companyId },
                select: { id: true, name: true, email: true, role: true, createdAt: true },
            }),
            this.prisma.contact.findMany({
                where: { companyId },
                select: { id: true, name: true, phoneNumber: true, email: true, createdAt: true },
            }),
            this.prisma.ticket.findMany({
                where: { companyId },
                select: { id: true, protocol: true, status: true, subject: true, createdAt: true, closedAt: true },
            }),
            this.prisma.tag.findMany({ where: { companyId }, select: { id: true, name: true, color: true } }),
            this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true } }),
        ]);

        return {
            exportedAt: new Date().toISOString(),
            company: { id: company?.id, name: company?.name, plan: company?.plan, createdAt: company?.createdAt },
            users,
            contacts,
            tickets,
            tags,
            departments,
            summary: {
                totalUsers: users.length,
                totalContacts: contacts.length,
                totalTickets: tickets.length,
            },
        };
    }

    /**
     * LGPD Art.18 — Exclusão: apaga todos os dados da empresa em cascata.
     * Requer confirmação explícita com o nome da empresa.
     */
    async deleteAllData(companyId: string, confirmedName: string) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) throw new NotFoundException('Empresa não encontrada');

        if (confirmedName !== company.name) {
            throw new Error(`Confirmação inválida. Para excluir, informe exatamente o nome da empresa: "${company.name}"`);
        }

        this.logger.warn(`[LGPD] Iniciando exclusão de dados para empresa ${companyId} (${company.name})`);

        // Cascata via Prisma (ordem importa por FK)
        await this.prisma.$transaction([
            this.prisma.message.deleteMany({ where: { ticket: { companyId } } }),
            this.prisma.ticket.deleteMany({ where: { companyId } }),
            this.prisma.contact.deleteMany({ where: { companyId } }),
            this.prisma.customer.deleteMany({ where: { companyId } }),
            this.prisma.auditLog.deleteMany({ where: { companyId } }),
            this.prisma.user.deleteMany({ where: { companyId } }),
            this.prisma.company.delete({ where: { id: companyId } }),
        ]);

        this.logger.warn(`[LGPD] Dados da empresa ${companyId} excluídos com sucesso.`);
        return { deleted: true, companyId };
    }
}
