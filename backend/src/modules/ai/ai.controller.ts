import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Res, Sse, UnauthorizedException, Logger, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

import { PermissionsGuard } from '../auth/guards/permissions.guard';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
    @RequirePermission(Permission.AI_MANAGE)
    @ApiOperation({ summary: 'Criar um novo agente de IA' })
    create(@Req() req: any, @Body() createAIAgentDto: CreateAIAgentDto) {
        return this.aiService.createAgent(req.user.companyId, createAIAgentDto);
    }

    @Get('agents')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Listar todos os agentes de IA' })
    findAll(@Req() req: any) {
        return this.aiService.findAllAgents(req.user.companyId);
    }

    @Get('agents/:id')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Obter detalhes de um agente de IA' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.aiService.findOneAgent(req.user.companyId, id);
    }

    @Patch('agents/:id')
    @RequirePermission(Permission.AI_MANAGE)
    @ApiOperation({ summary: 'Atualizar um agente de IA' })
    update(@Req() req: any, @Param('id') id: string, @Body() updateAIAgentDto: UpdateAIAgentDto) {
        return this.aiService.updateAgent(req.user.companyId, id, updateAIAgentDto);
    }

    @Delete('agents/:id')
    @RequirePermission(Permission.AI_MANAGE)
    @ApiOperation({ summary: 'Remover um agente de IA' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.aiService.removeAgent(req.user.companyId, id);
    }

    // ========== Chat ==========

    @Post('agents/:id/chat')
    @RequirePermission(Permission.AI_CHAT)
    @ApiOperation({ summary: 'Interagir com o agente de IA' })
    chat(@Req() req: any, @Param('id') id: string, @Body() chatRequest: ChatRequestDto) {
        return this.aiService.chat(req.user.companyId, id, chatRequest.message, chatRequest.history || [], chatRequest.conversationId);
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
    @RequirePermission(Permission.AI_CHAT)
    @ApiOperation({ summary: 'Streaming de respostas da IA (GET/SSE legado)' })
    streamChat(@Req() req: any, @Param('id') id: string, @Body() chatRequest: ChatRequestDto): Observable<any> {
        return this.aiService.streamChat(req.user.companyId, id, chatRequest.message, chatRequest.history || []);
    }

    @Post('agents/:id/chat-stream')
    @RequirePermission(Permission.AI_CHAT)
    @ApiOperation({ summary: 'Streaming SSE de respostas da IA via POST (token a token)' })
    async streamChatHttp(
        @Req() req: any,
        @Param('id') id: string,
        @Body() chatRequest: ChatRequestDto,
        @Res() res: any,
    ): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // desabilita buffer do nginx
        res.flushHeaders();

        const observable = this.aiService.streamChat(req.user.companyId, id, chatRequest.message, chatRequest.history || []);
        observable.subscribe({
            next: (event: any) => res.write(`data: ${JSON.stringify(event.data)}\n\n`),
            error: (err: any) => {
                res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
                res.end();
            },
            complete: () => res.end(),
        });
    }

    // ========== Models & Usage ==========

    @Get('models')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Listar modelos de IA disponíveis por provider (filtra por configurações da empresa)' })
    async getModels(@Req() req: any) {
        try {
            const models = await this.providerConfigService.getAvailableLLMProviders(req.user.companyId);
            if (!models || models.length === 0) {
                Logger.warn(`Nenhum provider LLM encontrado/disponível para a empresa ${req.user.companyId}`, 'AIController');
            }
            return models;
        } catch (error) {
            Logger.error(`Erro ao buscar modelos LLM para empresa ${req.user.companyId}: ${error.message}`, error.stack, 'AIController');
            throw error;
        }
    }

    @Get('embedding-providers')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Listar providers de embedding disponíveis (filtra por configurações da empresa)' })
    async getEmbeddingProviders(@Req() req: any) {
        try {
            const providers = await this.providerConfigService.getAvailableEmbeddingProviders(req.user.companyId, this.configService);
            if (!providers || providers.length === 0) {
                Logger.warn(`Nenhum provider de embedding encontrado/disponível para a empresa ${req.user.companyId}`, 'AIController');
            }
            return providers;
        } catch (error) {
            Logger.error(`Erro ao buscar providers de embedding para empresa ${req.user.companyId}: ${error.message}`, error.stack, 'AIController');
            throw error;
        }
    }

    @Get('transcription-providers')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Listar providers de transcrição de áudio disponíveis para a empresa' })
    async getTranscriptionProviders(@Req() req: any) {
        return this.providerConfigService.getAvailableTranscriptionProviders(req.user.companyId);
    }

    // ========== Copilot ==========

    @Post('copilot-suggest')
    @RequirePermission(Permission.AI_CHAT)
    @ApiOperation({ summary: 'Gerar sugestões de resposta via Copilot IA' })
    async copilotSuggest(@Req() req: any, @Body() body: { context: string; agentName?: string; contactName?: string }) {
        const suggestions = await this.aiService.copilotSuggest(
            req.user.companyId,
            body.context || '',
            body.agentName || 'Agente',
            body.contactName || 'Cliente',
        );
        return { suggestions };
    }

    @Get('usage')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Obter uso de tokens/IA da empresa' })
    getUsage(@Req() req: any) {
        return this.aiService.getUsage(req.user.companyId);
    }

    @Get('metrics')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Obter métricas detalhadas de uso da IA' })
    async getMetrics(@Req() req: any) {
        return await this.aiService.getDetailedMetrics(req.user.companyId);
    }

    // ========== Multimodal Chat ==========

    @Post('agents/:id/chat-multimodal')
    @RequirePermission(Permission.AI_CHAT)
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

    @Post('agents/:id/chat-with-attachment')
    @RequirePermission(Permission.AI_CHAT)
    @ApiOperation({ summary: 'Interagir com o agente de IA enviando um arquivo (PDF, DOCX, XLSX, XML, TXT, imagens)' })
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }))
    async chatWithAttachment(
        @Param('id') id: string,
        @Body('message') message: string,
        @Body('history') historyRaw: string,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
    ) {
        if (!file) throw new BadRequestException('Arquivo obrigatório.');
        const history = historyRaw ? JSON.parse(historyRaw) : [];
        const response = await this.aiService.chatWithAttachment(req.user.companyId, id, message ?? '', file, history);
        return { response };
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

    // ========== KB Search ==========

    @Post('search')
    @RequirePermission(Permission.AI_READ)
    @ApiOperation({ summary: 'Busca semântica na base de conhecimento de um agente' })
    async searchKnowledge(
        @Req() req: any,
        @Body() body: { query: string; agentId: string; topK?: number },
    ) {
        return this.aiService.searchKnowledge(req.user.companyId, body.agentId, body.query, body.topK || 8);
    }

    @Get('debug-knowledge')
    @Public()
    @ApiOperation({ summary: 'Endpoint provisório para depurar estado da Base de Conhecimento RAG' })
    async debugDataTest() {
        try {
            const listAgents = await (this.aiService as any).prisma.aIAgent.findMany({ select: { id: true, name: true, knowledgeBaseId: true } });
            return listAgents;
        } catch (e) {
            return { error: e.message };
        }
    }
}

