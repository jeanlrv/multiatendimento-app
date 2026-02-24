import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CannedResponsesService {
    constructor(private prisma: PrismaService) { }

    async findAll(companyId: string, search?: string) {
        return this.prisma.cannedResponse.findMany({
            where: {
                companyId,
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            orderBy: { title: 'asc' },
        });
    }

    async create(companyId: string, data: { title: string; content: string }) {
        return this.prisma.cannedResponse.create({
            data: { companyId, title: data.title.trim(), content: data.content.trim() },
        });
    }

    async update(companyId: string, id: string, data: { title?: string; content?: string }) {
        await this.findOne(companyId, id);
        return this.prisma.cannedResponse.update({
            where: { id },
            data: {
                ...(data.title && { title: data.title.trim() }),
                ...(data.content && { content: data.content.trim() }),
            },
        });
    }

    async remove(companyId: string, id: string) {
        await this.findOne(companyId, id);
        await this.prisma.cannedResponse.delete({ where: { id } });
        return { message: 'Macro removida com sucesso' };
    }

    private async findOne(companyId: string, id: string) {
        const cr = await this.prisma.cannedResponse.findFirst({ where: { id, companyId } });
        if (!cr) throw new NotFoundException('Macro não encontrada');
        return cr;
    }
}
