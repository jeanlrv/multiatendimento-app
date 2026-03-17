import { Injectable, Logger, Inject, forwardRef, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ChatGateway } from './chat.gateway';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AIService } from '../ai/ai.service';
import { MessageType } from '@prisma/client';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private prisma: PrismaService,
        private chatGateway: ChatGateway,
        @Inject(forwardRef(() => WhatsAppService)) private whatsappService: WhatsAppService,
        private aiService: AIService,
        private eventEmitter: EventEmitter2,
    ) { }

    async validateTicketOwnership(ticketId: string, companyId: string) {
        const ticket = await this.prisma.ticket.findFirst({
            where: {
                id: ticketId,
                companyId
            }
        });

        if (!ticket) {
            throw new Error('Ticket não encontrado ou acesso negado para esta empresa');
        }

        return ticket;
    }

    async sendMessage(ticketId: string, content: string, fromMe: boolean, type: MessageType = MessageType.TEXT, mediaUrl?: string, companyId?: string, origin: 'AGENT' | 'CLIENT' | 'AI' = 'AGENT', quotedMessageId?: string, externalId?: string) {
        this.logger.log(`Processando mensagem para o ticket: ${ticketId} (${origin})`);

        // Garantir isolamento multi-tenant: companyId é obrigatório
        if (!companyId) {
            throw new ForbiddenException('companyId ausente: acesso multi-tenant não autorizado');
        }

        return await this.prisma.$transaction(async (tx) => {
            const message = await tx.message.create({
                data: {
                    ticketId,
                    content,
                    fromMe,
                    origin: fromMe ? (origin === 'AI' ? 'AI' : 'AGENT') : 'CLIENT',
                    messageType: type,
                    mediaUrl,
                    status: 'PENDING',
                    sentAt: new Date(),
                    quotedMessageId,
                    externalId: externalId || undefined,
                },
            });

            // companyId sempre presente — garante isolamento multi-tenant
            const ticket = await tx.ticket.findUnique({
                where: { id: ticketId, companyId },
                include: { contact: true }
            });

            if (!ticket) throw new Error('Ticket não encontrado ou acesso negado');

            const updateData: any = {
                updatedAt: new Date(),
                lastMessageAt: new Date(),
            };

            if (!fromMe) {
                updateData.unreadMessages = { increment: 1 };
            } else if (!ticket.firstResponseAt) {
                updateData.firstResponseAt = new Date();
            }

            await tx.ticket.update({
                where: { id: ticketId },
                data: updateData,
            });

            this.chatGateway.emitNewMessage(ticket.companyId, ticketId, message);

            if (fromMe && type !== 'INTERNAL') {
                this.sendExternalMessage(ticket, message).catch(err => {
                    this.logger.error(`Erro no envio assíncrono WhatsApp: ${err.message}`);
                });
            } else if (!fromMe) {
                this.handleIncomingClientMessage(ticket, content, type, mediaUrl, message.id);
            }

            // Detecção de menções em notas internas
            if (type === 'INTERNAL' && content.includes('@')) {
                this.handleMentions(ticket.companyId, ticketId, content, message.id).catch(err => {
                    this.logger.error(`Erro ao processar menções: ${err.message}`);
                });
            }

            return message;
        });
    }

    private async handleMentions(companyId: string, ticketId: string, content: string, messageId: string) {
        // Unicode property escapes (\p{L}\p{N}) cobrem nomes com acentos e caracteres internacionais
        const mentionRegex = /@([\p{L}\p{N}_]+)/gu;
        const matches = [...content.matchAll(mentionRegex)];

        if (matches.length > 0) {
            const usernames = matches.map(m => m[1]);

            const users = await this.prisma.user.findMany({
                where: {
                    companyId,
                    OR: [
                        { name: { in: usernames, mode: 'insensitive' } },
                        { email: { in: usernames, mode: 'insensitive' } }
                    ]
                }
            });

            for (const user of users) {
                // Emitir via WebSocket (tempo real na UI)
                this.chatGateway.emitMention(companyId, user.id, {
                    ticketId,
                    messageId,
                    mentionContent: content
                });

                // Emitir via EventEmitter2 para NotificationsService criar notificação persistente
                this.eventEmitter.emit('ticket.mention', {
                    userId: user.id,
                    companyId,
                    ticketId,
                    mentionContent: content.slice(0, 200),
                });
            }
        }
    }

    private async sendExternalMessage(ticket: any, message: any) {
        try {
            let externalResult;
            switch (message.messageType) {
                case 'IMAGE':
                    externalResult = await this.whatsappService.sendImage(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId, message.content);
                    break;
                case 'AUDIO':
                    externalResult = await this.whatsappService.sendPttAudio(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId);
                    break;
                case 'VIDEO':
                    externalResult = await this.whatsappService.sendVideo(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, ticket.companyId, message.content);
                    break;
                case 'DOCUMENT':
                    const fileName = message.mediaUrl.split('/').pop() || 'documento';
                    const ext = fileName.split('.').pop() || 'pdf';
                    externalResult = await this.whatsappService.sendDocument(ticket.connectionId, ticket.contact.phoneNumber, message.mediaUrl, fileName, ext, ticket.companyId);
                    break;
                default:
                    externalResult = await this.whatsappService.sendMessage(ticket.connectionId, ticket.contact.phoneNumber, message.content, ticket.companyId);
            }

            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'SENT', externalId: externalResult?.zaapId || externalResult?.id }
            });
            this.chatGateway.emitMessageStatusUpdate(ticket.id, message.id, 'SENT');
        } catch (error) {
            this.logger.error(`Falha no envio WhatsApp: ${error.message}`);
            await this.prisma.message.update({
                where: { id: message.id },
                data: { status: 'FAILED' }
            });
            this.chatGateway.emitMessageStatusUpdate(ticket.id, message.id, 'FAILED');
        }
    }

    private async handleIncomingClientMessage(ticket: any, content: string, messageType?: MessageType, mediaUrl?: string, messageId?: string) {
        try {
            let processedContent = content;

            // Transcrição automática de áudio — usa tipo recebido diretamente (sem query ao banco)
            if (messageType === 'AUDIO' && mediaUrl) {
                this.logger.log(`[AutoTranscribe] Transcrevendo áudio para ticket ${ticket.id}`);
                try {
                    const transcription = await this.aiService.transcribeAudio(mediaUrl, ticket.companyId);
                    if (transcription && transcription.trim().length > 0 && !transcription.startsWith('[')) {
                        processedContent = transcription;
                        this.logger.log(`[AutoTranscribe] Transcrição: "${transcription.substring(0, 100)}"`);
                        // Atualizar a mensagem com a transcrição (pode falhar se a transação não commitou ainda, mas não é crítico)
                        const lastMsg = await this.prisma.message.findFirst({
                            where: { ticketId: ticket.id, messageType: 'AUDIO' },
                            orderBy: { sentAt: 'desc' },
                        });
                        if (lastMsg) {
                            await this.prisma.message.update({
                                where: { id: lastMsg.id },
                                data: { transcription },
                            }).catch(e => this.logger.debug(`[AutoTranscribe] Não atualizou mensagem: ${e.message}`));
                        }
                    } else {
                        processedContent = transcription || 'O cliente enviou um áudio. Infelizmente não foi possível transcrevê-lo.';
                    }
                } catch (transcribeErr) {
                    this.logger.error(`[AutoTranscribe] Falha na transcrição: ${transcribeErr.message}`);
                    processedContent = 'O cliente enviou um áudio. Infelizmente não foi possível transcrevê-lo no momento.';
                }
            }

            // Análise multimodal de imagem — usa tipo recebido diretamente
            if (messageType === 'IMAGE' && mediaUrl) {
                this.logger.log(`[AutoVision] Processando imagem para ticket ${ticket.id}`);
                try {
                    const ticketFull = await this.prisma.ticket.findUnique({
                        where: { id: ticket.id },
                        include: { department: true }
                    });
                    const agentId = ticketFull?.department?.aiAgentId;
                    
                    const axios = require('axios');
                    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);
                    const ext = mediaUrl.split('.').pop()?.toLowerCase() || 'jpeg';
                    const dataUri = `data:image/${ext};base64,${buffer.toString('base64')}`;

                    if (agentId) {
                        const transcription = await this.aiService.describeImage(ticket.companyId, agentId, dataUri);
                        processedContent = `[Imagem do cliente: ${transcription}]`;
                        
                        // Atualizar a mensagem no banco
                        if (messageId) {
                             await this.prisma.message.update({
                                  where: { id: messageId },
                                  data: { transcription: processedContent }
                             }).catch(e => this.logger.debug(`[AutoVision] Não atualizou mensagem: ${e.message}`));
                        }
                    }

                    await this.handleAIResponseMultimodal(ticket.id, processedContent, dataUri);
                    return;
                } catch (visionErr) {
                    this.logger.error(`[AutoVision] Falha: ${visionErr.message}. Processando como texto.`);
                    // Fallback: processar como texto normal
                }
            }

            await this.handleAIResponse(ticket.id, processedContent);
        } catch (err) {
            this.logger.error(`Erro no fluxo de IA: ${err.message}`);
        }
    }

    private async handleAIResponse(ticketId: string, content: string) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    department: true,
                    contact: true,
                },
            });

            if (!ticket?.department?.aiAgentId) {
                this.logger.warn(`IA desabilitada para ticket ${ticketId}: departamento ${ticket?.department?.id} sem aiAgentId configurado`);
                return;
            }

            // VALIDAR MODO: Só responde automaticamente se estiver em modo IA ou HIBRIDO
            const ticketMode = (ticket as any).mode || 'MANUAL';
            if (ticketMode !== 'AI' && ticketMode !== 'HIBRIDO') {
                this.logger.log(`IA ignorada para o ticket ${ticketId}: Modo ${ticketMode}`);
                return;
            }

            const messages = await this.prisma.message.findMany({
                where: { ticketId },
                orderBy: { sentAt: 'desc' },
                take: 11,
            });

            // Prefixos de mensagens de sistema geradas pelo próprio sistema de transferência
            const TRANSFER_MSG_PREFIXES = [
                'Um momento, estou direcionando',
                'Você foi encaminhado',
                'Transferindo para',
                '🔄',
            ];
            const isTransferSystemMsg = (text: string) =>
                TRANSFER_MSG_PREFIXES.some(p => text.startsWith(p));

            // Detecta se este ticket passou por uma transferência recente
            const wasRecentlyTransferred = messages.some(m => isTransferSystemMsg(m.content));

            // Isolamento de agentes após transferência:
            // messages está em ordem DESC (mais recente primeiro).
            // Encontramos a posição da última mensagem de transferência e usamos apenas
            // as mensagens MAIS RECENTES que ela (índices menores). Isso impede que o
            // novo agente veja as respostas do agente anterior como "suas" (role: assistant).
            const lastTransferIdx = messages.findIndex(m => isTransferSystemMsg(m.content));
            const relevantMessages = lastTransferIdx >= 0
                ? messages.slice(0, lastTransferIdx) // só mensagens após a transferência
                : messages;

            const history = relevantMessages
                .filter(m => m.content !== content)
                // Remove mensagens de sistema de transferência do histórico enviado à IA
                // para evitar que a nova IA adote a identidade do agente anterior
                .filter(m => !isTransferSystemMsg(m.content || ''))
                .reverse()
                .map(m => ({
                    role: m.fromMe ? 'assistant' : 'user',
                    content: m.transcription || m.content || ''
                }));

            // Buscar departamentos disponíveis para injetar instruções de roteamento
            const departments = await this.prisma.department.findMany({
                where: { companyId: ticket.companyId },
                select: { id: true, name: true },
            });
            // Excluir o departamento ATUAL para evitar loop de auto-transferência
            const otherDepts = departments.filter(d => d.id !== ticket.departmentId);
            const deptNames = otherDepts.length > 0
                ? otherDepts.map(d => d.name).join(', ')
                : '(nenhum outro departamento disponível)';
            const currentDeptName = ticket.department?.name ?? 'desconhecido';

            // Buscar workflow ativo do departamento para injetar contexto na IA
            let workflowBlock = '';
            const deptWorkflowId = (ticket.department as any)?.workflowId;
            if (deptWorkflowId) {
                try {
                    const workflow = await this.prisma.workflowRule.findUnique({
                        where: { id: deptWorkflowId },
                        select: { name: true, nodes: true, edges: true, actions: true },
                    });
                    if (workflow) {
                        workflowBlock = this.buildWorkflowInstructions(workflow);
                    }
                } catch (wfErr) {
                    this.logger.warn(`[Workflow] Falha ao carregar workflow ${deptWorkflowId}: ${wfErr.message}`);
                }
            }

            // Data/hora local no fuso do departamento
            const { deptTimezone, dateStr, timeStr } = this.getDeptLocalDateTime((ticket.department as any)?.timezone);

            // Bloco especial para fora do expediente
            const outOfHours = this.isOutsideBusinessHours(ticket.department);
            const aiMessagesInHistory = messages.filter(m => m.fromMe).length;
            // Se já há 2+ mensagens da IA no histórico, o cliente já passou pelo fluxo de consentimento
            const consentAlreadyHandled = aiMessagesInHistory >= 2;

            const outOfHoursBlock = outOfHours ? (consentAlreadyHandled ? [
                '',
                '⚠️ NOTA: Atendimento fora do horário comercial — cliente já em sessão ativa via IA.',
                'Continue atendendo normalmente. [TRANSFERIR:X] e [HUMANO] funcionam normalmente.',
                'NUNCA diga ao cliente que não pode transferir ou atender por causa do horário.',
                '',
            ] : [
                '',
                '⚠️ CONTEXTO — FORA DO HORÁRIO COMERCIAL:',
                '- O cliente entrou em contato fora do horário de atendimento humano.',
                '- A mensagem de aviso de fora do expediente JÁ foi enviada automaticamente pelo sistema.',
                '- Você é um assistente de IA disponível 24 horas.',
                '- VERIFIQUE O HISTÓRICO DA CONVERSA e siga as regras:',
                '  a) Se a IA AINDA NÃO perguntou se o cliente deseja atendimento: apresente-se brevemente',
                '     como assistente virtual disponível mesmo fora do horário e pergunte se deseja continuar.',
                '  b) Se o cliente JÁ CONFIRMOU que quer atendimento (disse sim/quero/pode/etc.):',
                '     atenda normalmente. Use [TRANSFERIR:X] ou [HUMANO] quando necessário — esses comandos',
                '     funcionam normalmente fora do horário. Departamentos com IA operam 24h.',
                '  c) Se o cliente JÁ RECUSOU ou se despediu (disse não/depois/tchau/ok/etc.):',
                '     responda com uma despedida cordial e use [FINALIZAR].',
                '- CRÍTICO: NUNCA diga que não pode realizar transferências por causa do horário.',
                '- CRÍTICO: Quando usar [TRANSFERIR:X], execute imediatamente sem justificar horário.',
                '',
            ]).join('\n') : '';

            // Bloco de identidade — injetado quando há histórico de outro agente no ticket
            const identityOverrideBlock = wasRecentlyTransferred
                ? [
                    '',
                    '🔁 ATENÇÃO — TICKET TRANSFERIDO:',
                    `Este ticket foi recentemente transferido para o departamento "${currentDeptName}".`,
                    'O histórico da conversa pode conter mensagens de outro assistente de IA anterior.',
                    'VOCÊ É O ASSISTENTE DESTE DEPARTAMENTO. Ignore completamente qualquer identidade',
                    'mencionada em mensagens anteriores (nome, apresentação, personalidade do agente anterior).',
                    'Assuma sua própria identidade conforme seu prompt de sistema e atenda normalmente.',
                    '',
                ].join('\n')
                : '';

            const routingInstructions = [
                '========================================',
                '[INSTRUÇÕES DE ROTEAMENTO — NÃO EXIBA AO CLIENTE]',
                '========================================',
                `Data e hora atual: ${dateStr}, ${timeStr} (${deptTimezone})`,
                `Você está ATUALMENTE no departamento: ${currentDeptName}`,
                identityOverrideBlock,
                outOfHoursBlock,
                workflowBlock,
                'Você pode usar EXCLUSIVAMENTE um dos comandos abaixo quando necessário:',
                '',
                `• [TRANSFERIR:NomeDoDepartamento] — transfere para outro departamento (IA do destino assume)`,
                `• [HUMANO] — transfere para um atendente humano neste mesmo departamento`,
                `• [FINALIZAR] — encerra o atendimento (use apenas quando tudo estiver resolvido)`,
                '',
                `Departamentos para onde você pode transferir: ${deptNames}`,
                '',
                'REGRAS IMPORTANTES:',
                '1. Use [TRANSFERIR:X] SOMENTE para departamentos da lista acima — NUNCA para o seu departamento atual.',
                '2. Use [HUMANO] quando você não consegue resolver e o cliente precisa de uma pessoa.',
                '3. Use [FINALIZAR] apenas quando o atendimento estiver completamente concluído.',
                '4. Os comandos substituem COMPLETAMENTE sua resposta — não inclua texto adicional.',
                '5. Para respostas normais, responda naturalmente sem usar nenhum comando.',
                '========================================',
            ].join('\n');

            // AIService.chat() já verifica limites de tokens e registra uso
            let aiResponse: string | null = null;
            try {
                aiResponse = await this.aiService.chat(ticket.companyId, ticket.department.aiAgentId, content, history, undefined, routingInstructions);
            } catch (chatError) {
                this.logger.error(`[ChatAI] Falha para agente "${ticket.department.aiAgentId}" no depto "${ticket.department?.name}" (ticket: ${ticketId}): ${chatError.message}`);
                return;
            }

            if (!aiResponse) return;

            // Detectar comando de roteamento: [TRANSFERIR:NomeDepartamento], [HUMANO] ou [FINALIZAR]
            const transferMatch = aiResponse.match(/\[TRANSFERIR:([^\]]+)\]/i);
            const humanMatch = aiResponse.match(/\[HUMANO\]/i);
            const finalizeMatch = aiResponse.match(/\[FINALIZAR\]/i);

            if (transferMatch) {
                const deptName = transferMatch[1].trim();
                const targetDept = await this.prisma.department.findFirst({
                    where: {
                        companyId: ticket.companyId,
                        name: { equals: deptName, mode: 'insensitive' },
                    },
                });
                if (targetDept) {
                    // Guard: não transferir para o mesmo departamento atual
                    if (targetDept.id === ticket.departmentId) {
                        this.logger.warn(`IA tentou transferir para o mesmo departamento atual "${deptName}" — ignorado`);
                        return;
                    }

                    // Buscar o novo departamento completo (para verificar se tem IA)
                    const newDeptFull = await this.prisma.department.findUnique({
                        where: { id: targetDept.id },
                        select: { id: true, name: true, aiAgentId: true },
                    });

                    // Notificação breve e orgânica antes da transferência
                    await this.sendMessage(
                        ticketId,
                        `Um momento, estou direcionando você para o setor de *${targetDept.name}*... 🔄`,
                        true, MessageType.TEXT, undefined, ticket.companyId, 'AI'
                    );

                    await this.prisma.ticket.update({
                        where: { id: ticketId },
                        data: {
                            departmentId: targetDept.id,
                            mode: 'AI' as any,        // Garante que o agente do novo departamento assume
                            assignedUserId: null,     // Libera para auto-distribuição do novo departamento
                        },
                    });
                    this.eventEmitter.emit('ticket.transferred', {
                        ticketId,
                        companyId: ticket.companyId,
                        fromDepartmentId: ticket.departmentId,
                        toDepartmentId: targetDept.id,
                    });

                    this.logger.log(`IA transferiu ticket ${ticketId} para departamento "${deptName}"`);

                    if (newDeptFull?.aiAgentId) {
                        // Nova IA assume e se apresenta imediatamente
                        this.handleAIResponseAfterTransfer(ticketId, content, ticket.department?.name ?? currentDeptName, ticket.companyId).catch(err =>
                            this.logger.error(`Erro ao acionar IA pós-transferência: ${err.message}`)
                        );
                    } else {
                        // Destino sem IA — cliente aguarda humano
                        await this.sendMessage(
                            ticketId,
                            `Você foi encaminhado para *${targetDept.name}*. Em breve um atendente irá te ajudar! 👤`,
                            true, MessageType.TEXT, undefined, ticket.companyId, 'AI'
                        );
                    }
                } else {
                    this.logger.warn(`IA tentou transferir para departamento "${deptName}" não encontrado`);
                }
                return;
            }

            if (humanMatch) {
                // Gerar resumo automático da conversa para o atendente
                let conversationSummary = '';
                try {
                    const recentMsgs = messages.slice(-10).map(m =>
                        `${m.fromMe ? 'Assistente' : 'Cliente'}: ${m.content}`
                    ).join('\n');
                    conversationSummary = await this.aiService.chat(
                        ticket.companyId,
                        ticket.department.aiAgentId,
                        `Resuma esta conversa em 2-3 frases para um atendente humano que vai assumir. Inclua: problema do cliente, o que já foi tentado, e o sentimento percebido.\n\nConversa:\n${recentMsgs}`,
                    ) || '';
                    // Salvar resumo no ticket
                    if (conversationSummary) {
                        await this.prisma.ticket.update({
                            where: { id: ticketId },
                            data: { summary: conversationSummary },
                        });
                    }
                } catch (summaryErr) {
                    this.logger.warn(`[Handoff] Falha ao gerar resumo: ${(summaryErr as any).message}`);
                }

                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { mode: 'HUMANO' },
                });
                this.eventEmitter.emit('ticket.status_changed', { ticketId, companyId: ticket.companyId });
                this.eventEmitter.emit('ticket.human_queue', {
                    ticketId,
                    companyId: ticket.companyId,
                    departmentId: ticket.departmentId,
                    contactName: ticket.contact?.name,
                    summary: conversationSummary, // resumo para a notificação
                });
                await this.sendMessage(
                    ticketId,
                    'Vou transferir você para um de nossos atendentes. Aguarde um momento! 👤',
                    true, MessageType.TEXT, undefined, ticket.companyId, 'AI'
                );
                this.logger.log(`IA transferiu ticket ${ticketId} para atendimento humano (resumo: ${conversationSummary ? 'SIM' : 'NÃO'})`);
                return;
            }

            if (finalizeMatch) {
                // Enviar mensagem de despedida antes de resolver
                const dept = ticket.department;
                const closingMsg = (dept as any)?.closingMessage;
                if (closingMsg) {
                    await this.sendMessage(ticketId, closingMsg, true, MessageType.TEXT, undefined, ticket.companyId, 'AI');
                } else {
                    await this.sendMessage(
                        ticketId,
                        'Foi um prazer atendê-lo! Se precisar de algo mais, estamos à disposição. 😊',
                        true, MessageType.TEXT, undefined, ticket.companyId, 'AI'
                    );
                }

                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { status: 'RESOLVED', resolvedAt: new Date(), closedAt: new Date() },
                });
                this.eventEmitter.emit('ticket.resolved', {
                    ticketId,
                    companyId: ticket.companyId,
                    connectionId: (ticket as any).connectionId,
                    contact: ticket.contact,
                    departmentId: ticket.departmentId ?? null,
                });
                this.logger.log(`IA finalizou ticket ${ticketId} (despedida enviada)`);
                return;
            }

            await this.sendMessage(ticketId, this.sanitizeForWhatsApp(aiResponse), true, MessageType.TEXT, undefined, ticket.companyId, 'AI');

            // ─── Sentimento em Tempo Real (a cada 5 mensagens do cliente) ────
            const clientMsgCount = messages.filter(m => !m.fromMe).length;
            if (clientMsgCount > 0 && clientMsgCount % 5 === 0) {
                this.checkRealtimeSentiment(ticketId, ticket.companyId, messages).catch(err =>
                    this.logger.warn(`[Sentimento] Falha: ${err.message}`)
                );
            }
        } catch (error) {
            this.logger.error(`Erro ao processar resposta de IA: ${error.message}`);
        }
    }

    /**
     * Processa resposta de IA para mensagens com imagem (multimodal).
     * Usa chatMultimodal para enviar a imagem junto com o texto ao LLM.
     */
    private async handleAIResponseMultimodal(ticketId: string, content: string, imageUrl: string) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { department: true, contact: true },
            });

            if (!ticket?.department?.aiAgentId) return;

            const ticketMode = (ticket as any).mode || 'MANUAL';
            if (ticketMode !== 'AI' && ticketMode !== 'HIBRIDO') return;

            const messages = await this.prisma.message.findMany({
                where: { ticketId },
                orderBy: { sentAt: 'desc' },
                take: 11,
            });

            const history = messages
                .filter(m => m.content !== content)
                .reverse()
                .map(m => ({
                    role: m.fromMe ? 'assistant' : 'user',
                    content: m.transcription || m.content || '',
                }));

            const prompt = content && content !== '[Imagem]'
                ? content
                : 'O cliente enviou esta imagem. Analise e responda adequadamente.';

            let aiResponse: string | null = null;
            try {
                aiResponse = await this.aiService.chatMultimodal(
                    ticket.companyId,
                    ticket.department.aiAgentId,
                    prompt,
                    [imageUrl],
                    history,
                );
            } catch (err) {
                this.logger.error(`[Multimodal] Falha para ticket ${ticketId}: ${err.message}`);
                // Fallback: processar como texto normal
                await this.handleAIResponse(ticketId, content);
                return;
            }

            if (!aiResponse) return;

            // Processar comandos de roteamento
            const transferMatch = aiResponse.match(/\[TRANSFERIR:([^\]]+)\]/i);
            const humanMatch = aiResponse.match(/\[HUMANO\]/i);
            const finalizeMatch = aiResponse.match(/\[FINALIZAR\]/i);

            if (transferMatch || humanMatch || finalizeMatch) {
                // Delegar ao handleAIResponse para processar comandos de roteamento
                // Injetamos a resposta da IA como se fosse texto para reutilizar a lógica
                await this.handleAIResponse(ticketId, content);
                return;
            }

            await this.sendMessage(ticketId, this.sanitizeForWhatsApp(aiResponse), true, MessageType.TEXT, undefined, ticket.companyId, 'AI');
        } catch (error) {
            this.logger.error(`Erro no processamento multimodal: ${error.message}`);
        }
    }

    /**
     * Acionado após uma transferência AI→AI.
     * O novo agente recebe contexto do histórico e da mensagem original do cliente,
     * e responde imediatamente de forma orgânica (sem expor metadados de roteamento).
     */
    private async handleAIResponseAfterTransfer(ticketId: string, lastClientMessage: string, fromDeptName: string, companyId: string) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { department: true, contact: true },
            });

            if (!ticket?.department?.aiAgentId) return;

            const ticketMode = (ticket as any).mode || 'AI';
            if (ticketMode !== 'AI' && ticketMode !== 'HIBRIDO') return;

            // Histórico recente (excluindo as mensagens de roteamento/sistema)
            const messages = await this.prisma.message.findMany({
                where: { ticketId },
                orderBy: { sentAt: 'desc' },
                take: 15,
            });

            const history = messages
                .filter(m => !(m.content || '').startsWith('Um momento, estou direcionando') && !(m.content || '').startsWith('Você foi encaminhado'))
                .reverse()
                .map(m => ({ role: m.fromMe ? 'assistant' : 'user', content: m.transcription || m.content || '' }));

            // Contexto de transferência injetado no sufixo do sistema (não exibido ao cliente)
            const { deptTimezone, dateStr, timeStr } = this.getDeptLocalDateTime((ticket.department as any)?.timezone);

            const otherDepts = await this.prisma.department.findMany({
                where: { companyId, NOT: { id: ticket.departmentId } },
                select: { id: true, name: true },
            });
            const deptNames = otherDepts.length > 0 ? otherDepts.map(d => d.name).join(', ') : '(nenhum outro disponível)';

            // Verificar se estamos fora do horário comercial do NOVO departamento
            const outOfHours = this.isOutsideBusinessHours(ticket.department);
            const outOfHoursOverride = outOfHours
                ? [
                    '',
                    '⚠️ ATENÇÃO — FORA DO HORÁRIO COMERCIAL:',
                    'Este cliente está em uma sessão ativa transferida pela IA de recepção.',
                    'Você DEVE atender o cliente AGORA, independente do horário.',
                    'NÃO mencione limitações de horário. NÃO recuse atender. Continue normalmente.',
                    '[TRANSFERIR:X] e [HUMANO] funcionam normalmente.',
                    '',
                ]
                : [];

            const transferContext = [
                '========================================',
                '[INSTRUÇÕES DE ROTEAMENTO — NÃO EXIBA AO CLIENTE]',
                '========================================',
                `Data e hora atual: ${dateStr}, ${timeStr} (${deptTimezone})`,
                `Você está ATUALMENTE no departamento: ${ticket.department.name}`,
                `Este cliente foi transferido do departamento "${fromDeptName}".`,
                'Uma breve mensagem de redirecionamento JÁ foi enviada pelo sistema.',
                'Apresente-se como assistente deste setor e atenda a necessidade do cliente de forma direta e natural.',
                'NÃO diga "recebi sua transferência" ou similar — apenas se apresente e resolva.',
                ...outOfHoursOverride,
                '',
                `• [TRANSFERIR:NomeDoDepartamento] — transfere para outro departamento`,
                `• [HUMANO] — transfere para um atendente humano`,
                `• [FINALIZAR] — encerra o atendimento`,
                '',
                `Departamentos disponíveis para transferência: ${deptNames}`,
                '========================================',
            ].join('\n');

            // Fallback garantido: cliente nunca fica sem resposta após transferência,
            // mesmo que o agente esteja inativo, o provider não configurado, ou haja erro de API.
            let aiResponse: string | null = null;
            try {
                aiResponse = await this.aiService.chat(companyId, ticket.department.aiAgentId, lastClientMessage, history, undefined, transferContext);
            } catch (chatError) {
                this.logger.error(`[PostTransfer] IA falhou para agente "${ticket.department.aiAgentId}" no depto "${ticket.department.name}": ${chatError.message}`);
            }
            if (!aiResponse) {
                this.logger.warn(`IA pós-transferência sem resposta para ticket ${ticketId} (agente: ${ticket.department.aiAgentId}) — usando fallback`);
                const fallback = `Olá! Sou o assistente do setor *${ticket.department.name}*. Como posso ajudá-lo?`;
                await this.sendMessage(ticketId, fallback, true, MessageType.TEXT, undefined, companyId, 'AI');
                return;
            }

            // Processar comandos de roteamento na resposta do novo agente
            // Nota: não chamamos handleAIResponse() recursivamente para evitar loop infinito de transferências.
            // Cada agente pós-transferência só pode emitir comandos uma vez (máximo 1 nível de indireção).
            const transferMatchPost = aiResponse.match(/\[TRANSFERIR:([^\]]+)\]/i);
            const humanMatchPost = aiResponse.match(/\[HUMANO\]/i);
            const finalizeMatchPost = aiResponse.match(/\[FINALIZAR\]/i);

            if (humanMatchPost) {
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { mode: 'HUMANO' },
                });
                this.eventEmitter.emit('ticket.status_changed', { ticketId, companyId });
                this.eventEmitter.emit('ticket.human_queue', {
                    ticketId,
                    companyId,
                    departmentId: ticket.departmentId,
                    contactName: ticket.contact?.name,
                });
                await this.sendMessage(ticketId, 'Vou transferir você para um de nossos atendentes. Aguarde um momento! 👤', true, MessageType.TEXT, undefined, companyId, 'AI');
                return;
            }

            if (finalizeMatchPost) {
                // Enviar despedida antes de resolver (alinhado com handleAIResponse)
                const dept = ticket.department;
                const closingMsg = (dept as any)?.closingMessage;
                if (closingMsg) {
                    await this.sendMessage(ticketId, closingMsg, true, MessageType.TEXT, undefined, companyId, 'AI');
                } else {
                    await this.sendMessage(
                        ticketId,
                        'Foi um prazer atendê-lo! Se precisar de algo mais, estamos à disposição. 😊',
                        true, MessageType.TEXT, undefined, companyId, 'AI'
                    );
                }
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { status: 'RESOLVED', resolvedAt: new Date(), closedAt: new Date() },
                });
                this.eventEmitter.emit('ticket.resolved', {
                    ticketId,
                    companyId,
                    connectionId: (ticket as any).connectionId,
                    contact: ticket.contact,
                    departmentId: ticket.departmentId ?? null,
                });
                this.logger.log(`IA finalizou ticket ${ticketId} pós-transferência (despedida enviada)`);
                return;
            }

            if (transferMatchPost) {
                // Transferências encadeadas (AI→AI→AI) são ignoradas após o primeiro salto.
                // Isso previne loops infinitos. O agente atual assume o atendimento.
                this.logger.warn(`[IA pós-transferência] Tentativa de transferência encadeada ignorada para ticket ${ticketId} — respondendo normalmente.`);
            }

            await this.sendMessage(ticketId, this.sanitizeForWhatsApp(aiResponse.replace(/\[TRANSFERIR:[^\]]+\]/gi, '').trim()), true, MessageType.TEXT, undefined, companyId, 'AI');
        } catch (error) {
            this.logger.error(`Erro na IA pós-transferência: ${error.message}`);
        }
    }

    /**
     * Retorna data/hora formatada no fuso horário do departamento.
     * Elimina duplicação entre handleAIResponse e handleAIResponseAfterTransfer.
     */
    private getDeptLocalDateTime(timezone: string | undefined): { deptTimezone: string; dateStr: string; timeStr: string } {
        const deptTimezone = timezone || 'America/Sao_Paulo';
        try {
            const formatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: deptTimezone,
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            const formatted = formatter.format(new Date());
            // Formato: "segunda-feira, 16 de março de 2026 15:47"
            const dateTimeParts = formatted.split(/,\s*| \u00e0s /); // Pode variar por implementação
            const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: deptTimezone,
                hour: '2-digit', minute: '2-digit',
            });
            const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: deptTimezone,
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            });
            return {
                deptTimezone,
                dateStr: dateFormatter.format(new Date()),
                timeStr: timeFormatter.format(new Date()),
            };
        } catch {
            const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: deptTimezone }));
            return {
                deptTimezone,
                dateStr: nowLocal.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                timeStr: nowLocal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            };
        }
    }

    /**
     * Analisa sentimento em tempo real das últimas mensagens do cliente.
     * Se negativo (score ≤ 3/10), escala prioridade e notifica supervisores.
     */
    private async checkRealtimeSentiment(ticketId: string, companyId: string, messages: any[]) {
        const clientMessages = messages.filter(m => !m.fromMe).slice(-5);
        if (clientMessages.length < 3) return; // precisa de contexto mínimo

        const conversationText = clientMessages.map(m => m.content).join('\n');

        try {
            const sentimentResponse = await this.aiService.chat(
                companyId,
                undefined, // usa agente default
                `Analise o sentimento do cliente nesta conversa. Responda APENAS com um número de 1 a 10 (1=muito insatisfeito, 10=muito satisfeito).\n\nMensagens do cliente:\n${conversationText}`,
            );

            const score = parseInt(sentimentResponse?.replace(/[^0-9]/g, '') || '5', 10);
            this.logger.log(`[Sentimento] ticket=${ticketId} score=${score}/10`);

            const ticket = await this.prisma.ticket.findUnique({
                where: { id: ticketId },
                select: { priority: true, departmentId: true },
            });

            if (!ticket) return;

            if (score <= 3) {
                // Escalar prioridade automaticamente se não for critical
                if (ticket.priority !== 'CRITICAL') {
                    await this.prisma.ticket.update({
                        where: { id: ticketId },
                        data: { priority: 'HIGH', realtimeSentimentScore: score },
                    });
                    this.logger.warn(`[Sentimento] ticket=${ticketId} escalado para HIGH (score=${score})`);

                    // Notificar supervisores
                    this.eventEmitter.emit('evaluation.negative_score', {
                        ticketId,
                        companyId,
                        score,
                        threshold: 3,
                        summary: `Sentimento negativo detectado em tempo real (${score}/10). Mensagens recentes indicam insatisfação.`,
                    });
                } else {
                    await this.prisma.ticket.update({
                        where: { id: ticketId },
                        data: { realtimeSentimentScore: score },
                    });
                }
            } else {
                // Apenas atualiza o score
                await this.prisma.ticket.update({
                    where: { id: ticketId },
                    data: { realtimeSentimentScore: score },
                });
            }

            // Avisar o frontend para atualizar as badges visuais (sentimento e prioridade)
            this.eventEmitter.emit('ticket.status_changed', { ticketId, companyId });
        } catch (err) {
            this.logger.warn(`[Sentimento] Análise falhou: ${(err as any).message}`);
        }
    }

    /**
     * Converte nodes/edges de um workflow em instruções legíveis para a IA.
     * A IA recebe este bloco no prompt e sabe quais etapas o fluxo exige.
     */
    private buildWorkflowInstructions(workflow: { name: string; nodes: any; edges: any; actions: any }): string {
        try {
            const nodes: any[] = Array.isArray(workflow.nodes) ? workflow.nodes : [];
            const edges: any[] = Array.isArray(workflow.edges) ? workflow.edges : [];

            if (nodes.length === 0) return '';

            // Mapeamento de action types para descrições legíveis
            const ACTION_LABELS: Record<string, string> = {
                send_message: 'Enviar mensagem ao cliente',
                update_ticket: 'Atualizar status do ticket',
                transfer_to_human: 'Transferir para atendente humano',
                transfer_department: 'Transferir para outro departamento',
                ai_respond: 'IA responde ao cliente',
                ai_intent: 'IA analisa intenção do cliente',
                analyze_sentiment: 'Analisar sentimento da conversa',
                add_tag: 'Adicionar tag ao ticket',
                create_schedule: 'Criar agendamento',
                update_schedule_status: 'Atualizar status do agendamento',
                http_webhook: 'Chamar webhook externo',
                send_email: 'Enviar e-mail',
            };

            // Construir mapa de adjacência para ordem topológica
            const childrenMap = new Map<string, string[]>();
            const edgeLabelMap = new Map<string, string>();
            for (const edge of edges) {
                if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
                childrenMap.get(edge.source)!.push(edge.target);
                if (edge.label || edge.data?.condition !== undefined) {
                    edgeLabelMap.set(`${edge.source}->${edge.target}`, edge.label || String(edge.data?.condition));
                }
            }

            // Encontrar node trigger (início)
            const triggerNode = nodes.find(n => n.type === 'trigger');
            if (!triggerNode) return '';

            // BFS para descrever o fluxo em ordem
            const visited = new Set<string>();
            const steps: string[] = [];
            const queue: string[] = [triggerNode.id];
            let stepNum = 1;

            while (queue.length > 0) {
                const nodeId = queue.shift()!;
                if (visited.has(nodeId)) continue;
                visited.add(nodeId);

                const node = nodes.find((n: any) => n.id === nodeId);
                if (!node) continue;

                const label = node.data?.label || '';
                const actionType = node.data?.actionType || node.type;

                // Descrever cada tipo de nó
                let stepDesc = '';
                switch (node.type) {
                    case 'trigger':
                        stepDesc = `Gatilho: ${label || 'Início do fluxo'}`;
                        break;
                    case 'action': {
                        const actionLabel = ACTION_LABELS[actionType] || actionType;
                        const params = node.data?.params || {};
                        // Incluir detalhes relevantes dos params
                        const details: string[] = [];
                        if (params.message) details.push(`mensagem: "${String(params.message).substring(0, 80)}"`);
                        if (params.status) details.push(`status: ${params.status}`);
                        if (params.departmentId) details.push(`departamento alvo`);
                        if (params.agentId) details.push(`via agente de IA`);
                        stepDesc = `${actionLabel}${label ? ` — "${label}"` : ''}${details.length > 0 ? ` (${details.join(', ')})` : ''}`;
                        break;
                    }
                    case 'condition': {
                        const conditions = node.data?.conditions || [];
                        const condDesc = conditions.map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(' E ');
                        stepDesc = `Decisão: ${label || condDesc || 'Avaliar condição'}`;
                        // Descrever branches
                        const children = childrenMap.get(nodeId) || [];
                        for (const childId of children) {
                            const edgeKey = `${nodeId}->${childId}`;
                            const branchLabel = edgeLabelMap.get(edgeKey);
                            if (branchLabel) {
                                const childNode = nodes.find((n: any) => n.id === childId);
                                const childLabel = childNode?.data?.label || ACTION_LABELS[childNode?.data?.actionType] || 'próxima etapa';
                                stepDesc += `\n     → Se ${branchLabel}: ${childLabel}`;
                            }
                        }
                        break;
                    }
                    case 'delay':
                        stepDesc = `Aguardar: ${label || 'pausa antes da próxima etapa'}`;
                        break;
                    case 'wait_for_event':
                        stepDesc = `Aguardar evento: ${node.data?.event || label || 'resposta do cliente'}`;
                        break;
                    case 'end':
                        stepDesc = 'Fim do fluxo';
                        break;
                    default:
                        stepDesc = label || actionType;
                }

                if (stepDesc) {
                    steps.push(`${stepNum}. ${stepDesc}`);
                    stepNum++;
                }

                // Enfileirar filhos
                const children = childrenMap.get(nodeId) || [];
                for (const childId of children) {
                    if (!visited.has(childId)) queue.push(childId);
                }
            }

            if (steps.length <= 1) return ''; // Só tem trigger, sem passos reais

            return [
                '',
                '📋 FLUXO DE ATENDIMENTO DO DEPARTAMENTO — SIGA RIGOROSAMENTE:',
                `Workflow: "${workflow.name}"`,
                '',
                ...steps,
                '',
                'IMPORTANTE: Siga este fluxo como guia para o atendimento.',
                'As ações técnicas (update_ticket, analyze_sentiment, etc.) são executadas automaticamente pelo sistema.',
                'Você deve focar na interação natural com o cliente seguindo a sequência descrita acima.',
                '',
            ].join('\n');
        } catch (err) {
            this.logger.warn(`[buildWorkflowInstructions] Erro ao processar workflow: ${(err as any).message}`);
            return '';
        }
    }

    /** Retorna true se o departamento estiver fora do horário comercial */
    private isOutsideBusinessHours(department: any): boolean {
        if (!department?.businessHours) return false;
        try {
            const bh = typeof department.businessHours === 'string'
                ? JSON.parse(department.businessHours)
                : department.businessHours;
            const timezone = department.timezone || 'America/Sao_Paulo';

            // Usar Intl.DateTimeFormat para conversão confiável de timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
                hour12: false,
            });
            const parts = Object.fromEntries(
                formatter.formatToParts(new Date()).map(p => [p.type, p.value])
            );
            const localHour = parseInt(parts.hour, 10);
            const localMinute = parseInt(parts.minute, 10);
            const dayOfWeekNum = new Date(
                parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day)
            ).getDay();
            // Suporta ambos os formatos de keys: numérico ("0","1") e nome do dia ("sunday","monday")
            const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayConfig = bh[dayOfWeekNum.toString()] || bh[DAY_NAMES[dayOfWeekNum]];

            this.logger.log(
                `[BH-AI] Dept "${department.name}" | TZ: ${timezone} | ` +
                `Hora: ${parts.hour}:${parts.minute} | Dia: ${dayOfWeekNum} (${DAY_NAMES[dayOfWeekNum]}) | ` +
                `Config: ${dayConfig ? `${dayConfig.start}-${dayConfig.end}` : 'FECHADO'} | ` +
                `BH keys: ${Object.keys(bh).join(',')}`
            );

            if (!dayConfig?.start || !dayConfig?.end) return true; // dia fechado
            const cur = localHour * 60 + localMinute;
            const [sh, sm] = dayConfig.start.split(':').map(Number);
            const [eh, em] = dayConfig.end.split(':').map(Number);
            const outside = cur < sh * 60 + sm || cur >= eh * 60 + em;

            if (outside) {
                this.logger.log(`[BH-AI] FORA do horário: ${cur}min não está entre ${sh * 60 + sm}-${eh * 60 + em}`);
            } else {
                this.logger.log(`[BH-AI] DENTRO do horário comercial`);
            }
            return outside;
        } catch (e) {
            this.logger.warn(`[BH-AI] Erro ao verificar horário: ${e.message}`);
            return false;
        }
    }

    /** Converte markdown padrão para formato WhatsApp antes de enviar */
    private sanitizeForWhatsApp(text: string): string {
        return text
            .replace(/\*\*(.+?)\*\*/gs, '*$1*')          // **bold** → *bold*
            .replace(/__(.+?)__/gs, '_$1_')                // __italic__ → _italic_
            .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')         // # Heading → *Heading*
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // [link](url) → link
            .replace(/`{3}[\s\S]*?`{3}/g, '')              // remover blocos de código
            .replace(/`([^`]+)`/g, '$1')                   // `inline code` → texto
            .trim();
    }

    async getTicketMessages(ticketId: string, companyId: string, limit: number = 50) {
        // Ownership check merged into main query (1 query instead of 2)
        const ticket = await this.prisma.ticket.findFirst({
            where: { id: ticketId, companyId },
            select: {
                id: true,
                messages: {
                    take: Number(limit) || 50,
                    orderBy: { sentAt: 'asc' },
                    include: { quotedMessage: true },
                },
            },
        });
        if (!ticket) throw new Error('Ticket não encontrado ou acesso negado para esta empresa');
        return ticket.messages;
    }

    async getMessagesCursor(ticketId: string, companyId: string, cursor?: string, limit: number = 50) {
        // Ownership validated via nested ticket filter (1 query instead of 2)
        return this.prisma.message.findMany({
            where: { ticketId, ticket: { companyId } },
            take: Number(limit),
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { sentAt: 'desc' },
            include: { quotedMessage: true },
        });
    }

    async getMacros(companyId: string) {
        return this.prisma.quickReply.findMany({
            where: { companyId },
            orderBy: { shortcut: 'asc' }
        });
    }

    async createMacro(companyId: string, data: { title: string, content: string }) {
        return this.prisma.quickReply.create({
            data: {
                shortcut: data.title,
                content: data.content,
                companyId
            }
        });
    }

    async markAsRead(ticketId: string, companyId: string) {
        // Buscar ticket com contato para enviar read receipt ao WhatsApp
        const ticket = await this.prisma.ticket.findFirst({
            where: { id: ticketId, companyId },
            include: { contact: true },
        });

        // Buscar mensagens não lidas do cliente com externalId para read receipt
        const unreadMsgs = await this.prisma.message.findMany({
            where: { ticketId, fromMe: false, readAt: null },
            select: { externalId: true },
        });

        // Merge ownership check + ticket update (updateMany com companyId serve como validação)
        await this.prisma.ticket.updateMany({
            where: { id: ticketId, companyId },
            data: { unreadMessages: 0, lastMessageAt: new Date() },
        });
        const result = await this.prisma.message.updateMany({
            where: { ticketId, fromMe: false, readAt: null },
            data: { readAt: new Date() },
        });

        // Enviar read receipt ao WhatsApp para cada mensagem não lida (fire-and-forget)
        if (ticket?.connectionId && ticket?.contact?.phoneNumber) {
            for (const msg of unreadMsgs) {
                if (msg.externalId) {
                    this.whatsappService.sendReadReceipt(
                        ticket.connectionId,
                        ticket.contact.phoneNumber,
                        msg.externalId,
                        companyId,
                    ).catch(() => {});
                }
            }
        }

        return result;
    }

    async transcribe(messageId: string, companyId: string) {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
            include: { ticket: { include: { department: true } } }
        });

        if (!message || message.ticket.companyId !== companyId) {
            throw new Error('Mensagem não encontrada ou acesso negado');
        }

        if (message.messageType !== MessageType.AUDIO) {
            throw new Error('Mensagem não é um áudio');
        }

        if (message.transcription) {
            return { transcription: message.transcription };
        }

        const agentId = message.ticket.department.aiAgentId;
        if (!agentId) {
            throw new Error('Nenhum agente de IA configurado para este departamento');
        }

        const transcription = await this.aiService.transcribeAudio(message.mediaUrl);
        const updatedMessage = await this.prisma.message.update({
            where: { id: messageId },
            data: { transcription }
        });

        return { transcription: updatedMessage.transcription };
    }

    async deleteMessage(companyId: string, messageId: string): Promise<{ ok: boolean }> {
        const s = await this.prisma.setting.findFirst({
            where: { companyId, key: 'canDeleteMessages' }, select: { value: true },
        });
        const rawValue = String(s?.value ?? '').replace(/"/g, '').toLowerCase();
        if (!['true', '1', 'yes'].includes(rawValue))
            throw new ForbiddenException('A exclusão de mensagens está desativada nas configurações da empresa');

        const msg = await this.prisma.message.findFirst({
            where: { id: messageId, ticket: { companyId } }, select: { id: true },
        });
        if (!msg) throw new NotFoundException('Mensagem não encontrada');

        await this.prisma.message.delete({ where: { id: messageId } });
        return { ok: true };
    }

    @OnEvent('scheduled_message.fire')
    async handleScheduledMessage(data: { ticketId: string; content: string; companyId: string; scheduledMessageId: string }) {
        this.logger.log(`Disparando mensagem agendada ${data.scheduledMessageId} no ticket ${data.ticketId}`);
        try {
            await this.sendMessage(data.ticketId, data.content, true, MessageType.TEXT, undefined, data.companyId, 'AGENT');
        } catch (err) {
            this.logger.error(`Erro ao enviar mensagem agendada ${data.scheduledMessageId}: ${err.message}`);
            await this.prisma.scheduledMessage.update({
                where: { id: data.scheduledMessageId },
                data: { status: 'FAILED' },
            });
        }
    }
}
