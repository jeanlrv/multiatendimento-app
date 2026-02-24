import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Injectable()
export class CompaniesService {
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
}
