import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus, TicketPriority } from '@prisma/client';
import { BulkTicketAction, BulkTicketActionDto } from './dto/bulk-ticket-action.dto';
import { AIService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EvaluationsService } from '../evaluations/evaluations.service';

@Injectable()
export class TicketsService {
    private readonly logger = new Logger(TicketsService.name);

    constructor(
        private prisma: PrismaService,
        private aiService: AIService,
        private evaluationsService: EvaluationsService,
        private auditService: AuditService,
        private eventEmitter: EventEmitter2,
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
                orderBy: { lastMessageAt: 'desc' },
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

    async update(companyId: string, id: string, updateTicketDto: UpdateTicketDto, actorUserId?: string) {
        const oldTicket = await this.findOne(companyId, id);

        const updatedTicket = await this.prisma.ticket.update({
            where: { id },
            data: {
                ...(updateTicketDto.status && { status: updateTicketDto.status as TicketStatus }),
                ...(updateTicketDto.priority && { priority: updateTicketDto.priority as TicketPriority }),
                ...(updateTicketDto.assignedUserId && { assignedUserId: updateTicketDto.assignedUserId }),
                ...(updateTicketDto.departmentId && { departmentId: updateTicketDto.departmentId }),
                ...(updateTicketDto.subject && { subject: updateTicketDto.subject }),
                ...(updateTicketDto.mode && { mode: updateTicketDto.mode }),
            },
            include: {
                contact: true,
                department: true,
                whatsappInstance: true,
                assignedUser: true,
            }
        });

        // Audit Log com companyId obrigatório
        await this.auditService.log({
            userId: actorUserId || 'system',
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

    async resolve(companyId: string, id: string) {
        const ticket = await this.prisma.ticket.findFirst({
            where: { id, companyId },
            include: {
                department: true,
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

        // Audit Log
        await this.auditService.log({
            userId: resolvedTicket.assignedUserId || 'system',
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
}
