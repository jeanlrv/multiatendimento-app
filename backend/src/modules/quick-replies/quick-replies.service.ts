import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';

@Injectable()
export class QuickRepliesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(companyId: string, createQuickReplyDto: CreateQuickReplyDto) {
    return this.prisma.quickReply.create({
      data: {
        ...createQuickReplyDto,
        companyId,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.quickReply.findMany({
      where: { companyId },
      orderBy: { shortcut: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const quickReply = await this.prisma.quickReply.findFirst({
      where: { id, companyId },
    });

    if (!quickReply) {
      throw new NotFoundException('Resposta rápida não encontrada');
    }

    return quickReply;
  }

  async update(companyId: string, id: string, updateQuickReplyDto: UpdateQuickReplyDto) {
    // Verifica se existe e pertence à empresa antes de atualizar
    await this.findOne(companyId, id);

    return this.prisma.quickReply.update({
      where: { id },
      data: updateQuickReplyDto,
    });
  }

  async remove(companyId: string, id: string) {
    // Verifica se existe e pertence à empresa antes de remover
    await this.findOne(companyId, id);

    return this.prisma.quickReply.delete({
      where: { id },
    });
  }
}
