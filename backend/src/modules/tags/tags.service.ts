import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
    constructor(private prisma: PrismaService) { }

    async create(companyId: string, createTagDto: CreateTagDto) {
        const existingTag = await this.prisma.tag.findFirst({
            where: {
                name: createTagDto.name,
                companyId
            },
        });

        if (existingTag) {
            throw new ConflictException('Já existe uma tag com este nome nesta empresa');
        }

        return this.prisma.tag.create({
            data: {
                name: createTagDto.name,
                color: createTagDto.color || '#3B82F6',
                companyId,
            },
        });
    }

    async findAll(companyId: string) {
        return this.prisma.tag.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: string, companyId: string) {
        const tag = await this.prisma.tag.findFirst({
            where: { id, companyId },
        });

        if (!tag) {
            throw new NotFoundException(`Tag com ID ${id} não encontrada nesta empresa`);
        }

        return tag;
    }

    async update(id: string, companyId: string, updateTagDto: UpdateTagDto) {
        await this.findOne(id, companyId);

        if (updateTagDto.name) {
            const existingTag = await this.prisma.tag.findFirst({
                where: {
                    name: updateTagDto.name,
                    companyId
                },
            });

            if (existingTag && existingTag.id !== id) {
                throw new ConflictException('Já existe uma tag com este nome nesta empresa');
            }
        }

        return this.prisma.tag.update({
            where: { id },
            data: updateTagDto,
        });
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);

        return this.prisma.tag.delete({
            where: { id },
        });
    }
}
