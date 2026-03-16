import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { BulkTicketAction, BulkTicketActionDto } from './dto/bulk-ticket-action.dto';
import { AIService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);
    // In-memory cache for CSAT settings (5 min TTL) — avoids 2 DB queries per ticket resolve
    private readonly csatCache = new Map<string, { enabled: boolean; message: string | null; expiresAt: number }>();
    // In-memory cache for delete permission settings (5 min TTL)
    private readonly deleteSettingsCache = new Map<string, { canDelete: boolean; expiresAt: number }>();

    constructor(
        private prisma: PrismaService,
        private aiService: AIService,
        private evaluationsService: EvaluationsService,
        private auditService: AuditService,
        private eventEmitter: EventEmitter2,
        @InjectQueue('scheduling') private schedulingQueue: Queue,
    ) { }

    async create(companyId: string, createTicketDto: CreateTicketDto) {
        this.logger.log(`Criando novo ticket para o contato: ${createTicketDto.contactId} na empresa ${companyId}`);

        const department = await this.prisma.department.findUnique({
            where: { id: createTicketDto.departmentId }
        });

        const ticketData: any = {
            contactId: createTicketDto.contactId,
            departmentId: createTicketDto.departmentId,
            connectionId: createTicketDto.connectionId,
            subject: createTicketDto.subject,
            status: TicketStatus.OPEN,
            mode: department?.defaultMode || 'AI', // Modo inicial baseado no departamento
            companyId,
            tags: {
                create: createTicketDto.tags?.map(tagId => ({
                    tag: { connect: { id: tagId } }
                }))
            }
        };

        // Automatic Assignment Logic — gate: verificar setting autoDistribution (default true)
        const autoDistSetting = await this.prisma.setting.findFirst({
            where: { companyId, key: 'autoDistribution' }, select: { value: true },
        });
        // Normaliza o valor independente de ser salvo como string, JSON string ou boolean
        let autoDistEnabled = !autoDistSetting;
        if (autoDistSetting?.value !== null && autoDistSetting?.value !== undefined) {
            try {
                const parsed = JSON.parse(String(autoDistSetting.value));
                autoDistEnabled = parsed === true || parsed === 'true';
            } catch {
                autoDistEnabled = autoDistSetting.value === 'true';
            }
        }

        if (autoDistEnabled && createTicketDto.departmentId) {
            const departmentWithUsers = await this.prisma.department.findUnique({
                where: { id: createTicketDto.departmentId },
                include: { users: { include: { user: true } } }
            });

            if (departmentWithUsers && departmentWithUsers.autoDistribute && departmentWithUsers.users?.length > 0) {
                const userIds = departmentWithUsers.users.map((ud) => ud.user.id);

                // Uma única query groupBy em vez de N queries (evita N+1)
                const ticketCounts = await this.prisma.ticket.groupBy({
                    by: ['assignedUserId'],
                    where: {
                        assignedUserId: { in: userIds },
                        companyId,
                        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
                    },
                    _count: { id: true },
                });

                const countMap = new Map(
                    ticketCounts.map((tc) => [tc.assignedUserId!, tc._count.id])
                );

                const usersWithTicketCounts = userIds.map((userId) => ({
                    userId,
                    count: countMap.get(userId) ?? 0,
                }));

                usersWithTicketCounts.sort((a, b) => a.count - b.count);
                ticketData.assignedUserId = usersWithTicketCounts[0].userId;
                this.logger.log(`Ticket atribuído automaticamente para o usuário: ${ticketData.assignedUserId}`);
            }
        }

        const ticket = await this.prisma.ticket.create({
            data: ticketData,
            include: {
                contact: true,
                department: true,
                whatsappInstance: true,
                assignedUser: true,
            }
        });

        this.eventEmitter.emit('ticket.created', ticket);

        // Notificar usuário atribuído automaticamente
        if (ticket.assignedUserId) {
            this.eventEmitter.emit('ticket.assigned', { ticket, assignedUserId: ticket.assignedUserId });
        }

        return ticket;
    }

    async findAll(companyId: string, filters: any) {
        const {
            status,
            departmentId,
            assignedUserId,
            search,
            priority,
            connectionId,
            tags,
            startDate,
            endDate,
            page = 1,
            limit = 20,
        } = filters;

        const where: any = {
            companyId,
            ...(status && { status }),
            ...(departmentId && { departmentId: typeof departmentId === 'string' && departmentId.includes(',') ? { in: departmentId.split(',') } : departmentId }),
            ...(assignedUserId && { assignedUserId }),
            ...(priority && { priority }),
            ...(connectionId && { connectionId }),
        };

        // Filtro de Busca (Nome do Contato ou Telefone)
        if (search) {
            where.OR = [
                { contact: { name: { contains: search, mode: 'insensitive' } } },
                { contact: { phoneNumber: { contains: search } } },
                { subject: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Filtro de Tags (Trabalha com Array de IDs)
        if (tags) {
            const tagIds = Array.isArray(tags) ? tags : [tags];
            // Filtrar tags vazias ou undefined
            const validTagIds = tagIds.filter(id => id && id.trim() !== '');

            if (validTagIds.length > 0) {
                where.tags = {
                    some: {
                        tagId: { in: validTagIds }
                    }
                };
            }
        }

        // Filtro de Intervalo de Datas
        if (startDate || endDate) {
            where.createdAt = {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
            };
        }

        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.ticket.findMany({
                where,
                include: {
                    contact: true,
                    department: true,
                    assignedUser: true,
                    whatsappInstance: true,
                    tags: {
                        include: { tag: true }
                    }
                },
                orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
                skip,
                take: limit,
            }),
            this.prisma.ticket.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async exportCsv(companyId: string, filters: any): Promise<string> {
        const { status, departmentId, assignedUserId, search, priority, connectionId, tags, startDate, endDate } = filters;

        const where: any = {
            companyId,
            ...(status && { status }),
            ...(departmentId && { departmentId: typeof departmentId === 'string' && departmentId.includes(',') ? { in: departmentId.split(',') } : departmentId }),
            ...(assignedUserId && { assignedUserId }),
            ...(priority && { priority }),
            ...(connectionId && { connectionId }),
        };

        if (search) {
            where.OR = [
                { contact: { name: { contains: search, mode: 'insensitive' } } },
                { contact: { phoneNumber: { contains: search } } },
                { subject: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (tags) {
            const tagIds = Array.isArray(tags) ? tags : [tags];
            const validTagIds = tagIds.filter((id: string) => id && id.trim() !== '');
            if (validTagIds.length > 0) {
                where.tags = { some: { tagId: { in: validTagIds } } };
            }
        }

        if (startDate || endDate) {
            where.createdAt = {
                ...(startDate && { gte: new Date(startDate) }),
                ...(endDate && { lte: new Date(endDate) }),
            };
        }

        const tickets = await this.prisma.ticket.findMany({
            where,
            include: { contact: true, department: true, assignedUser: true },
            orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        });

        const escape = (v: any) => String(v ?? '').replace(/"/g, '""');
        const header = ['ID', 'Protocolo', 'Status', 'Prioridade', 'Contato', 'Telefone', 'Agente', 'Departamento', 'Criado em', 'Atualizado em'];
        const rows = tickets.map(t => [
            t.id,
            '#' + t.id.slice(-6).toUpperCase(),
            t.status,
            t.priority,
            t.contact.name,
            t.contact.phoneNumber,
            t.assignedUser?.name || '',
            t.department.name,
            t.createdAt.toLocaleDateString('pt-BR'),
            t.updatedAt.toLocaleDateString('pt-BR'),
        ]);

        return [header, ...rows].map(r => r.map(c => `"${escape(c)}"`).join(',')).join('\n');
    }

    async findOne(companyId: string, id: string) {
        const ticket = await this.prisma.ticket.findFirst({
            where: { id, companyId },
            include: {
                contact: true,
                department: true,
                whatsappInstance: true,
                assignedUser: true,
                messages: {
                    orderBy: { sentAt: 'asc' },
                    take: 50,
                },
                tags: {
                    include: { tag: true }
                }
            },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket com ID ${id} não encontrado nesta empresa`);
        }

        return ticket;
    }

    async getPublicTicket(publicToken: string) {
        // Busca por publicToken (campo opaco), não pelo id UUID interno.
        // Isso evita que usuários descubram tickets por força bruta / enumeração de IDs.
        const ticket = await this.prisma.ticket.findUnique({
            where: { publicToken },
            include: {
                contact: { select: { name: true } },
                department: { select: { name: true } },
                company: { select: { name: true, logoUrl: true, primaryColor: true } },
                messages: {
                    orderBy: { sentAt: 'asc' },
                    select: {
                        id: true,
                        content: true,
                        sentAt: true,
                        fromMe: true,
                        messageType: true,
                    },
                    take: 100,
                },
            },
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket não encontrado`);
        }

        return {
            id: ticket.id,
            publicToken: ticket.publicToken,
            status: ticket.status,
            subject: ticket.subject,
            createdAt: ticket.createdAt,
            resolvedAt: (ticket as any).resolvedAt ?? null,
            csatPending: (ticket as any).csatPending ?? false,
            contact: ticket.contact,
            department: ticket.department,
            company: ticket.company,
            messages: ticket.messages,
        };
    }

    async update(companyId: string, id: string, updateTicketDto: UpdateTicketDto, actorUserId?: string) {
        // Lean SELECT (only fields needed for diff logic) instead of full findOne with 5 relations
        const oldTicket = await this.prisma.ticket.findFirst({
            where: { id, companyId },
            select: { id: true, status: true, departmentId: true, assignedUserId: true },
        });
        if (!oldTicket) throw new NotFoundException(`Ticket com ID ${id} não encontrado nesta empresa`);

        const updatedTicket = await this.prisma.ticket.update({
            where: { id },
            data: {
                ...(updateTicketDto.status && { status: updateTicketDto.status as TicketStatus }),
                ...(updateTicketDto.priority && { priority: updateTicketDto.priority as TicketPriority }),
                ...(updateTicketDto.assignedUserId && { assignedUserId: updateTicketDto.assignedUserId }),
                ...(updateTicketDto.departmentId && { departmentId: updateTicketDto.departmentId }),
                // Transferência manual: pausa IA automaticamente para não sobrepor atendimento humano
                ...(updateTicketDto.departmentId &&
                    updateTicketDto.departmentId !== oldTicket.departmentId &&
                    !updateTicketDto.mode && { mode: 'MANUAL' }),
                ...(updateTicketDto.subject && { subject: updateTicketDto.subject }),
                ...(updateTicketDto.mode && { mode: updateTicketDto.mode }),
                // Se estiver reabrindo, limpa datas de fechamento
                // Se reabrindo, limpa datas de fechamento
                ...(updateTicketDto.status === TicketStatus.OPEN && {
                    closedAt: null,
                    resolvedAt: null,
                }),
                // Se resolvendo manualmente, registra timestamps
                ...(updateTicketDto.status === TicketStatus.RESOLVED && {
                    resolvedAt: new Date(),
                    closedAt: new Date(),
                }),
                // Sync de tags: substitui todas as tags existentes
                ...(updateTicketDto.tagIds !== undefined && {
                    tags: {
                        deleteMany: {},
                        ...(updateTicketDto.tagIds.length > 0 && {
                            create: updateTicketDto.tagIds.map(tagId => ({
                                tag: { connect: { id: tagId } }
                            }))
                        })
                    }
                }),
            },
            include: {
                contact: true,
                department: true,
                whatsappInstance: true,
                assignedUser: true,
                tags: { include: { tag: true } },
            }
        });

        // Audit Log com companyId obrigatório
        await this.auditService.log({
            userId: actorUserId || null,
            companyId,
            action: 'UPDATE',
            entity: 'Ticket',
            entityId: id,
            changes: updateTicketDto
        });

        // Emitir evento de mudança de status se o status foi alterado
        if (updateTicketDto.status && updateTicketDto.status !== oldTicket.status) {
            this.eventEmitter.emit('ticket.status_changed', {
                ticketId: id,
                companyId,
                oldStatus: oldTicket.status,
                newStatus: updatedTicket.status,
                ticket: updatedTicket
            });

            // Evento específico para cancelamento (RiskScoreService atualiza contact.riskScore)
            if (updatedTicket.status === TicketStatus.CANCELLED) {
                this.eventEmitter.emit('ticket.cancelled', {
                    ticketId: id,
                    companyId,
                    ticket: updatedTicket,
                });
            }

            // Evento de resolução manual via update (aciona CSAT + workflows)
            if (updatedTicket.status === TicketStatus.RESOLVED) {
                this.eventEmitter.emit('ticket.resolved', {
                    ticketId: id,
                    companyId,
                    ticket: updatedTicket,
                    connectionId: (updatedTicket as any).whatsappInstance?.id || (updatedTicket as any).connectionId,
                    contact: (updatedTicket as any).contact,
                });
            }
        }

        // Emitir evento de transferência de departamento
        if (updateTicketDto.departmentId && updateTicketDto.departmentId !== oldTicket.departmentId) {
            this.eventEmitter.emit('ticket.transferred', {
                ticketId: id,
                companyId,
                fromDepartmentId: oldTicket.departmentId,
                toDepartmentId: updatedTicket.departmentId,
                ticket: updatedTicket
            });
        }

        // Notificar usuário quando atribuição muda
        if (updateTicketDto.assignedUserId && updateTicketDto.assignedUserId !== oldTicket.assignedUserId) {
            this.eventEmitter.emit('ticket.assigned', { ticket: updatedTicket, assignedUserId: updatedTicket.assignedUserId });
        }

        return updatedTicket;
    }

    async assign(companyId: string, id: string, userId: string, actorUserId?: string) {
        return this.update(companyId, id, { assignedUserId: userId }, actorUserId);
    }

    async resolve(companyId: string, id: string, actorUserId?: string) {
        const ticket = await this.prisma.ticket.findFirst({
            where: { id, companyId },
            include: {
                department: true,
                contact: true,
                messages: { orderBy: { sentAt: 'asc' } }
            }
        });

        if (!ticket) {
            throw new NotFoundException(`Ticket com ID ${id} não encontrado`);
        }

        let aiSummary = null;
        if (ticket.department?.aiAgentId && ticket.messages.length > 0) {
            this.logger.log(`Gerando resumo final via IA para o ticket ${id}`);
            aiSummary = await this.aiService.summarize(companyId, ticket.department.aiAgentId, ticket.messages);
        }

        const resolvedTicket = await this.prisma.ticket.update({
            where: { id },
            data: {
                status: TicketStatus.RESOLVED,
                closedAt: new Date(),
                resolvedAt: new Date(),
                summary: aiSummary,
            }
        });

        // Emitir evento de mudança de status
        this.eventEmitter.emit('ticket.status_changed', {
            ticketId: id,
            companyId,
            oldStatus: ticket.status,
            newStatus: TicketStatus.RESOLVED,
            ticket: resolvedTicket
        });

        // Emitir evento dedicado ticket.resolved (para workflows e listeners)
        // Passa contact, connectionId e departmentId diretamente (evita queries redundantes)
        this.eventEmitter.emit('ticket.resolved', {
            ticketId: id,
            companyId,
            ticket: resolvedTicket,
            summary: aiSummary,
            contact: ticket.contact,
            connectionId: ticket.connectionId ?? null,
            departmentId: ticket.departmentId ?? null,
        });

        // Audit Log
        await this.auditService.log({
            userId: actorUserId || resolvedTicket.assignedUserId || null,
            companyId,
            action: 'RESOLVE',
            entity: 'Ticket',
            entityId: id,
            changes: { summary: aiSummary }
        });

        return resolvedTicket;
    }

    /**
     * Listener centralizado: dispara CSAT para TODOS os caminhos de resolução
     * (resolução manual via API, resolução via update(), IA [FINALIZAR]).
     */
    @OnEvent('ticket.resolved')
    async onTicketResolved(data: {
        ticketId: string;
        companyId: string;
        contact?: any;
        connectionId?: string | null;
        departmentId?: string | null;
    }) {
        try {
            let contact = data.contact;
            let connectionId = data.connectionId ?? null;
            let departmentId = data.departmentId ?? null;

            // Fallback: buscar do banco se não veio no evento
            if (!contact || !connectionId) {
                const ticket = await this.prisma.ticket.findUnique({
                    where: { id: data.ticketId },
                    include: { contact: true },
                });
                if (!ticket) return;
                contact = ticket.contact;
                connectionId = (ticket as any).connectionId;
                departmentId = departmentId ?? (ticket as any).departmentId ?? null;
            }

            const csatSent = await this.sendCsatIfEnabled(data.companyId, data.ticketId, contact, connectionId, departmentId);

            // Se CSAT não foi enviado, dispara sentimento como fallback imediato
            if (!csatSent) {
                this.evaluationsService.generateAISentimentAnalysis(data.companyId, data.ticketId).catch(err => {
                    this.logger.warn(`[onTicketResolved] Falha na análise de sentimento para ticket ${data.ticketId}: ${err.message}`);
                });
            }
        } catch (err) {
            this.logger.warn(`[onTicketResolved] Falha ao processar CSAT para ticket ${data.ticketId}: ${err.message}`);
        }
    }

    private async checkCanDeleteTickets(companyId: string): Promise<boolean> {
        const cached = this.deleteSettingsCache.get(companyId);
        if (cached && Date.now() < cached.expiresAt) return cached.canDelete;
        const s = await this.prisma.setting.findFirst({
            where: { companyId, key: 'canDeleteTickets' }, select: { value: true },
        });
        const canDelete = s?.value === 'true' || s?.value === '"true"';
        this.deleteSettingsCache.set(companyId, { canDelete, expiresAt: Date.now() + 5 * 60_000 });
        return canDelete;
    }

    private async sendCsatIfEnabled(companyId: string, ticketId: string, contact: any, connectionId: string | null, departmentId?: string | null): Promise<boolean> {
        if (!contact?.phoneNumber || !connectionId) return false;

        // 1. Enviar mensagem de encerramento do departamento (se configurada)
        if (departmentId) {
            const dept = await this.prisma.department.findUnique({
                where: { id: departmentId },
                select: { closingMessage: true },
            });
            if ((dept as any)?.closingMessage) {
                this.eventEmitter.emit('csat.pending', {
                    companyId,
                    ticketId,
                    connectionId,
                    phoneNumber: contact.phoneNumber,
                    message: (dept as any).closingMessage,
                });
                this.logger.log(`Mensagem de encerramento do departamento enviada para ${contact.phoneNumber} (ticket ${ticketId})`);
            }
        }

        // 2. Ler configuração CSAT — cache em memória 5 min
        const now = Date.now();
        let csatConf = this.csatCache.get(companyId);
        if (!csatConf || csatConf.expiresAt < now) {
            const settings = await this.prisma.setting.findMany({
                where: { companyId, key: { in: ['csat_enabled', 'csat_message'] } },
                select: { key: true, value: true },
            });
            const byKey = Object.fromEntries(settings.map(s => [s.key, s.value ?? '']));
            const rawMsg = byKey['csat_message'];
            let parsedMsg: string | null = null;
            if (rawMsg) {
                const rawStr = String(rawMsg);
                try { parsedMsg = JSON.parse(rawStr); } catch { parsedMsg = rawStr.replace(/^"|"$/g, ''); }
            }
            csatConf = {
                enabled: byKey['csat_enabled'] === 'true' || byKey['csat_enabled'] === '"true"',
                message: parsedMsg || null,
                expiresAt: now + 5 * 60 * 1000,
            };
            this.csatCache.set(companyId, csatConf);
        }

        const csatEnabled = csatConf.enabled;
        const csatMessage = csatConf.message;

        if (!csatEnabled || !csatMessage) {
            this.logger.debug(`CSAT desabilitado ou sem mensagem configurada para empresa ${companyId}`);
            return false;
        }

        // 3. Garantir registro de avaliação no banco (upsert mínimo — evita perda de nota CSAT)
        await this.prisma.evaluation.upsert({
            where: { ticketId },
            update: {},
            create: {
                ticketId,
                companyId,
                aiSentiment: 'NEUTRAL' as any,
                aiSentimentScore: 5,
                aiJustification: 'Aguardando avaliação do cliente',
                aiSummary: '',
            },
        });

        // 4. Marcar contato como aguardando resposta CSAT
        await this.prisma.contact.update({
            where: { id: contact.id },
            data: { csatPending: true, csatTicketId: ticketId },
        });

        // 5. Emitir evento para WhatsApp service enviar a mensagem CSAT
        this.eventEmitter.emit('csat.pending', {
            companyId,
            ticketId,
            connectionId,
            phoneNumber: contact.phoneNumber,
            message: csatMessage,
        });

        this.logger.log(`CSAT agendado para contato ${contact.phoneNumber} (ticket ${ticketId})`);
        return true;
    }

    async pause(companyId: string, id: string) {
        return this.update(companyId, id, { status: TicketStatus.PAUSED });
    }

    async remove(companyId: string, id: string) {
        if (!await this.checkCanDeleteTickets(companyId))
            throw new ForbiddenException('A exclusão de tickets está desativada nas configurações da empresa');
        await this.findOne(companyId, id);
        return this.prisma.ticket.delete({ where: { id } });
    }

    async bulkAction(companyId: string, bulkDto: BulkTicketActionDto) {
        const { ids, action, targetId } = bulkDto;
        this.logger.log(`Executando ação em lote ${action} para ${ids.length} tickets na empresa ${companyId}`);

        // Verificação de segurança: garantir que todos os IDs pertencem à empresa
        const count = await this.prisma.ticket.count({
            where: { id: { in: ids }, companyId }
        });

        if (count !== ids.length) {
            throw new NotFoundException('Um ou mais tickets não pertencem a esta empresa ou não foram encontrados');
        }

        if (action === BulkTicketAction.DELETE && !await this.checkCanDeleteTickets(companyId))
            throw new ForbiddenException('A exclusão de tickets está desativada nas configurações da empresa');

        const result = await this.prisma.$transaction(async (tx) => {
            switch (action) {
                case BulkTicketAction.RESOLVE:
                    return tx.ticket.updateMany({
                        where: { id: { in: ids } },
                        data: {
                            status: TicketStatus.RESOLVED,
                            closedAt: new Date(),
                            resolvedAt: new Date(),
                        }
                    });

                case BulkTicketAction.PAUSE:
                    return tx.ticket.updateMany({
                        where: { id: { in: ids } },
                        data: { status: TicketStatus.PAUSED }
                    });

                case BulkTicketAction.ASSIGN:
                    if (!targetId) throw new Error('ID de destino (usuário) é obrigatório para atribuição em lote');
                    return tx.ticket.updateMany({
                        where: { id: { in: ids } },
                        data: { assignedUserId: targetId }
                    });

                case BulkTicketAction.DELETE:
                    return tx.ticket.deleteMany({
                        where: { id: { in: ids } }
                    });

                default:
                    throw new Error('Ação em lote inválida');
            }
        });

        // Emitir eventos para cada ticket alterado (apenas se for mudança de status relevante)
        if (action === BulkTicketAction.RESOLVE || action === BulkTicketAction.PAUSE) {
            const newStatus = action === BulkTicketAction.RESOLVE ? TicketStatus.RESOLVED : TicketStatus.PAUSED;
            for (const id of ids) {
                this.eventEmitter.emit('ticket.status_changed', {
                    ticketId: id,
                    companyId,
                    newStatus,
                });
            }
        }

        return result;
    }

    async scheduleMessage(companyId: string, ticketId: string, userId: string, content: string, scheduledAt: string) {
        const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
        if (!ticket) throw new NotFoundException('Ticket não encontrado');

        const sendAt = new Date(scheduledAt);
        if (sendAt.getTime() <= Date.now()) throw new BadRequestException('Data/hora de agendamento deve ser no futuro');

        const scheduled = await this.prisma.scheduledMessage.create({
            data: { ticketId, companyId, userId, content, scheduledAt: sendAt },
        });

        const delay = sendAt.getTime() - Date.now();
        const job = await this.schedulingQueue.add(
            'send-scheduled-message',
            { scheduledMessageId: scheduled.id, ticketId, companyId },
            { delay, jobId: `scheduled-msg-${scheduled.id}` },
        );

        await this.prisma.scheduledMessage.update({
            where: { id: scheduled.id },
            data: { jobId: job.id?.toString() },
        });

        return scheduled;
    }

    async getScheduledMessages(companyId: string, ticketId: string) {
        return this.prisma.scheduledMessage.findMany({
            where: { ticketId, companyId, status: 'PENDING' },
            orderBy: { scheduledAt: 'asc' },
        });
    }

    async cancelScheduledMessage(companyId: string, id: string) {
        const msg = await this.prisma.scheduledMessage.findFirst({ where: { id, companyId } });
        if (!msg) throw new NotFoundException('Mensagem agendada não encontrada');

        if (msg.jobId) {
            const job = await this.schedulingQueue.getJob(msg.jobId);
            if (job) await job.remove();
        }

        return this.prisma.scheduledMessage.update({ where: { id }, data: { status: 'CANCELLED' } });
    }

    async mergeTicket(companyId: string, sourceId: string, targetId: string, userId: string) {
        if (sourceId === targetId) throw new BadRequestException('Tickets devem ser diferentes');

        const [source, target] = await Promise.all([
            this.prisma.ticket.findFirst({ where: { id: sourceId, companyId } }),
            this.prisma.ticket.findFirst({ where: { id: targetId, companyId } }),
        ]);

        if (!source) throw new NotFoundException('Ticket de origem não encontrado');
        if (!target) throw new NotFoundException('Ticket de destino não encontrado');

        await this.prisma.$transaction(async (tx) => {
            // Transfer messages
            await tx.message.updateMany({ where: { ticketId: sourceId }, data: { ticketId: targetId } });

            // Transfer tags (skip duplicates)
            const sourceTags = await tx.ticketTag.findMany({ where: { ticketId: sourceId } });
            const targetTags = await tx.ticketTag.findMany({ where: { ticketId: targetId }, select: { tagId: true } });
            const existingTagIds = new Set(targetTags.map(t => t.tagId));
            const newTags = sourceTags.filter(t => !existingTagIds.has(t.tagId));
            if (newTags.length > 0) {
                await tx.ticketTag.createMany({ data: newTags.map(t => ({ ticketId: targetId, tagId: t.tagId })) });
            }

            // Transfer scheduled messages
            await tx.scheduledMessage.updateMany({ where: { ticketId: sourceId }, data: { ticketId: targetId } });

            // Close source ticket
            await tx.ticket.update({ where: { id: sourceId }, data: { status: TicketStatus.RESOLVED, closedAt: new Date() } });
        });

        this.auditService.log({ action: 'ticket.merged', entity: 'Ticket', entityId: targetId, changes: { sourceId }, userId, companyId });

        return this.prisma.ticket.findUnique({ where: { id: targetId }, include: { contact: true, department: true, assignedUser: true } });
    }
}
