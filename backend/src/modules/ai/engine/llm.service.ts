import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { LLMProviderFactory } from './llm-provider.factory';

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
    ): Promise<string> {
        try {
            const chat = this.providerFactory.createModel(modelId, temperature);

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
}
