import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CollaborationService } from './collaboration.service';
import { Company } from '../../common/decorators/company.decorator';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Collaboration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collaboration')
export class CollaborationController {
    constructor(
        private readonly collabService: CollaborationService,
        private readonly prisma: PrismaService,
    ) { }

    @Get('users')
    @ApiOperation({ summary: 'Listar usuários da empresa com presença em tempo real' })
    async listCompanyUsers(@Company() companyId: string) {
        const users = await this.prisma.user.findMany({
            where: { companyId, isActive: true },
            select: { id: true, name: true, avatar: true, email: true },
            orderBy: { name: 'asc' },
        });

        return users.map(user => ({
            ...user,
            presence: this.collabService.getPresence(user.id),
        }));
    }

    @Get('chats')
    @ApiOperation({ summary: 'Listar chats do usuário autenticado' })
    getUserChats(@Request() req: any) {
        // req.user.id é o campo correto (JwtStrategy mapeia payload.sub → id)
        return this.collabService.getUserChats(req.user.id, req.user.companyId);
    }

    @Post('chats/direct')
    @ApiOperation({ summary: 'Obter ou criar chat direto com outro usuário' })
    getOrCreateDirectChat(
        @Request() req: any,
        @Body() data: { userId: string },
    ) {
        return this.collabService.getOrCreateDirectChat(req.user.companyId, req.user.id, data.userId);
    }

    @Post('chats/group')
    @ApiOperation({ summary: 'Criar chat em grupo' })
    createGroupChat(
        @Request() req: any,
        @Body() data: { name: string; memberIds: string[] },
    ) {
        return this.collabService.createGroupChat(req.user.companyId, data.name, req.user.id, data.memberIds);
    }

    @Get('chats/:id/messages')
    @ApiOperation({ summary: 'Histórico de mensagens de um chat' })
    async getChatMessages(
        @Request() req: any,
        @Param('id') chatId: string,
        @Query('limit') limit?: number,
    ) {
        // Validar se o chat pertence à empresa e se o usuário é membro
        const chat = await this.prisma.internalChat.findFirst({
            where: {
                id: chatId,
                companyId: req.user.companyId,
                members: { some: { userId: req.user.id } }
            }
        });

        if (!chat) {
            throw new Error('Chat não encontrado ou acesso negado');
        }

        return this.collabService.getChatHistory(chatId, limit ? Number(limit) : 50);
    }

    @Post('chats/:id/read')
    @ApiOperation({ summary: 'Marcar chat como lido pelo usuário autenticado' })
    async markAsRead(@Param('id') chatId: string, @Request() req: any) {
        // Validar se o chat pertence à empresa e se o usuário é membro
        const chat = await this.prisma.internalChat.findFirst({
            where: {
                id: chatId,
                companyId: req.user.companyId,
                members: { some: { userId: req.user.id } }
            }
        });

        if (!chat) {
            throw new Error('Chat não encontrado ou acesso negado');
        }

        return this.collabService.markAsRead(chatId, req.user.id);
    }
}
