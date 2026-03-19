import { Controller, Get, Post, Body, Param, Query, Request, UseGuards, Patch, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CollaborationService } from './collaboration.service';
import { Company } from '../../common/decorators/company.decorator';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalChatType } from '@prisma/client';

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
    @ApiOperation({ summary: 'Listar usuários e Agentes IA ativos no chat interno' })
    async listParticipants(@Company() companyId: string) {
        const users = await this.collabService.getAllPresence(companyId);
        
        const aiAgents = await this.prisma.aIAgent.findMany({
            where: { companyId, isActive: true, allowInInternalChat: true },
            select: { id: true, name: true, avatar: true, description: true }
        });

        return {
            users,
            aiAgents: aiAgents.map(agent => ({ ...agent, chatStatus: 'ONLINE', isAi: true }))
        };
    }

    @Patch('settings/status')
    @ApiOperation({ summary: 'Atualizar status de presença (ONLINE, BUSY, OFFLINE)' })
    updateStatus(@Request() req: any, @Body() data: { status: string }) {
        return this.collabService.updateStatus(req.user.id, data.status);
    }

    @Patch('settings/sound')
    @ApiOperation({ summary: 'Ativar/Desativar notificações sonoras' })
    toggleSound(@Request() req: any, @Body() data: { enabled: boolean }) {
        return this.collabService.toggleSound(req.user.id, data.enabled);
    }

    @Get('chats')
    @ApiOperation({ summary: 'Listar chats do usuário autenticado' })
    getUserChats(@Request() req: any) {
        return this.collabService.getUserChats(req.user.id, req.user.companyId);
    }

    @Post('chats/direct')
    @ApiOperation({ summary: 'Obter ou criar chat direto com outro usuário ou Agente IA' })
    getOrCreateDirectChat(
        @Request() req: any,
        @Body() data: { userId?: string, aiAgentId?: string },
    ) {
        return this.collabService.getOrCreateDirectChat(
            req.user.companyId, 
            { userId: req.user.id }, 
            { userId: data.userId, aiId: data.aiAgentId }
        );
    }

    @Post('chats/room')
    @ApiOperation({ summary: 'Criar sala (grupo ou canal)' })
    createChatRoom(
        @Request() req: any,
        @Body() data: { name: string, description?: string, type: InternalChatType, memberIds: string[], aiAgentIds?: string[] },
    ) {
        return this.collabService.createChatRoom(req.user.companyId, {
            ...data,
            creatorId: req.user.id
        });
    }

    @Get('chats/:id/messages')
    @ApiOperation({ summary: 'Histórico de mensagens de um chat (com scroll infinito)' })
    async getChatMessages(
        @Request() req: any,
        @Param('id') chatId: string,
        @Query('limit') limit?: number,
        @Query('before') before?: string,
        @Query('threadId') threadId?: string,
    ) {
        // Validar acesso (simplificado para exemplo)
        const member = await this.prisma.internalChatMember.findFirst({
            where: { chatId, userId: req.user.id }
        });

        if (!member) throw new NotFoundException('Chat não encontrado ou acesso negado');

        return this.collabService.getHistory(chatId, {
            limit: limit ? Number(limit) : 50,
            before: before ? new Date(before) : undefined,
            threadId
        });
    }

    @Get('history/search')
    @ApiOperation({ summary: 'Busca avançada de histórico com filtros (destinatário, data, termo)' })
    async searchHistory(
        @Request() req: any,
        @Query('senderId') senderId?: string,
        @Query('chatId') chatId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('query') query?: string,
    ) {
        return this.collabService.searchHistory(req.user.companyId, {
            senderId,
            chatId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            query
        });
    }

    @Post('chats/:chatId/members/:memberId/read')
    @ApiOperation({ summary: 'Marcar até qual mensagem o usuário leu' })
    async markAsRead(
        @Param('chatId') chatId: string,
        @Param('memberId') memberId: string,
        @Body() data: { messageId: string }
    ) {
        return this.collabService.markAsRead(memberId, data.messageId);
    }

    @Patch('message/:id')
    @ApiOperation({ summary: 'Editar uma mensagem enviada' })
    async editMessage(
        @Request() req,
        @Param('id') messageId: string,
        @Body('content') content: string
    ) {
        return this.collabService.editInternalMessage(req.user.id, messageId, content);
    }
}
