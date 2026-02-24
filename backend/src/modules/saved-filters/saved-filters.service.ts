import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';

@Injectable()
export class SavedFiltersService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, companyId: string, data: CreateSavedFilterDto) {
        return this.prisma.savedFilter.create({
            data: {
                ...data,
                userId,
                companyId,
            },
        });
    }

    async findAll(userId: string, companyId: string) {
        return this.prisma.savedFilter.findMany({
            where: {
                userId,
                companyId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async remove(id: string, userId: string) {
        return this.prisma.savedFilter.delete({
            where: {
                id,
                userId, // Garante que o usuário só deleta o próprio filtro
            },
        });
    }
}
