import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { LLMService } from './engine/llm.service';
import { VectorStoreService } from './engine/vector-store.service';
import { ProviderConfigService } from '../settings/provider-config.service';
import { Observable } from 'rxjs';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);

    constructor(
        private prisma: PrismaService,
        private llmService: LLMService,
        private vectorStoreService: VectorStoreService,
        private providerConfigService: ProviderConfigService,
    ) { }

    // AIAgent CRUD
    async createAgent(companyId: string, data: CreateAIAgentDto) {
        return (this.prisma as any).aIAgent.create({
            data: {
                ...data,
                companyId
            }
        });
    }

    async findAllAgents(companyId: string) {
        return (this.prisma as any).aIAgent.findMany({
            where: { companyId }
        });
    }

    async findOneAgent(companyId: string, id: string) {
        return (this.prisma as any).aIAgent.findFirst({
            where: { id, companyId }
        });
    }

    async updateAgent(companyId: string, id: string, data: UpdateAIAgentDto) {
        // Verifica que o agente pertence à empresa antes de atualizar
        const agent = await this.findOneAgent(companyId, id);
        if (!agent) throw new Error('Agente não encontrado');

        return (this.prisma as any).aIAgent.update({
            where: { id },
            data
        });
    }

    async removeAgent(companyId: string, id: string) {
        return (this.prisma as any).aIAgent.deleteMany({
            where: { id, companyId }
        });
    }

    private semanticCache = new Map<string, { embedding: number[], response: string, timestamp: number }>();

    /** FASE 3/7 - Compressor de Contexto histórico */
    private compressContext(history: any[]) {
        if (!history || history.length === 0) return [];
        let compressed = history.filter((h, index) => {
            const text = h.content?.trim().toLowerCase();
            // Remove lixos/mensagens curtas inúteis (salvo se for a última que ele acabou de enviar)
            if (index < history.length - 1 && ['ok', 'obrigado', 'obrigada', 'valeu', 'sim', 'nao', 'não', 'tchau'].includes(text)) return false;
            return true;
        });

        // Agrupa mensagens consecutivas para economizar quebras estruturais do LLM
        const grouped = [];
        for (const h of compressed) {
            if (grouped.length > 0 && grouped[grouped.length - 1].role === h.role) {
                grouped[grouped.length - 1].content += '\n' + h.content;
            } else {
                grouped.push({ ...h });
            }
        }
        return grouped;
    }

    /** FASE 4 - Determina os limites de uso baseados na complexidade */
    private allocateTokenBudget(message: string): { chunkLimit: number, modelTier: string } {
        const charCount = message.length;
        if (charCount > 200 || message.split(' ').length > 40) {
            return { chunkLimit: 10, modelTier: 'complex' };
        }
        if (charCount > 50) {
            return { chunkLimit: 5, modelTier: 'medium' };
        }
        return { chunkLimit: 2, modelTier: 'simple' };
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Verifica limites de tokens da empresa (hora, dia, total).
     * Lança ForbiddenException se algum limite for atingido.
     */
    private async checkTokenLimits(companyId: string) {
        const company = await (this.prisma as any).company.findUnique({
            where: { id: companyId },
            select: { limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
        });

        if (!company) return;

        const now = new Date();
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        const [hourlyUsage, dailyUsage, totalTokens] = await Promise.all([
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfHour } },
                _sum: { tokens: true }
            }),
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId, createdAt: { gte: startOfDay } },
                _sum: { tokens: true }
            }),
            (this.prisma as any).aIUsage.aggregate({
                where: { companyId },
                _sum: { tokens: true }
            }),
        ]);

        const hourlyTokens = hourlyUsage._sum.tokens || 0;
        const dailyTokens = dailyUsage._sum.tokens || 0;
        const totalTokensUsed = totalTokens._sum.tokens || 0;

        if (company.limitTokensPerHour > 0 && hourlyTokens >= company.limitTokensPerHour) {
            throw new ForbiddenException(`Limite de tokens por hora atingido (${company.limitTokensPerHour}). Tente novamente mais tarde.`);
        }
        if (company.limitTokensPerDay > 0 && dailyTokens >= company.limitTokensPerDay) {
            throw new ForbiddenException(`Limite de tokens por dia atingido (${company.limitTokensPerDay}). Tente novamente amanhã.`);
        }
        if (company.limitTokens > 0 && totalTokensUsed >= company.limitTokens) {
            throw new ForbiddenException(`Limite total de tokens de IA atingido (${company.limitTokens}). Entre em contato com o suporte.`);
        }
    }

    /**
     * Motor de Chat Nativo: Usa LangChain com suporte multi-provider.
     */
    async chat(companyId: string, agentId: string, message: string, history: any[] = []) {
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);

        // Fase 3 e 7: Compressor de Contexto
        history = this.compressContext(history);
        if (history.length > 20) history = history.slice(-20);

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new Error('Agente não encontrado ou inativo');
        }

        await this.checkTokenLimits(companyId);

        try {
            // Fase 5: Semantic Cache (Interceptação por Vector)
            let promptEmbedding: number[] = [];
            try {
                promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'native');
                const cacheKeyPrefix = `${companyId}:${agentId}`;
                for (const [key, cached] of this.semanticCache.entries()) {
                    if (key.startsWith(cacheKeyPrefix)) {
                        if (this.cosineSimilarity(promptEmbedding, cached.embedding) > 0.95) {
                            this.logger.log(`[Cache HIT] Semantic similarity > 0.95 abortando geração para agente ${agent.name}`);
                            return cached.response;
                        }
                    }
                }
            } catch (err) {
                // Caso falhe nativo, apenas avança.
            }

            // Fase 4 e 6: Token Budget Manager & LLM Router (Heurística)
            const budget = this.allocateTokenBudget(message);
            let finalModelId = agent.modelId || 'gpt-4o-mini';
            // Se o model original for caro e a querie for simples, podemos sobrescrever a variável.

            this.logger.log(`Chat com agente "${agent.name}" usando modelo: ${finalModelId} | Budget Chunks: ${budget.chunkLimit}`);

            // Carrega configs de provider da empresa (API keys do banco)
            const companyConfigs = await this.providerConfigService.getDecryptedForCompany(companyId);
            const llmProviderId = this.detectProviderFromModelId(finalModelId);
            const llmConfig = companyConfigs.get(llmProviderId);
            const embeddingConfig = companyConfigs.get(agent.embeddingProvider || 'openai');

            let context = '';
            if (agent.knowledgeBaseId) {
                const chunks = await this.vectorStoreService.searchSimilarity(
                    this.prisma,
                    companyId,
                    message,
                    agent.knowledgeBaseId,
                    budget.chunkLimit, // Budget dinâmico aplicado
                    agent.embeddingProvider || 'openai',
                    agent.embeddingModel,
                    embeddingConfig?.apiKey || undefined,
                    embeddingConfig?.baseUrl || undefined,
                );
                context = chunks.map(c => c.content).join('\n---\n');
            }

            const response = await this.llmService.generateResponse(
                finalModelId,
                agent.prompt || 'Você é um assistente virtual prestativo.',
                message,
                history.map(h => ({
                    role: h.role === 'user' || h.role === 'client' ? 'user' : 'assistant',
                    content: h.content
                })),
                agent.temperature || 0.7,
                context,
                llmConfig?.apiKey || undefined,
                llmConfig?.baseUrl || undefined,
            );

            // Grava RAG Cache
            if (promptEmbedding.length > 0) {
                const newCacheKey = `${companyId}:${agentId}:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > 2000) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            // Registrar uso de tokens (se disponível)
            try {
                await this.trackTokenUsage(companyId, response);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat: ${error.message}`);
            throw error;
        }
    }

    /**
     * Chat multimodal com suporte a imagens
     */
    async chatMultimodal(
        companyId: string,
        agentId: string,
        message: string,
        imageUrls: string[] = [],
        history: any[] = []
    ) {
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }
        if (message.length > 4000) message = message.substring(0, 4000);

        // Fase 3 e 7: Compressor de Contexto
        history = this.compressContext(history);
        if (history.length > 20) history = history.slice(-20);

        if (imageUrls.length > 5) {
            throw new Error('Máximo de 5 imagens por requisição');
        }

        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) {
            throw new Error('Agente não encontrado ou inativo');
        }

        await this.checkTokenLimits(companyId);

        try {
            // Fase 5: Semantic Cache (Apenas aplicável se não houver imagens na rodada)
            let promptEmbedding: number[] = [];
            if (imageUrls.length === 0) {
                try {
                    promptEmbedding = await this.vectorStoreService.generateEmbedding(message, 'native');
                    const cacheKeyPrefix = `${companyId}:${agentId}-mm`;
                    for (const [key, cached] of this.semanticCache.entries()) {
                        if (key.startsWith(cacheKeyPrefix)) {
                            if (this.cosineSimilarity(promptEmbedding, cached.embedding) > 0.95) {
                                this.logger.log(`[Cache HIT] Semantic similarity > 0.95 (MM) abortando geração para agente ${agent.name}`);
                                return cached.response;
                            }
                        }
                    }
                } catch (err) { }
            }

            // Fase 4 e 6: Token Budget Manager
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

            // Grava RAG Cache
            if (promptEmbedding.length > 0 && imageUrls.length === 0) {
                const newCacheKey = `${companyId}:${agentId}-mm:${Date.now()}`;
                this.semanticCache.set(newCacheKey, { embedding: promptEmbedding, response, timestamp: Date.now() });
                if (this.semanticCache.size > 2000) {
                    const firstKey = this.semanticCache.keys().next().value;
                    if (firstKey) this.semanticCache.delete(firstKey);
                }
            }

            // Registrar uso de tokens (estimativa maior para multimodal)
            try {
                await this.trackTokenUsage(companyId, response, imageUrls.length);
            } catch (e) {
                this.logger.warn(`Falha ao registrar uso de tokens: ${e.message}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Erro no chat multimodal: ${error.message}`);
            throw error;
        }
    }

    /**
     * Registra uso de tokens na tabela AIUsage
     */
    private async trackTokenUsage(companyId: string, response: string, imageCount: number = 0) {
        // Estimativa simples de tokens: ~4 chars por token
        // Multimodal usa mais tokens (imagens)
        const estimatedTokens = Math.ceil(response.length / 4) + (imageCount * 100);
        await (this.prisma as any).aIUsage.create({
            data: {
                companyId,
                tokens: estimatedTokens,
                cost: 0, // Custo real pode ser calculado futuramente baseado no provider
            }
        });
    }

    async transcribeAudio(mediaUrl: string) {
        try {
            this.logger.log(`Iniciando transcrição nativa (Whisper) para: ${mediaUrl}`);

            // 1. Baixar o arquivo de áudio
            const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioResponse.data);

            // 2. Preparar payload FormData para a API da OpenAI
            const formData = new FormData();

            formData.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
            formData.append('model', 'whisper-1');

            const openAiKey = process.env.OPENAI_API_KEY;
            if (!openAiKey) {
                this.logger.warn('Aviso: OPENAI_API_KEY não definida no ambiente. Transcrição falhará.');
                return "[Serviço de transcrição indisponível]";
            }

            // 3. Enviar para transcrição Whisper direto na OpenAI
            const response = await axios.post(
                'https://api.openai.com/v1/audio/transcriptions',
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${openAiKey}`,
                    },
                }
            );

            return response.data.text || null;
        } catch (error) {
            this.logger.error(`Erro na transcrição de áudio com Whisper: ${error.message}`);
            return "[Erro na transcrição automática do áudio]";
        }
    }

    async summarize(companyId: string, agentId: string, messages: any[]) {
        const agent = await this.findOneAgent(companyId, agentId);
        if (!agent || !agent.isActive) return null;

        const conversation = messages.map(m => `${m.fromMe ? 'Atendente' : 'Cliente'}: ${m.content}`).join('\n');

        try {
            return await this.llmService.generateResponse(
                'gpt-4o-mini',
                'Você é um assistente encarregado de resumir conversas de suporte técnico.',
                `Resuma a seguinte conversa de forma concisa em no máximo 3 frases:\n\n${conversation}`,
                [],
                0.3
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

        try {
            const aiResponse = await this.llmService.generateResponse(
                'gpt-4o-mini',
                'Você é um analista de sentimentos especialista em CX.',
                prompt,
                [],
                0
            );

            const jsonMatch = aiResponse.match(/\{.*\}/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                sentiment: 'NEUTRAL',
                score: 5.0,
                justification: aiResponse
            };
        } catch (error) {
            this.logger.error(`Erro na análise sentimental: ${error.message}`);
            return null;
        }
    }

    /**
     * Retorna o uso acumulado de tokens/IA da empresa.
     */
    async getUsage(companyId: string) {
        const totalTokens = await (this.prisma as any).aIUsage.aggregate({
            where: { companyId },
            _sum: { tokens: true, cost: true },
            _count: true,
        });

        return {
            totalTokens: totalTokens._sum.tokens || 0,
            totalCost: totalTokens._sum.cost || 0,
            totalCalls: totalTokens._count || 0,
        };
    }

    /**
     * Retorna métricas detalhadas de uso da IA
     */
    async getDetailedMetrics(companyId: string) {
        // Métricas gerais
        const usage = await this.getUsage(companyId);

        // Uso por dia (últimos 30 dias)
        const dailyUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                DATE("createdAt") as date,
                SUM(tokens) as tokens,
                COUNT(*) as calls
            FROM "AIUsage"
            WHERE "companyId" = ${companyId}
            AND "createdAt" >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE("createdAt")
            ORDER BY date ASC
        `;

        // Uso por agente (lista agentes com totais gerais da empresa)
        const agentUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                a.name as "agentName",
                a."modelId" as model,
                a."isActive" as active
            FROM "AIAgent" a
            WHERE a."companyId" = ${companyId}
            ORDER BY a.name ASC
        `;

        // Uso por modelo (agrupado pelas configurações dos agentes)
        const modelUsage = await (this.prisma as any).$queryRaw`
            SELECT 
                a."modelId" as model,
                COUNT(a.id) as "agentCount"
            FROM "AIAgent" a
            WHERE a."companyId" = ${companyId}
            AND a."modelId" IS NOT NULL
            GROUP BY a."modelId"
            ORDER BY "agentCount" DESC
        `;

        return {
            usage,
            dailyUsage,
            agentUsage,
            modelUsage
        };
    }

    /**
     * Detecta o providerId a partir do modelId (espelha lógica do LLMProviderFactory.detectProvider).
     */
    private detectProviderFromModelId(modelId: string): string {
        const prefixMap: Record<string, string> = {
            'groq:': 'groq', 'openrouter:': 'openrouter', 'ollama:': 'ollama',
            'azure:': 'azure', 'together:': 'together', 'lmstudio:': 'lmstudio',
            'perplexity:': 'perplexity', 'xai:': 'xai', 'cohere:': 'cohere',
            'huggingface:': 'huggingface',
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

    /**
     * Streaming de respostas da IA usando Server-Sent Events (SSE)
     */
    streamChat(companyId: string, agentId: string, message: string, history: any[] = []): Observable<any> {
        // 1. Validação de entrada
        if (!message || message.trim().length === 0) {
            throw new Error('Mensagem não pode ser vazia');
        }

        if (message.length > 4000) {
            message = message.substring(0, 4000);
        }

        if (history.length > 20) {
            history = history.slice(-20);
        }

        // Retornar um Observable que chama o LLM de forma assíncrona
        return new Observable(observer => {
            observer.next({ data: { type: 'start', content: '' } });

            this.chat(companyId, agentId, message, history)
                .then(response => {
                    observer.next({ data: { type: 'chunk', content: response } });
                    observer.next({ data: { type: 'end', content: '' } });
                    observer.complete();
                })
                .catch(error => {
                    this.logger.error(`Erro no streamChat: ${error.message}`);
                    observer.next({ data: { type: 'error', content: error.message } });
                    observer.complete();
                });
        });
    }
}