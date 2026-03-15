import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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

        // Automatic Assignment Logic
        if (createTicketDto.departmentId) {
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

    async getPublicTicket(id: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id },
            include: {
                contact: { select: { name: true } },
                department: { select: { name: true } },
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
            status: ticket.status,
            subject: ticket.subject,
            createdAt: ticket.createdAt,
            resolvedAt: (ticket as any).resolvedAt ?? null,
            contact: ticket.contact,
            department: ticket.department,
            messages: ticket.messages,
        };
    }

    async update(companyId: string, id: string, updateTicketDto: UpdateTicketDto, actorUserId?: string) {
        const oldTicket = await this.findOne(companyId, id);

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
        this.eventEmitter.emit('ticket.resolved', {
            ticketId: id,
            companyId,
            ticket: resolvedTicket,
            summary: aiSummary,
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

        // Disparar análise de sentimento em background
        this.evaluationsService.generateAISentimentAnalysis(companyId, id).catch(err => {
            this.logger.error(`Falha ao gerar análise de sentimento para ticket ${id}: ${err.message}`);
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
    }) {
        try {
            // Se o evento já trouxe contact e connectionId (caminhos da IA), usar direto
            let contact = data.contact;
            let connectionId = data.connectionId ?? null;

            // Fallback: buscar do banco se não veio no evento (resolve() manual)
            if (!contact || !connectionId) {
                const ticket = await this.prisma.ticket.findUnique({
                    where: { id: data.ticketId },
                    include: { contact: true },
                });
                if (!ticket) return;
                contact = ticket.contact;
                connectionId = (ticket as any).connectionId;
            }

            await this.sendCsatIfEnabled(data.companyId, data.ticketId, contact, connectionId);
        } catch (err) {
            this.logger.warn(`[onTicketResolved] Falha ao processar CSAT para ticket ${data.ticketId}: ${err.message}`);
        }
    }

    private async sendCsatIfEnabled(companyId: string, ticketId: string, contact: any, connectionId: string | null) {
        if (!contact?.phoneNumber || !connectionId) return;

        // Ler configuração CSAT do key-value settings store
        const csatEnabledSetting = await this.prisma.setting.findUnique({
            where: { companyId_key: { companyId, key: 'csat_enabled' } },
        });
        const csatMessageSetting = await this.prisma.setting.findUnique({
            where: { companyId_key: { companyId, key: 'csat_message' } },
        });

        const csatEnabled = csatEnabledSetting?.value === 'true' || csatEnabledSetting?.value === '"true"';
        const rawCsatMessage = csatMessageSetting?.value;
        const csatMessage = rawCsatMessage
            ? String(rawCsatMessage).replace(/^"|"$/g, '') // remover aspas do JSON.stringify
            : null;

        if (!csatEnabled || !csatMessage) {
            this.logger.debug(`CSAT desabilitado ou sem mensagem configurada para empresa ${companyId}`);
            return;
        }

        // Marcar contato como aguardando resposta CSAT
        await this.prisma.contact.update({
            where: { id: contact.id },
            data: { csatPending: true, csatTicketId: ticketId } as any,
        });

        // Emitir evento para WhatsApp service enviar a mensagem
        this.eventEmitter.emit('csat.pending', {
            companyId,
            ticketId,
            connectionId,
            phoneNumber: contact.phoneNumber,
            message: csatMessage,
        });

        this.logger.log(`CSAT agendado para contato ${contact.phoneNumber} (ticket ${ticketId})`);
    }

    async pause(companyId: string, id: string) {
        return this.update(companyId, id, { status: TicketStatus.PAUSED });
    }

    async remove(companyId: string, id: string) {
        await this.findOne(companyId, id);
        return this.prisma.ticket.delete({
            where: { id }
        });
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
