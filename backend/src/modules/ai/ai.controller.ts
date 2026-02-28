import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { AIService } from './ai.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat-request.dto';
import { Observable } from 'rxjs';
import { ConversationHistoryService } from './conversation-history.service';
import { NotificationService } from './notifications/notification.service';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from './api-keys/api-key.guard';
import { ProviderConfigService } from '../settings/provider-config.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
    constructor(
        private readonly aiService: AIService,
        private readonly conversationHistoryService: ConversationHistoryService,
        private readonly notificationService: NotificationService,
        private readonly providerConfigService: ProviderConfigService,
        private readonly configService: ConfigService,
    ) { }

    // ========== Agent CRUD ==========


    @Post('agents')
    @ApiOperation({ summary: 'Criar um novo agente de IA' })
    create(@Req() req: any, @Body() createAIAgentDto: CreateAIAgentDto) {
        return this.aiService.createAgent(req.user.companyId, createAIAgentDto);
    }

    @Get('agents')
    @ApiOperation({ summary: 'Listar todos os agentes de IA' })
    findAll(@Req() req: any) {
        return this.aiService.findAllAgents(req.user.companyId);
    }

    @Get('agents/:id')
    @ApiOperation({ summary: 'Obter detalhes de um agente de IA' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.aiService.findOneAgent(req.user.companyId, id);
    }

    @Patch('agents/:id')
    @ApiOperation({ summary: 'Atualizar um agente de IA' })
    update(@Req() req: any, @Param('id') id: string, @Body() updateAIAgentDto: UpdateAIAgentDto) {
        return this.aiService.updateAgent(req.user.companyId, id, updateAIAgentDto);
    }

    @Delete('agents/:id')
    @ApiOperation({ summary: 'Remover um agente de IA' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.aiService.removeAgent(req.user.companyId, id);
    }

    // ========== Chat ==========

    @Post('agents/:id/chat')
    @ApiOperation({ summary: 'Interagir com o agente de IA' })
    chat(@Req() req: any, @Param('id') id: string, @Body() chatRequest: ChatRequestDto) {
        return this.aiService.chat(req.user.companyId, id, chatRequest.message, chatRequest.history || []);
    }

    @Public()
    @UseGuards(ApiKeyGuard)
    @Post('agents/:id/chat-public')
    @ApiOperation({ summary: 'Interagir com o agente de IA via API Key' })
    chatPublic(@Req() req: any, @Param('id') id: string, @Body() chatRequest: ChatRequestDto) {
        const companyId = req.apiKeyCompanyId;
        const agentId = req.apiKeyAgentId || id;

        if (req.apiKeyAgentId && req.apiKeyAgentId !== id) {
            throw new UnauthorizedException('Esta API Key não tem acesso a este agente específico.');
        }

        return this.aiService.chat(companyId, agentId, chatRequest.message, chatRequest.history || []);
    }


    @Sse('agents/:id/stream')
    @ApiOperation({ summary: 'Streaming de respostas da IA' })
    streamChat(@Req() req: any, @Param('id') id: string, @Body() chatRequest: ChatRequestDto): Observable<any> {
        return this.aiService.streamChat(req.user.companyId, id, chatRequest.message, chatRequest.history || []);
    }

    // ========== Models & Usage ==========

    @Get('models')
    @ApiOperation({ summary: 'Listar modelos de IA disponíveis por provider (filtra por configurações da empresa)' })
    getModels(@Req() req: any) {
        return this.providerConfigService.getAvailableLLMProviders(req.user.companyId, this.configService);
    }

    @Get('embedding-providers')
    @ApiOperation({ summary: 'Listar providers de embedding disponíveis (filtra por configurações da empresa)' })
    getEmbeddingProviders(@Req() req: any) {
        return this.providerConfigService.getAvailableEmbeddingProviders(req.user.companyId, this.configService);
    }

    @Get('usage')
    @ApiOperation({ summary: 'Obter uso de tokens/IA da empresa' })
    getUsage(@Req() req: any) {
        return this.aiService.getUsage(req.user.companyId);
    }

    @Get('metrics')
    @ApiOperation({ summary: 'Obter métricas detalhadas de uso da IA' })
    async getMetrics(@Req() req: any) {
        return await this.aiService.getDetailedMetrics(req.user.companyId);
    }

    // ========== Multimodal Chat ==========

    @Post('agents/:id/chat-multimodal')
    @ApiOperation({ summary: 'Interagir com o agente de IA (suporte a imagens)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'O que você vê nesta imagem?' },
                imageUrls: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['data:image/png;base64,iVBORw0KGgo...', 'https://example.com/image.jpg']
                },
                history: {
                    type: 'array',
                    items: { type: 'object' },
                    example: [{ role: 'user', content: 'Olá' }]
                }
            }
        }
    })
    chatMultimodal(@Req() req: any, @Param('id') id: string, @Body() body: {
        message: string;
        imageUrls: string[];
        history?: { role: 'user' | 'assistant' | 'system', content: string }[];
    }) {
        return this.aiService.chatMultimodal(req.user.companyId, id, body.message, body.imageUrls, body.history || []);
    }

    // ========== Histórico de Conversas ==========

    @Post('conversations')
    @ApiOperation({ summary: 'Criar nova conversa' })
    createConversation(@Req() req: any, @Body() data: { agentId: string; title?: string }) {
        return this.conversationHistoryService.createConversation(
            req.user.companyId,
            req.user.id,
            data.agentId,
            data.title
        );
    }

    @Get('conversations')
    @ApiOperation({ summary: 'Listar conversas do usuário' })
    getUserConversations(@Req() req: any) {
        return this.conversationHistoryService.getUserConversations(req.user.companyId, req.user.id);
    }

    @Get('conversations/:id')
    @ApiOperation({ summary: 'Obter detalhes de uma conversa' })
    getConversationDetails(@Req() req: any, @Param('id') id: string) {
        return this.conversationHistoryService.getConversationDetails(req.user.companyId, req.user.id, id);
    }

    @Post('conversations/:id/messages')
    @ApiOperation({ summary: 'Adicionar mensagem a uma conversa' })
    addMessage(@Req() req: any, @Param('id') id: string, @Body() data: { role: 'user' | 'assistant'; content: string; metadata?: any }) {
        return this.conversationHistoryService.addMessage(req.user.companyId, req.user.id, id, data.role, data.content, data.metadata);
    }

    @Delete('conversations/:id')
    @ApiOperation({ summary: 'Deletar conversa' })
    deleteConversation(@Req() req: any, @Param('id') id: string) {
        return this.conversationHistoryService.deleteConversation(req.user.companyId, req.user.id, id);
    }

    @Patch('conversations/:id')
    @ApiOperation({ summary: 'Renomear conversa' })
    renameConversation(@Req() req: any, @Param('id') id: string, @Body('title') title: string) {
        return this.conversationHistoryService.renameConversation(req.user.companyId, req.user.id, id, title);
    }

    @Get('conversations/stats')
    @ApiOperation({ summary: 'Obter estatísticas de uso' })
    getUsageStats(@Req() req: any) {
        return this.conversationHistoryService.getUsageStats(req.user.companyId, req.user.id);
    }

    // ========== Notificações ==========

    @Get('notifications/pending')
    @ApiOperation({ summary: 'Obter notificações pendentes' })
    getPendingNotifications(@Req() req: any) {
        return this.notificationService.getPendingNotifications(req.user.companyId);
    }

    @Delete('notifications')
    @ApiOperation({ summary: 'Limpar todas as notificações' })
    clearNotifications(@Req() req: any) {
        this.notificationService.clearNotifications(req.user.companyId);
        return { message: 'Notificações limpas com sucesso' };
    }

    @Get('notifications/stats')
    @ApiOperation({ summary: 'Obter estatísticas de notificações' })
    getNotificationStats(@Req() req: any) {
        return this.notificationService.getNotificationStats(req.user.companyId);
    }
}
