import {
    Injectable, Logger, NotFoundException, BadRequestException,
    ServiceUnavailableException, HttpException, HttpStatus
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { AIMetricsService } from './ai-metrics.service';
import { Observable } from 'rxjs';
import axios from 'axios';
import { OpenAI, toFile } from 'openai';
import { getCircuitBreaker } from '../../common/utils/circuit-breaker';

@Injectable()
export class AIChatService {
    private readonly logger = new Logger(AIChatService.name);

    /** Model routing: downgrade para modelo econômico em queries simples */
    private readonly MODEL_DOWNGRADE: Record<string, string> = {
        'gpt-5.4': 'gpt-5.4-mini',
        'gpt-5.4-mini': 'gpt-5.4-nano',
        'gpt-4o': 'gpt-4o-mini',
        'gpt-4.1': 'gpt-4.1-mini',
        'claude-opus-4-6': 'claude-haiku-4-5',
        'claude-sonnet-4-6': 'claude-haiku-4-5',
        'claude-sonnet-4-20250514': 'claude-haiku-4-5',
        'claude-3-5-sonnet-20241022': 'claude-3-5-haiku-20241022',
        'gemini-2.5-pro': 'gemini-2.5-flash',
        'gemini-2.5-flash': 'gemini-2.5-flash-lite',
        'gemini-1.5-pro': 'gemini-2.0-flash',
        'mistral-large-latest': 'mistral-small-latest',
        'deepseek-reasoner': 'deepseek-chat',
        'cohere:command-r-plus': 'cohere:command-r',
    };

    /** Circuit breaker por provider LLM: 3 falhas → OPEN por 60s */
    private readonly llmCircuitBreaker = getCircuitBreaker('llm', {
        failureThreshold: 3,
        cooldownMs: 60_000,
        timeoutMs: 45_000,
    });

    private semanticCache = new Map<string, { embedding: number[], response: string, timestamp: number }>();
    private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
    private readonly SEMANTIC_CACHE_MAX = 500; // Limite máximo para evitar memory leak

    /** Tamanho máximo de contexto por modelo (em chars ≈ tokens × 3.5) */
    private readonly MODEL_CONTEXT_CHARS: Record<string, number> = {
        'gpt-5.4': 1047576 * 3, 'gpt-5.4-mini': 1047576 * 3, 'gpt-5.4-nano': 1047576 * 3,
        'gpt-5.3-instant': 1047576 * 3, 'o4-mini': 200000 * 3,
        'gpt-4o-mini': 128000 * 3, 'gpt-4o': 128000 * 3, 'o3-mini': 200000 * 3,
        'claude-opus-4-6': 1000000 * 3, 'claude-sonnet-4-6': 1000000 * 3, 'claude-haiku-4-5': 200000 * 3,
        'claude-3-5-sonnet-20241022': 200000 * 3, 'claude-3-5-haiku-20241022': 200000 * 3,
        'gemini-2.5-pro': 1048576 * 3, 'gemini-2.5-flash': 1048576 * 3, 'gemini-2.5-flash-lite': 1048576 * 3,
        'gemini-2.0-flash': 1000000 * 3, 'gemini-1.5-pro': 1000000 * 3,
        'deepseek-chat': 64000 * 3, 'deepseek-reasoner': 64000 * 3,
    };
    private readonly DEFAULT_MAX_CONTEXT_CHARS = 30000;

    constructor(
        private prisma: PrismaService,
        private llmService: LLMService,
        private vectorStoreService: VectorStoreService,
        private providerConfigService: ProviderConfigService,
        private eventEmitter: EventEmitter2,
        private metricsService: AIMetricsService,
    ) { }

    /** Invalida cache semântico + RAG quando a base de conhecimento é atualizada */
    @OnEvent('knowledge.updated')
    handleKnowledgeUpdated(payload: { knowledgeBaseId: string; companyId: string }) {
        const before = this.semanticCache.size;
        this.semanticCache.clear();
        this.vectorStoreService.invalidateRagCache(payload.knowledgeBaseId, payload.companyId);
        this.logger.log(`[Cache] Cache semântico + RAG limpos após atualização da KB ${payload.knowledgeBaseId} (${before} entradas removidas)`);
    }

    /** Detecta o providerId a partir do modelId */
    detectProviderFromModelId(modelId: string): string {
        const prefixMap: Record<string, string> = {
            'groq:': 'groq', 'openrouter:': 'openrouter', 'ollama:': 'ollama',
            'azure:': 'azure', 'together:': 'together', 'lmstudio:': 'lmstudio',
            'perplexity:': 'perplexity', 'xai:': 'xai', 'cohere:': 'cohere',
            'huggingface:': 'huggingface', 'deepseek:': 'deepseek',
        };
        for (const [prefix, providerId] of Object.entries(prefixMap)) {
            if (modelId.startsWith(prefix)) return providerId;
        }
        if (modelId.startsWith('claude')) return 'anthropic';
        if (modelId.startsWith('gemini')) return 'gemini';
        if (modelId.startsWith('deepseek')) return 'deepseek';
        if (modelId.startsWith('mistral') || modelId.startsWith('codestral')) return 'mistral';
        return 'openai';
    }

    /** FASE 3/7 — Compressor de Contexto histórico (com preservação de contexto inicial) */
    compressContext(history: any[], maxMessages = 20) {
        if (!history || history.length === 0) return [];
        const FILLER_WORDS = new Set(['ok', 'obrigado', 'obrigada', 'valeu', 'sim', 'nao', 'não', 'tchau']);
        const compressed = history.filter((h, index) => {
            const text = h.content?.trim()?.toLowerCase() ?? '';
            if (index < history.length - 1 && FILLER_WORDS.has(text)) return false;
            return true;
        });

        const grouped: any[] = [];
        for (const h of compressed) {
            if (grouped.length > 0 && grouped[grouped.length - 1].role === h.role) {
                grouped[grouped.length - 1].content += '\n' + h.content;
            } else {
                grouped.push({ ...h });
            }
        }

        if (grouped.length > maxMessages) {
            return [...grouped.slice(0, 2), ...grouped.slice(-(maxMessages - 2))];
        }
        return grouped;
    }

    private allocateTokenBudget(message: string): { chunkLimit: number } {
        const charCount = message.length;
        const wordCount = message.trim().split(/\s+/).length;
        
        const isFiller = /^(ok|obrigado|obrigada|valeu|sim|n[ãa]o|tchau|pode finalizar.*?)$/i.test(message.trim());
        if (isFiller || charCount < 10) return { chunkLimit: 0 };

        if (charCount > 300 || wordCount > 50) return { chunkLimit: 25 };
        if (charCount > 100 || wordCount > 15) return { chunkLimit: 20 };
        return { chunkLimit: 15 };
    }

    private guardContextOverflow(systemPrompt: string, context: string, history: any[], message: string, modelId: string): string {
        const pureModelId = modelId.includes(':') ? modelId.split(':').pop()! : modelId;
        const maxChars = this.MODEL_CONTEXT_CHARS[pureModelId] ?? this.DEFAULT_MAX_CONTEXT_CHARS;
        const fixedChars = systemPrompt.length + message.length +
            history.reduce((s, h) => s + (h.content?.length || 0), 0);
        const budgetForContext = maxChars * 0.65 - fixedChars;
        if (budgetForContext <= 0) return '';
        if (context.length > budgetForContext) {
            this.logger.warn(`[ContextOverflow] Contexto RAG truncado de ${context.length} para ${budgetForContext} chars (modelo: ${modelId})`);
            return context.substring(0, budgetForContext);
        }
        return context;
    }

    private triggerProgressiveSummarization(
        conversationId: string,
        companyId: string,
        agentId: string,
        history: any[],
        existingSummary?: string,
    ): void {
        setImmediate(async () => {
            try {
                const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
                if (!agent?.isActive) return;

                const modelId = agent.modelId || 'gpt-4o-mini';
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const llmConfig = companyConfigs.get(this.detectProviderFromModelId(modelId));

                const contextText = existingSummary
                    ? `Resumo anterior: ${existingSummary}\n\nMensagens recentes:\n`
                    : 'Mensagens da conversa:\n';
                const historyText = history
                    .slice(-10)
                    .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
                    .join('\n');

                const summary = await this.llmService.generateResponse(
                    modelId,
                    'Você é um assistente que cria resumos concisos de conversas. Responda apenas com o resumo, sem prefixos ou comentários.',
                    `${contextText}${historyText}\n\nResuma os pontos principais desta conversa em no máximo 5 frases.`,
                    [], 0.3, undefined,
                    llmConfig?.apiKey || undefined,
                    llmConfig?.baseUrl || undefined,
                );

                await this.prisma.conversation.updateMany({
                    where: { id: conversationId, companyId },
                    data: { summary, summaryMessageCount: history.length },
                });
                this.logger.log(`[Summarization] Conversa ${conversationId} resumida (${history.length} msgs → ${summary.length} chars)`);
            } catch (e) {
                this.logger.warn(`[Summarization] Falha ao sumarizar conversa ${conversationId}: ${e.message}`);
            }
        });
    }

    private buildRagSystemPrompt(basePrompt: string, context: string): { systemPrompt: string; context: string } {
        if (!context) return { systemPrompt: basePrompt, context };

        const sourceChunks = context.split('\n---\n').map((chunk, index) => {
            const lines = chunk.split('\n').filter(line => line.trim());
            const contentStart = lines[0]?.startsWith('Similaridade') ? 1 : 0;
            return { number: index + 1, content: lines.slice(contentStart).join('\n').trim() };
        }).filter(c => c.content.length > 50);

        const formattedContext = sourceChunks
            .map(c => `[SOURCE_${c.number}]\n${c.content}\n[END_SOURCE_${c.number}]`)
            .join('\n\n');

        const systemPrompt = basePrompt + [
            '',
            '========================================',
            '[BASE DE CONHECIMENTO — FONTE OFICIAL]',
            '========================================',
            '',
            'Os trechos abaixo foram recuperados da base de conhecimento da empresa.',
            'Eles representam a VERDADE OFICIAL para este atendimento.',
            '',
            'REGRAS OBRIGATÓRIAS DE GROUNDING:',
            '1. SEMPRE use as informações dos trechos abaixo como fonte PRIMÁRIA e DEFINITIVA.',
            '2. NUNCA substitua informações dos documentos pelo seu conhecimento geral.',
            '3. Sintetize e integre múltiplos trechos para construir respostas completas e coesas.',
            '4. Se a resposta estiver nos documentos (mesmo parcialmente): use-a, integrando com raciocínio lógico quando necessário.',
            '5. NUNCA invente dados concretos (números, preços, URLs, datas, nomes) que não estejam nos trechos.',
            '6. Só informe que não possui a informação se os trechos realmente não contiverem nada relevante.',
            '7. Responda de forma natural e direta — não cite mecanicamente "[SOURCE_N]" no texto.',
            '8. Trecho com maior relevância (%) tem maior confiabilidade — priorize-os em caso de conflito.',
            '',
            'TRECHOS RECUPERADOS:',
            formattedContext,
            '========================================',
        ].join('\n');

        return { systemPrompt, context: '' }; // context esvaziado para evitar duplicação no llmService
    }

    private async fetchRagContext(
        companyId: string,
        agent: any,
        message: string,
        chunkLimit: number,
        companyConfigs: Map<string, any>,
    ): Promise<string> {
        if (!agent.knowledgeBaseId) return '';

        const kb = await this.prisma.knowledgeBase.findUnique({
            where: { id: agent.knowledgeBaseId },
            select: { language: true, embeddingProvider: true, embeddingModel: true },
        });
        const kbEmbeddingProvider = kb?.embeddingProvider || agent.embeddingProvider || 'native';
        const kbEmbeddingModel = kb?.embeddingModel || agent.embeddingModel || 'all-MiniLM-L6-v2';
        const kbEmbeddingConfig = companyConfigs.get(kbEmbeddingProvider);

        this.logger.debug(`[RAG] Buscando base ${agent.knowledgeBaseId} com provider="${kbEmbeddingProvider}" model="${kbEmbeddingModel}"`);

        const chunks = await this.vectorStoreService.searchSimilarity(
            this.prisma, companyId, message, agent.knowledgeBaseId,
            chunkLimit, kbEmbeddingProvider, kbEmbeddingModel,
            kbEmbeddingConfig?.apiKey || undefined,
            kbEmbeddingConfig?.baseUrl || undefined,
            kb?.language || 'portuguese',
        );

        this.logger.log(`[RAG] ${chunks.length} chunks retornados para contexto na KB ${agent.knowledgeBaseId}.`);

        return chunks.map((c: any, i: number) => {
            const docName = c.metadata?.documentName || c.metadata?.source || c.metadata?.filename || '';
            const page = c.pageNumber ? ` | pág. ${c.pageNumber}` : '';
            const relevance = c.score != null ? ` | relevância: ${Math.round(c.score * 100)}%` : '';
            const prefix = docName ? `[Fonte ${i + 1}: ${docName}${page}${relevance}]\n` : `[Trecho ${i + 1}${relevance}]\n`;
            return `${prefix}${c.content}`;
        }).join('\n---\n');
    }

    /**
     * Motor de Chat Nativo: Usa LangChain com suporte multi-provider.
     */
    async chat(companyId: string, agentId: string, message: string, history: any[] = [], conversationId?: string, systemSuffix?: string) {
        if (!message || message.trim().length === 0) {
            throw new BadRequestException('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);
        history = this.compressContext(history);

        const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
        if (!agent || !agent.isActive) {
            throw new NotFoundException('Agente não encontrado ou inativo');
        }

        try {
            await this.metricsService.checkTokenLimits(companyId, agentId);

            let promptEmbedding: number[] = [];
            try {
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const embeddingProvider = agent.embeddingProvider || 'qwen';
                const embeddingConfig = companyConfigs.get(embeddingProvider);

                promptEmbedding = await this.vectorStoreService.generateEmbedding(
                    message, embeddingProvider, agent.embeddingModel,
                    embeddingConfig?.apiKey || undefined,
                    embeddingConfig?.baseUrl || undefined
                );

                const cacheKeyPrefix = `${companyId}:${agentId}:`;
                for (const [key, cached] of this.semanticCache.entries()) {
                    if (key.startsWith(cacheKeyPrefix)) {
                        if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) { this.semanticCache.delete(key); continue; }
                        if (this.vectorStoreService.cosineSimilarity(promptEmbedding, cached.embedding) > 0.92) {
                            this.logger.log(`[Cache HIT] Similarity > 0.92 para agente ${agent.name}`);
                            return cached.response;
                        }
                    }
                }
            } catch (error) {
                this.logger.debug(`[Cache Skip] Falha ao verificar cache semântico: ${error.message}`);
            }

            const budget = this.allocateTokenBudget(message);
            let finalModelId = agent.modelId || 'gpt-4o-mini';

            if (agent.allowModelDowngrade && budget.chunkLimit <= 10 && this.MODEL_DOWNGRADE[finalModelId]) {
                const downgraded = this.MODEL_DOWNGRADE[finalModelId];
                this.logger.debug(`[ModelRouting] Downgrade: ${finalModelId} → ${downgraded}`);
                finalModelId = downgraded;
            }

            this.logger.log(`Chat "${agent.name}" | modelo: ${finalModelId} | chunks: ${budget.chunkLimit}`);

            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const providerId = this.detectProviderFromModelId(finalModelId);
            const llmConfig = companyConfigs.get(providerId);

            if (!llmConfig && providerId !== 'ollama' && providerId !== 'lmstudio') {
                this.logger.warn(`[Chat] Configuração ausente para provider '${providerId}' (empresa: ${companyId})`);
                throw new BadRequestException(`O provider '${providerId}' não está configurado ou habilitado. Configure em Configurações > IA & Modelos.`);
            }

            let conversationSummary: string | undefined;
            if (conversationId) {
                const conv = await this.prisma.conversation.findFirst({
                    where: { id: conversationId, companyId },
                    select: { summary: true, summaryMessageCount: true },
                });
                conversationSummary = conv?.summary ?? undefined;
            }

            let rawContext = await this.fetchRagContext(companyId, agent, message, budget.chunkLimit, companyConfigs);
            rawContext = this.guardContextOverflow(agent.prompt || '', rawContext, history, message, finalModelId);

            let systemPrompt = conversationSummary
                ? `${agent.prompt || 'Você é um assistente virtual prestativo.'}\n\n[Resumo da conversa até agora]: ${conversationSummary}`
                : (agent.prompt || 'Você é um assistente virtual prestativo.');

            if (systemSuffix) systemPrompt += `\n\n${systemSuffix}`;

            const { systemPrompt: finalSystemPrompt, context } = this.buildRagSystemPrompt(systemPrompt, rawContext);

            const response = await this.llmCircuitBreaker.exec(() =>
                this.llmService.generateResponse(
                    finalModelId, finalSystemPrompt, message,
                    history.map(h => ({
                        role: (h.role === 'user' || h.role === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
                        content: h.content,
                    })),
                    agent.temperature || 0.7,
                    context,
                    llmConfig?.apiKey || undefined,
                    llmConfig?.baseUrl || undefined,
                )
            );

            if (conversationId && history.length >= 15) {
                this.triggerProgressiveSummarization(conversationId, companyId, agentId, history, conversationSummary);
            }

            if (promptEmbedding.length > 0) {
                const newCacheKey = `${companyId}:${agentId}:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > this.SEMANTIC_CACHE_MAX) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            this.metricsService.trackTokenUsage(companyId, finalModelId, agent.prompt || '', context, history, response, 0).catch((e) => {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            });

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat: ${error.message}`, error.stack);
            if (error?.status && error?.response) throw error;
            const msg = error?.message || 'Erro interno ao processar mensagem';
            throw new ServiceUnavailableException(
                `Falha ao processar resposta da IA: ${msg}. Verifique se a API Key e o modelo estão corretos em Configurações → IA & Modelos.`
            );
        }
    }

    /** Chat multimodal com suporte a imagens */
    async chatMultimodal(companyId: string, agentId: string, message: string, imageUrls: string[] = [], history: any[] = []) {
        if (!message || message.trim().length === 0) {
            throw new BadRequestException('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);
        history = this.compressContext(history);

        if (imageUrls.length > 5) {
            throw new BadRequestException('Máximo de 5 imagens por requisição');
        }

        const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
        if (!agent || !agent.isActive) {
            throw new NotFoundException('Agente não encontrado ou inativo');
        }

        await this.metricsService.checkTokenLimits(companyId, agentId);

        try {
            let promptEmbedding: number[] = [];
            if (imageUrls.length === 0) {
                try {
                    promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'qwen');
                    const cacheKeyPrefix = `${companyId}:${agentId}-mm:`;
                    for (const [key, cached] of this.semanticCache.entries()) {
                        if (key.startsWith(cacheKeyPrefix)) {
                            if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) { this.semanticCache.delete(key); continue; }
                            if (this.vectorStoreService.cosineSimilarity(promptEmbedding, cached.embedding) > 0.92) {
                                this.logger.log(`[Cache HIT] Semantic similarity > 0.92 (MM) para agente ${agent.name}`);
                                return cached.response;
                            }
                        }
                    }
                } catch { }
            }

            const budget = this.allocateTokenBudget(message);
            let finalModelId = agent.modelId || 'gpt-4o-mini';

            this.logger.log(`Chat multimodal com agente "${agent.name}" usando modelo: ${finalModelId} | Budget limit: ${budget.chunkLimit}`);

            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmProviderId = this.detectProviderFromModelId(finalModelId);
            const llmConfig = companyConfigs.get(llmProviderId);

            const response = await this.llmService.generateMultimodalResponse(
                finalModelId,
                agent.prompt || 'Você é um assistente virtual prestativo.',
                message,
                imageUrls,
                history.map(h => ({
                    role: h.role === 'user' || h.role === 'client' ? 'user' : 'assistant',
                    content: h.content
                })),
                agent.temperature || 0.7,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            if (promptEmbedding.length > 0 && imageUrls.length === 0) {
                const newCacheKey = `${companyId}:${agentId}-mm:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > this.SEMANTIC_CACHE_MAX) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            this.metricsService.trackTokenUsage(companyId, finalModelId, agent.prompt || '', '', history, response, imageUrls.length).catch((e) => {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            });

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat multimodal: ${error.message}`, error.stack);
            if (error?.status && error?.response) throw error;
            const msg = error?.message || 'Erro interno ao processar mensagem';
            throw new ServiceUnavailableException(
                `Falha ao processar resposta multimodal: ${msg}. Verifique se o modelo suporta imagens e a API Key está correta.`
            );
        }
    }

    /**
     * Streaming real de respostas via SSE.
     */
    streamChat(companyId: string, agentId: string, message: string, history: any[] = []): Observable<any> {
        if (!message || message.trim().length === 0) throw new BadRequestException('Mensagem não pode ser vazia');
        if (message.length > 4000) message = message.substring(0, 4000);
        history = this.compressContext(history);

        return new Observable<{ data: { type: string; content: string } }>(observer => {
            observer.next({ data: { type: 'start', content: '' } });

            (async () => {
                const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
                if (!agent || !agent.isActive) throw new NotFoundException('Agente não encontrado ou inativo');

                await this.metricsService.checkTokenLimits(companyId);

                let promptEmbedding: number[] = [];
                try {
                    promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'qwen');
                    const cacheKeyPrefix = `${companyId}:${agentId}:`;
                    for (const [key, cached] of this.semanticCache.entries()) {
                        if (key.startsWith(cacheKeyPrefix)) {
                            if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) { this.semanticCache.delete(key); continue; }
                            if (this.vectorStoreService.cosineSimilarity(promptEmbedding, cached.embedding) > 0.92) {
                                this.logger.log(`[Cache HIT/Stream] Similarity > 0.92 para agente ${agent.name}`);
                                observer.next({ data: { type: 'chunk', content: cached.response } });
                                observer.next({ data: { type: 'end', content: '' } });
                                observer.complete();
                                return;
                            }
                        }
                    }
                } catch { /* falha silenciosa: avança sem cache */ }

                const budget = this.allocateTokenBudget(message);
                let finalModelId = agent.modelId || 'gpt-4o-mini';

                if (agent.allowModelDowngrade && budget.chunkLimit <= 10 && this.MODEL_DOWNGRADE[finalModelId]) {
                    finalModelId = this.MODEL_DOWNGRADE[finalModelId];
                }

                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const providerId = this.detectProviderFromModelId(finalModelId);
                const llmConfig = companyConfigs.get(providerId);

                if (!llmConfig && providerId !== 'ollama' && providerId !== 'lmstudio') {
                    throw new BadRequestException(`Provider '${providerId}' não configurado.`);
                }

                const rawContext = await this.fetchRagContext(companyId, agent, message, budget.chunkLimit, companyConfigs);
                const guardedContext = this.guardContextOverflow(agent.prompt || '', rawContext, history, message, finalModelId);

                const basePrompt = agent.prompt || 'Você é um assistente virtual prestativo.';
                const { systemPrompt: streamSystemPrompt, context } = this.buildRagSystemPrompt(basePrompt, guardedContext);

                const formattedHistory = history.map(h => ({
                    role: (h.role === 'user' || h.role === 'client' ? 'user' : 'assistant') as 'user' | 'assistant',
                    content: h.content,
                }));

                let fullResponse = '';
                for await (const token of this.llmService.streamResponse(
                    finalModelId, streamSystemPrompt, message, formattedHistory,
                    agent.temperature || 0.7, context,
                    llmConfig?.apiKey || undefined,
                    llmConfig?.baseUrl || undefined,
                )) {
                    fullResponse += token;
                    observer.next({ data: { type: 'chunk', content: token } });
                }

                if (promptEmbedding.length > 0 && fullResponse) {
                    const cacheKey = `${companyId}:${agentId}:${Date.now()}`;
                    this.semanticCache.set(cacheKey, { embedding: promptEmbedding, response: fullResponse, timestamp: Date.now() });
                    if (this.semanticCache.size > this.SEMANTIC_CACHE_MAX) {
                        const firstKey = this.semanticCache.keys().next().value;
                        if (firstKey) this.semanticCache.delete(firstKey);
                    }
                }

                this.metricsService.trackTokenUsage(companyId, finalModelId, agent.prompt || '', context, history, fullResponse, 0).catch((e) => {
                    this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
                });

                observer.next({ data: { type: 'end', content: '' } });
                observer.complete();
            })().catch(error => {
                this.logger.error(`Erro no streamChat: ${error.message}`);
                observer.next({ data: { type: 'error', content: error.message } });
                observer.complete();
            });
        });
    }

    // ── Extração de texto de arquivo anexado ──────────────────────────────────

    async extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
        const ext = (filename.split('.').pop() ?? '').toLowerCase();
        const MAX = 15000;
        let text = '';

        try {
            if (ext === 'pdf') {
                const pdfParse = require('pdf-parse');
                const data = await pdfParse(buffer);
                text = data.text ?? '';
            } else if (ext === 'docx') {
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ buffer });
                text = result.value ?? '';
            } else if (ext === 'xlsx' || ext === 'xls') {
                const XLSX = require('xlsx');
                const wb = XLSX.read(buffer, { type: 'buffer' });
                const parts: string[] = [];
                for (const name of wb.SheetNames) {
                    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
                    if (!rows.length) continue;
                    const [header, ...data] = rows;
                    parts.push(`=== ${name} ===`);
                    parts.push(...data.map((r: any[]) =>
                        (header as any[]).map((h, i) => `${h || 'Col' + (i + 1)}: ${r[i] ?? ''}`).join(' | ')
                    ));
                }
                text = parts.join('\n');
            } else if (ext === 'xml' || ext === 'xsd') {
                text = this.xmlToReadableText(buffer.toString('utf-8'), ext === 'xsd');
            } else {
                text = buffer.toString('utf-8');
            }
        } catch (e: any) {
            throw new HttpException(
                `Não foi possível ler o arquivo: ${e.message}`,
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }

        text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        if (text.length > MAX) {
            text = text.substring(0, MAX) + '\n[... texto truncado — arquivo muito grande ...]';
        }
        return text;
    }

    private xmlToReadableText(xml: string, isSchema = false): string {
        let src = xml
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
            .replace(/<\?xml[^>]*\?>/g, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        const getLocal = (tag: string) => tag.includes(':') ? tag.split(':').pop()! : tag;
        const decode = (s: string) => s
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

        if (isSchema) {
            const pairs: string[] = ['=== Schema XSD ==='];
            const nameRe = /<xsd?:element\s[^>]*\bname="([^"]+)"/gi;
            const annotRe = /<xsd?:annotation>([\s\S]*?)<\/xsd?:annotation>/gi;
            const found = new Set<string>();
            let m: RegExpExecArray | null;
            while ((m = nameRe.exec(src)) !== null) {
                const name = m[1].trim();
                if (!found.has(name)) { found.add(name); pairs.push(name); }
            }
            while ((m = annotRe.exec(src)) !== null) {
                const docMatch = m[1].match(/<xsd?:documentation[^>]*>([\s\S]*?)<\/xsd?:documentation>/i);
                if (!docMatch) continue;
                const doc = decode(docMatch[1].replace(/\s+/g, ' ').trim());
                const before = src.substring(Math.max(0, m.index - 400), m.index);
                const prev = [...before.matchAll(/<xsd?:element\s[^>]*\bname="([^"]+)"/gi)].pop();
                if (prev && doc) pairs.push(`${prev[1]}: ${doc}`);
            }
            return pairs.join('\n');
        }

        const SECTION_DEPTHS = new Set([2, 3]);
        const stack: string[] = [];
        const sibCount = new Map<string, number>();
        const sections: Array<{ label: string; lines: string[]; depth: number }> = [];
        const activeSectionAtDepth = new Map<number, number>();
        let curSectionIdx = -1;

        const re2 = /<(\/?)(?:[A-Za-z_][\w.]*:)?([A-Za-z_][\w.]*)([^>]*)>|([^<]+)/g;
        let m: RegExpExecArray | null;

        while ((m = re2.exec(src)) !== null) {
            if (m[4] !== undefined) {
                const text = m[4].replace(/\s+/g, ' ').trim();
                if (!text || curSectionIdx < 0) continue;
                const val = decode(text);
                const curSec = sections[curSectionIdx];
                const pathAfterRoot = stack.slice(1);
                const leaf = pathAfterRoot[pathAfterRoot.length - 1];
                const ancestorsAfterSection = pathAfterRoot.slice(curSec.depth - 1, -1);
                const prefix = ancestorsAfterSection.slice(-2).join('/');
                curSec.lines.push(`${prefix ? prefix + '/' : ''}${leaf}: ${val}`);
            } else {
                const isClose = m[1] === '/';
                const name = getLocal(m[2]);
                const selfClose = m[3].trim().endsWith('/');
                if (!isClose) {
                    const depth = stack.length + 1;
                    const parentTag = stack[stack.length - 1] ?? '_';
                    const sk = `${parentTag}:${name}`;
                    const idx = (sibCount.get(sk) || 0) + 1;
                    sibCount.set(sk, idx);
                    if (SECTION_DEPTHS.has(depth)) {
                        const label = idx > 1 ? `${name} ${idx}` : name;
                        curSectionIdx = sections.length;
                        sections.push({ label, lines: [], depth });
                        activeSectionAtDepth.set(depth, curSectionIdx);
                    }
                    if (!selfClose) stack.push(name);
                } else {
                    stack.pop();
                    const parentDepth = stack.length;
                    let found = -1;
                    for (let d = parentDepth; d >= 1; d--) {
                        const si = activeSectionAtDepth.get(d);
                        if (si !== undefined) { found = si; break; }
                    }
                    curSectionIdx = found;
                }
            }
        }

        const outputLines: string[] = [];
        for (const sec of sections) {
            if (!sec.lines.length) continue;
            outputLines.push(`\n[${sec.label}]`);
            const deduped: string[] = [];
            for (const l of sec.lines) {
                if (deduped[deduped.length - 1] !== l) deduped.push(l);
            }
            outputLines.push(...deduped);
        }
        return outputLines.join('\n').trim()
            || src.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /** Chat com arquivo anexado — sem persistência de arquivo, processado em memória. */
    async chatWithAttachment(
        companyId: string,
        agentId: string,
        message: string,
        file: Express.Multer.File,
        history: any[] = [],
    ): Promise<string> {
        const IMAGES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
        const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();

        if (IMAGES.has(ext)) {
            const mime = file.mimetype || `image/${ext}`;
            const dataUri = `data:${mime};base64,${file.buffer.toString('base64')}`;
            return this.chatMultimodal(companyId, agentId, message || 'Analise esta imagem.', [dataUri], history);
        }

        const text = await this.extractTextFromFile(file.buffer, file.originalname);
        const augmented = `[ARQUIVO ANEXADO: ${file.originalname}]\n${text}\n\n${message || 'Analise o arquivo acima.'}`;
        return this.chat(companyId, agentId, augmented, history);
    }

    async transcribeAudio(mediaUrl: string, companyId?: string) {
        try {
            let whisperBaseUrl: string | null = null;
            let openAiKey: string | null = process.env.OPENAI_API_KEY || null;

            if (companyId) {
                const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
                const localConfig = companyConfigs.get('whisper-local');
                if (localConfig?.baseUrl) whisperBaseUrl = localConfig.baseUrl;
                const openaiConfig = companyConfigs.get('openai');
                if (openaiConfig?.apiKey) openAiKey = openaiConfig.apiKey;
            }

            if (!whisperBaseUrl) whisperBaseUrl = process.env.WHISPER_BASE_URL || null;

            if (!whisperBaseUrl && !openAiKey) {
                this.logger.warn('Transcrição indisponível: configure WHISPER_BASE_URL (local) ou OPENAI_API_KEY nas configurações.');
                return "[Serviço de transcrição indisponível — configure um provider de transcrição]";
            }

            this.logger.log(`Transcrevendo áudio via Whisper (${whisperBaseUrl ? 'LOCAL: ' + whisperBaseUrl : 'OpenAI API'}): ${mediaUrl}`);

            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);

            const openai = new OpenAI({
                apiKey: openAiKey || 'local-no-key-required',
                ...(whisperBaseUrl ? { baseURL: whisperBaseUrl } : {}),
            });

            const ext = mediaUrl.split('.').pop()?.toLowerCase() || 'ogg';
            const nativeExts = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
            const localExts = [...nativeExts, 'opus', 'oga', 'aac', 'amr', '3gp', '3gpp', 'flac'];
            const supportedExts = whisperBaseUrl ? localExts : nativeExts;
            const finalExt = supportedExts.includes(ext) ? ext : 'ogg';

            const file = await toFile(audioBuffer, `audio.${finalExt}`);
            const model = process.env.WHISPER_MODEL || (whisperBaseUrl ? 'medium' : 'whisper-1');

            const transcription = await openai.audio.transcriptions.create({
                file,
                model,
                language: 'pt',
                response_format: 'text',
            });

            const text = typeof transcription === 'string' ? transcription : (transcription as any).text;
            return text || null;
        } catch (error) {
            this.logger.error(`Erro na transcrição de áudio: ${error.message}`);
            return "[Erro na transcrição automática do áudio]";
        }
    }

    /**
     * Gera uma transcrição (descrição em texto) para uma imagem usando o LLM Multimodal.
     * Útil para injetar no histórico (RAG) e dar contexto visual às conversas.
     * Caso o modelo principal do agente não suporte visão (ex: DeepSeek), busca
     * automaticamente qualquer outro provider vision disponível na empresa (OpenAI/Gemini).
     */
    async describeImage(companyId: string, agentId: string, base64Image: string): Promise<string> {
        const { isMultimodalModel } = await import('./engine/llm-provider.factory');
        
        try {
            const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, companyId } });
            if (!agent || !agent.isActive) return '[Imagem sem descrição]';

            const originalModelId = agent.modelId || 'gpt-4o-mini';
            let modelId = originalModelId;
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);

            // 1. Verifica se o modelo atual suporta visão
            let llmProviderId = this.detectProviderFromModelId(modelId);
            let llmConfig = companyConfigs.get(llmProviderId);

            if (!isMultimodalModel(modelId)) {
                this.logger.warn(`Modelo ${modelId} não é multimodal. Imagem ignorada pela IA na empresa ${companyId}.`);
                return '[O modelo de IA atual não possui suporte a visão. Imagem ignorada.]';
            }

            const prompt = "Descreva de forma detalhada o que tem nesta imagem enviada pelo cliente. Sua resposta será salva no histórico da conversa como memória visual para te ajudar. Evite enrolação, descreva o conteúdo objetivamente.";
            
            const response = await this.llmService.generateMultimodalResponse(
                modelId,
                'Você é um assistente especialista em visão computacional.',
                prompt,
                [base64Image],
                [],
                0.3,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            return response || '[Imagem analisada, mas sem descrição detalhada gerada]';
        } catch (error) {
            this.logger.error(`Erro ao descrever imagem: ${error.message}`);
            return '[Erro ao analisar o conteúdo da imagem]';
        }
    }
}
