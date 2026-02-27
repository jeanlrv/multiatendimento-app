import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Company } from '../../common/decorators/company.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get(':ticketId/messages')
    @ApiOperation({ summary: 'Obter histórico de mensagens de um ticket (Cursor)' })
    getMessages(
        @Param('ticketId') ticketId: string,
        @Company() companyId: string,
        @Query('limit') limit?: number,
        @Query('cursor') cursor?: string,
    ) {
        if (cursor) {
            return this.chatService.getMessagesCursor(ticketId, companyId, cursor, limit);
        }
        return this.chatService.getTicketMessages(ticketId, companyId, limit);
    }

    @Get('macros')
    @ApiOperation({ summary: 'Listar macros da empresa' })
    getMacros(@Company() companyId: string) {
        return this.chatService.getMacros(companyId);
    }

    @Post('macros')
    @ApiOperation({ summary: 'Criar nova macro' })
    createMacro(
        @Company() companyId: string,
        @Body() body: { title: string, content: string }
    ) {
        return this.chatService.createMacro(companyId, body);
    }

    @Post(':ticketId/send')
    @ApiOperation({ summary: 'Enviar mensagem para um ticket' })
    sendMessage(
        @Param('ticketId') ticketId: string,
        @Company() companyId: string,
        @Body() body: { content: string, type?: string, mediaUrl?: string, quotedMessageId?: string },
    ) {
        return this.chatService.sendMessage(
            ticketId,
            body.content,
            true, // Mensagem enviada pelo atendente (fromMe)
            body.type,
            body.mediaUrl,
            companyId,
            'AGENT',
            body.quotedMessageId
        );
    }

    @Post(':ticketId/read')
    @ApiOperation({ summary: 'Marcar mensagens de um ticket como lidas' })
    markAsRead(
        @Param('ticketId') ticketId: string,
        @Company() companyId: string,
    ) {
        return this.chatService.markAsRead(ticketId, companyId);
    }

    @Post('messages/:messageId/transcribe')
    @ApiOperation({ summary: 'Transcrever uma mensagem de áudio via IA' })
    transcribe(
        @Param('messageId') messageId: string,
        @Company() companyId: string,
    ) {
        return this.chatService.transcribe(messageId, companyId);
    }
}
