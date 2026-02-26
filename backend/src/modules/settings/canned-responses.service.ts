import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CannedResponsesService {
    constructor(private prisma: PrismaService) { }

    async findAll(companyId: string, search?: string) {
        return this.prisma.quickReply.findMany({
            where: {
                companyId,
                ...(search && {
                    OR: [
                        { shortcut: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } },
                    ],
                }),
            },
            orderBy: { shortcut: 'asc' },
        });
    }

    async create(companyId: string, data: { title: string; content: string }) {
        return this.prisma.quickReply.create({
            data: { companyId, shortcut: data.title.trim(), content: data.content.trim() },
        });
    }

    async update(companyId: string, id: string, data: { title?: string; content?: string }) {
        await this.findOne(companyId, id);
        return this.prisma.quickReply.update({
            where: { id },
            data: {
                ...(data.title && { shortcut: data.title.trim() }),
                ...(data.content && { content: data.content.trim() }),
            },
        });
    }

    async remove(companyId: string, id: string) {
        await this.findOne(companyId, id);
        await this.prisma.quickReply.delete({ where: { id } });
        return { message: 'Macro removida com sucesso' };
    }

    private async findOne(companyId: string, id: string) {
        const cr = await this.prisma.quickReply.findFirst({ where: { id, companyId } });
        if (!cr) throw new NotFoundException('Macro não encontrada');
        return cr;
    }
}
