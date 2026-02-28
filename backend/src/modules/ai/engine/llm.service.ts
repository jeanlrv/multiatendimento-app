import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { LLMProviderFactory, isMultimodalModel } from './llm-provider.factory';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class LLMService {
    private readonly logger = new Logger(LLMService.name);

    constructor(
        private configService: ConfigService,
        private providerFactory: LLMProviderFactory,
    ) { }

    /**
     * Gera uma resposta da IA baseada no agente e no histórico fornecido.
     * Suporta múltiplos providers via LLMProviderFactory.
     * @param modelId ID do modelo (ex: gpt-4o-mini, claude-3-5-sonnet, gemini-2.0-flash, groq:llama-3.1-8b-instant)
     * @param systemPrompt O prompt de sistema que define o comportamento do agente
     * @param userMessage A mensagem atual do usuário
     * @param history Histórico de mensagens formatado
     * @param temperature Temperatura da IA (criatividade)
     * @param context Conhecimento extra recuperado (RAG)
     */
    async generateResponse(
        modelId: string,
        systemPrompt: string,
        userMessage: string,
        history: { role: 'user' | 'assistant' | 'system', content: string }[] = [],
        temperature: number = 0.7,
        context: string = '',
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): Promise<string> {
        try {
            const chat = this.providerFactory.createModel(modelId, temperature, apiKeyOverride, baseUrlOverride);

            const messages = [];

            // 1. Prompt de Sistema Principal
            let fullSystemPrompt = systemPrompt || 'Você é um assistente prestativo.';

            // 2. Injeta contexto de RAG se houver
            if (context) {
                fullSystemPrompt += `\n\nContexto adicional de conhecimento:\n"""\n${context}\n"""\n\nUse o contexto acima para responder, se relevante.`;
            }

            messages.push(new SystemMessage(fullSystemPrompt));

            // 3. Adiciona histórico
            for (const msg of history) {
                if (msg.role === 'user') {
                    messages.push(new HumanMessage(msg.content));
                } else if (msg.role === 'assistant') {
                    messages.push(new AIMessage(msg.content));
                }
            }

            // 4. Mensagem atual do usuário
            messages.push(new HumanMessage(userMessage));

            const response = await chat.invoke(messages);

            return response.content.toString();
        } catch (error) {
            this.logger.error(`Erro ao gerar resposta LLM (${modelId}): ${error.message}`);
            throw error;
        }
    }

    /**
     * Streaming real de tokens — retorna um AsyncGenerator.
     * Emite tokens individuais à medida que o LLM os gera.
     */
    async *streamResponse(
        modelId: string,
        systemPrompt: string,
        userMessage: string,
        history: { role: 'user' | 'assistant' | 'system', content: string }[] = [],
        temperature: number = 0.7,
        context: string = '',
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): AsyncGenerator<string, void, unknown> {
        const chat = this.providerFactory.createModel(modelId, temperature, apiKeyOverride, baseUrlOverride);

        let fullSystemPrompt = systemPrompt || 'Você é um assistente prestativo.';
        if (context) {
            fullSystemPrompt += `\n\nContexto adicional de conhecimento:\n"""\n${context}\n"""\n\nUse o contexto acima para responder, se relevante.`;
        }

        const messages: BaseMessage[] = [new SystemMessage(fullSystemPrompt)];
        for (const msg of history) {
            if (msg.role === 'user') messages.push(new HumanMessage(msg.content));
            else if (msg.role === 'assistant') messages.push(new AIMessage(msg.content));
        }
        messages.push(new HumanMessage(userMessage));

        try {
            const stream = await chat.stream(messages);
            for await (const chunk of stream) {
                const token = chunk.content?.toString() ?? '';
                if (token) yield token;
            }
        } catch (error) {
            this.logger.error(`Erro no streaming LLM (${modelId}): ${error.message}`);
            throw error;
        }
    }

    /**
     * Gera resposta multimodal (com suporte a imagens).
     * @param modelId ID do modelo (deve ser multimodal: gpt-4o, gemini-2.0-flash, etc)
     * @param systemPrompt O prompt de sistema
     * @param userMessage A mensagem do usuário
     * @param imageUrls Array de URLs de imagens para processar (base64 ou HTTP)
     * @param history Histórico de mensagens
     * @param temperature Temperatura da IA
     */
    async generateMultimodalResponse(
        modelId: string,
        systemPrompt: string,
        userMessage: string,
        imageUrls: string[] = [],
        history: { role: 'user' | 'assistant' | 'system', content: string }[] = [],
        temperature: number = 0.7,
        apiKeyOverride?: string,
        baseUrlOverride?: string,
    ): Promise<string> {
        try {
            // Verifica se o modelo suporta multimodal
            if (!isMultimodalModel(modelId)) {
                this.logger.warn(`Modelo ${modelId} não suporta multimodal. Usando fallback para texto.`);
                return this.generateResponse(modelId, systemPrompt, userMessage, history, temperature, '', apiKeyOverride, baseUrlOverride);
            }

            const chat = this.providerFactory.createModel(modelId, temperature, apiKeyOverride, baseUrlOverride);

            const messages: BaseMessage[] = [];

            // 1. Prompt de Sistema
            messages.push(new SystemMessage(systemPrompt || 'Você é um assistente multimodal capaz de analisar imagens.'));

            // 2. Adiciona histórico
            for (const msg of history) {
                if (msg.role === 'user') {
                    messages.push(new HumanMessage(msg.content));
                } else if (msg.role === 'assistant') {
                    messages.push(new AIMessage(msg.content));
                }
            }

            // 3. Constrói mensagem multimodal (texto + imagens)
            const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

            // Adiciona texto
            if (userMessage) {
                content.push({ type: 'text', text: userMessage });
            }

            // Adiciona imagens
            for (const imageUrl of imageUrls) {
                content.push({
                    type: 'image_url',
                    image_url: { url: imageUrl }
                });
            }

            // Adiciona mensagem multimodal
            messages.push(new HumanMessage(content));

            const response = await chat.invoke(messages);

            return response.content.toString();
        } catch (error) {
            this.logger.error(`Erro ao gerar resposta multimodal (${modelId}): ${error.message}`);
            throw error;
        }
    }
}
