import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AIChatService } from './ai-chat.service';
import { AIMetricsService } from './ai-metrics.service';

/**
 * AIService — orquestrador público.
 *
 * Responsabilidades:
 *  - CRUD de AIAgent
 *  - Delegação para AIChatService (chat, stream, multimodal, attachment, transcribe)
 *  - Delegação para AIMetricsService (usage, metrics)
 *  - Funções analíticas: summarize, analyzeSentiment, copilotSuggest
 *  - RAG direto: queryKnowledgeBase, searchKnowledge
 */
@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    constructor(
        private prisma: PrismaService,
        private llmService: LLMService,
        private vectorStoreService: VectorStoreService,
        private providerConfigService: ProviderConfigService,
        private chatService: AIChatService,
        private metricsService: AIMetricsService,
    ) { }

    // ── Agent CRUD ────────────────────────────────────────────────────────────

    async createAgent(companyId: string, data: CreateAIAgentDto) {
        return this.prisma.aIAgent.create({
            data: { ...data, companyId, embedId: uuidv4() }
        });
    }

    async findAllAgents(companyId: string) {
        return this.prisma.aIAgent.findMany({ where: { companyId } });
    }

    async findOneAgent(companyId: string, id: string) {
        return this.prisma.aIAgent.findFirst({ where: { id, companyId } });
    }

    async updateAgent(companyId: string, id: string, data: UpdateAIAgentDto) {
        const agent = await this.findOneAgent(companyId, id);
        if (!agent) throw new NotFoundException('Agente não encontrado');

        const updateData = { ...data };
        if (!agent.embedId) (updateData as any).embedId = uuidv4();

        return this.prisma.aIAgent.update({ where: { id }, data: updateData });
    }

    async removeAgent(companyId: string, id: string) {
        return this.prisma.aIAgent.deleteMany({ where: { id, companyId } });
    }

    // ── Chat delegation ───────────────────────────────────────────────────────

    chat(companyId: string, agentId: string, message: string, history: any[] = [], conversationId?: string, systemSuffix?: string) {
        return this.chatService.chat(companyId, agentId, message, history, conversationId, systemSuffix);
    }

    chatMultimodal(companyId: string, agentId: string, message: string, imageUrls: string[] = [], history: any[] = []) {
        return this.chatService.chatMultimodal(companyId, agentId, message, imageUrls, history);
    }

    streamChat(companyId: string, agentId: string, message: string, history: any[] = []): Observable<any> {
        return this.chatService.streamChat(companyId, agentId, message, history);
    }

    chatWithAttachment(companyId: string, agentId: string, message: string, file: Express.Multer.File, history: any[] = []) {
        return this.chatService.chatWithAttachment(companyId, agentId, message, file, history);
    }

    transcribeAudio(mediaUrl: string, companyId?: string) {
        return this.chatService.transcribeAudio(mediaUrl, companyId);
    }

    describeImage(companyId: string, agentId: string, base64Image: string) {
        return this.chatService.describeImage(companyId, agentId, base64Image);
    }

    // ── Usage delegation ──────────────────────────────────────────────────────

    getUsage(companyId: string) {
        return this.metricsService.getUsage(companyId);
    }

    getDetailedMetrics(companyId: string) {
        return this.metricsService.getDetailedMetrics(companyId);
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    async summarize(companyId: string, agentId: string, messages: any[]) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const conversation = messages.map(m => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');
        const modelId = agent.modelId || 'gpt-4o-mini';

        try {
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmConfig = companyConfigs.get(this.chatService.detectProviderFromModelId(modelId));
            return await this.llmService.generateResponse(
                modelId,
                'Você é um assistente encarregado de resumir conversas de suporte técnico.',
                `Resuma a seguinte conversa de forma concisa em no máximo 3 frases:\n\n${conversation}`,
                [], 0.3, undefined,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );
        } catch (error) {
            this.logger.error(`Erro ao gerar resumo: ${error.message}`);
            return null;
        }
    }

    async analyzeSentiment(companyId: string, agentId: string, content: string) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const prompt = `Analise o sentimento da seguinte conversa e responda APENAS um JSON: {"sentiment": "POSITIVE|NEUTRAL|NEGATIVE", "score": 0.0-10.0, "justification": "breve explicação"}:\n\n"${content}"`;
        const modelId = agent.modelId || 'gpt-4o-mini';

        try {
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmConfig = companyConfigs.get(this.chatService.detectProviderFromModelId(modelId));
            const aiResponse = await this.llmService.generateResponse(
                modelId,
                'Você é um analista de sentimentos especialista em CX.',
                prompt, [], 0, undefined,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            const jsonMatch = aiResponse.match(/\{.*\}/s);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            return { sentiment: 'NEUTRAL', score: 5.0, justification: aiResponse };
        } catch (error) {
            this.logger.error(`Erro na análise sentimental: ${error.message}`);
            return null;
        }
    }

    /** Copilot: gera sugestões de resposta para o atendente. */
    async copilotSuggest(companyId: string, context: string, agentName: string, contactName: string): Promise<string[]> {
        const agent = await this.prisma.aIAgent.findFirst({ where: { companyId, isActive: true } });

        const modelId = agent?.modelId || 'gpt-4o-mini';
        const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
        const providerId = modelId.includes(':') ? modelId.split(':')[0] : modelId.split('-')[0];
        const providerConfig = companyConfigs.get(providerId) || companyConfigs.get('openai');

        const systemPrompt = `Você é um assistente de atendimento ao cliente. Sua tarefa é sugerir respostas profissionais e empáticas para o atendente "${agentName}" responder ao cliente "${contactName}". Baseie-se no histórico da conversa fornecido. Responda APENAS com um JSON array de 2-3 strings curtas (máx 200 chars cada), sem explicações extras. Exemplo: ["Sugestão 1", "Sugestão 2"]`;
        const userMessage = `Histórico da conversa:\n${context}\n\nGere 2-3 sugestões de resposta para o atendente enviar agora.`;

        try {
            const raw = await this.llmService.generateResponse(modelId, systemPrompt, userMessage, [], 0.7, '', providerConfig?.apiKey);
            const match = raw.match(/\[[\s\S]*?\]/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed)) return parsed.slice(0, 3).map(String);
            }
            return raw.split('\n').filter(l => l.trim().length > 5).slice(0, 3);
        } catch (err) {
            this.logger.error(`[Copilot] Erro ao gerar sugestões: ${err.message}`);
            return [];
        }
    }

    // ── RAG direto ────────────────────────────────────────────────────────────

    async queryKnowledgeBase(
        companyId: string,
        agentId: string,
        query: string,
        knowledgeBaseId: string,
        options?: { maxChunks?: number; minScore?: number; temperature?: number }
    ): Promise<{ response: string; sources: any[]; usage?: any }> {
        const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
        if (!agent) throw new NotFoundException('Agente não encontrado');

        const kb = await this.prisma.knowledgeBase.findUnique({
            where: { id: knowledgeBaseId },
            select: { language: true, embeddingProvider: true, embeddingModel: true },
        });
        const kbEmbeddingProvider = kb?.embeddingProvider || agent.embeddingProvider || 'native';
        const kbEmbeddingModel = kb?.embeddingModel || agent.embeddingModel || 'all-MiniLM-L6-v2';

        const relevantChunks = await this.vectorStoreService.searchSimilarity(
            this.prisma, companyId, query, knowledgeBaseId,
            options?.maxChunks || 5, kbEmbeddingProvider, kbEmbeddingModel,
            undefined, undefined, kb?.language || 'portuguese'
        );

        const filteredChunks = options?.minScore
            ? relevantChunks.filter(chunk => chunk.score >= (options.minScore || 0.3))
            : relevantChunks;

        if (filteredChunks.length === 0) {
            return {
                response: "Não encontrei informações relevantes na base de conhecimento para responder a essa pergunta.",
                sources: [],
                usage: { inputTokens: query.length, outputTokens: 0 }
            };
        }

        const context = filteredChunks.map((chunk, index) =>
            `Fonte ${index + 1} (Similaridade: ${(chunk.score * 100).toFixed(1)}%):\n${chunk.content}`
        ).join('\n\n---\n\n');

        const enhancedPrompt = `Você é um assistente especializado que responde perguntas com base na base de conhecimento fornecida.\n\nInstruções:\n- Use APENAS as informações contidas no contexto abaixo para responder\n- Se a resposta não estiver no contexto, diga que não encontrou informações suficientes\n- Cite as fontes quando possível\n- Seja conciso e direto, mas forneça detalhes relevantes\n\nContexto da base de conhecimento:\n${context}\n\nPergunta: ${query}\n\nResposta:`;

        try {
            const response = await this.chat(companyId, agentId, enhancedPrompt, []);
            return {
                response,
                sources: filteredChunks,
                usage: { inputTokens: enhancedPrompt.length, outputTokens: response.length, contextChunks: filteredChunks.length }
            };
        } catch (error) {
            this.logger.error(`Erro ao consultar base de conhecimento: ${error.message}`);
            throw error;
        }
    }

    async searchKnowledge(companyId: string, agentId: string, query: string, topK = 8) {
        const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
        if (!agent) throw new NotFoundException('Agente não encontrado');
        if (!agent.knowledgeBaseId) return { results: [], message: 'Agente sem base de conhecimento configurada.' };

        const kb = await this.prisma.knowledgeBase.findFirst({ where: { id: agent.knowledgeBaseId, companyId } });
        if (!kb) return { results: [], message: 'Base de conhecimento não encontrada.' };

        try {
            const chunks = await this.vectorStoreService.searchSimilarity(
                this.prisma, companyId, query, agent.knowledgeBaseId, topK,
                kb.embeddingProvider || 'qwen', kb.embeddingModel || undefined,
            );

            const results = await Promise.all(chunks.map(async (chunk) => {
                const doc = await this.prisma.document.findUnique({
                    where: { id: chunk.metadata?.documentId || '' },
                    select: { title: true, sourceType: true, createdAt: true },
                }).catch(() => null);

                return {
                    id: chunk.id,
                    content: chunk.content,
                    score: chunk.score,
                    title: doc?.title || 'Documento',
                    sourceType: doc?.sourceType || 'TEXT',
                    createdAt: doc?.createdAt,
                };
            }));

            return { results, kbName: kb.name };
        } catch (err: any) {
            this.logger.error(`searchKnowledge error: ${err.message}`);
            return { results: [], message: 'Erro ao executar busca semântica.' };
        }
    }
}
