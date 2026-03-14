import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BroadcastService {
    private readonly logger = new Logger(BroadcastService.name);

    constructor(
        private prisma: PrismaService,
        @InjectQueue('broadcast') private broadcastQueue: Queue,
    ) { }

    async create(companyId: string, data: { name: string; message: string; connectionId?: string; contactIds: string[] }) {
        const broadcast = await this.prisma.broadcast.create({
            data: {
                name: data.name,
                message: data.message,
                companyId,
                connectionId: data.connectionId,
                totalContacts: data.contactIds.length,
                recipients: {
                    create: data.contactIds.map(contactId => ({ contactId })),
                },
            },
            include: { recipients: { select: { id: true, contactId: true, status: true } } },
        });
        return broadcast;
    }

    async start(companyId: string, id: string) {
        const broadcast = await this.prisma.broadcast.findFirst({ where: { id, companyId } });
        if (!broadcast) throw new NotFoundException('Broadcast não encontrado');

        await this.prisma.broadcast.update({ where: { id }, data: { status: 'RUNNING' } });

        const recipients = await this.prisma.broadcastRecipient.findMany({
            where: { broadcastId: id, status: 'PENDING' },
            include: { contact: { select: { phoneNumber: true, name: true } } },
        });

        // Enqueue jobs with rate limiting (one per recipient, delayed for rate limit 3/s)
        for (let i = 0; i < recipients.length; i++) {
            const r = recipients[i];
            await this.broadcastQueue.add(
                'send-broadcast-message',
                {
                    broadcastId: id,
                    recipientId: r.id,
                    contactId: r.contactId,
                    phoneNumber: r.contact.phoneNumber,
                    contactName: r.contact.name || '',
                    message: broadcast.message,
                    connectionId: broadcast.connectionId,
                    companyId,
                },
                { delay: Math.floor(i / 3) * 1000 }, // 3 messages per second
            );
        }

        this.logger.log(`Broadcast ${id} iniciado com ${recipients.length} destinatários`);
        return { success: true, queued: recipients.length };
    }

    async pause(companyId: string, id: string) {
        const broadcast = await this.prisma.broadcast.findFirst({ where: { id, companyId } });
        if (!broadcast) throw new NotFoundException('Broadcast não encontrado');
        return this.prisma.broadcast.update({ where: { id }, data: { status: 'PAUSED' } });
    }

    async findAll(companyId: string) {
        return this.prisma.broadcast.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { recipients: true } } },
        });
    }

    async findOne(companyId: string, id: string) {
        const broadcast = await this.prisma.broadcast.findFirst({
            where: { id, companyId },
            include: {
                recipients: {
                    include: { contact: { select: { id: true, name: true, phoneNumber: true } } },
                    orderBy: { createdAt: 'asc' },
                    take: 100,
                },
            },
        });
        if (!broadcast) throw new NotFoundException('Broadcast não encontrado');
        return broadcast;
    }

    async getStatus(companyId: string, id: string) {
        const broadcast = await this.prisma.broadcast.findFirst({
            where: { id, companyId },
            select: { id: true, name: true, status: true, totalContacts: true, sentCount: true, failedCount: true, updatedAt: true },
        });
        if (!broadcast) throw new NotFoundException('Broadcast não encontrado');
        return broadcast;
    }

    async remove(companyId: string, id: string) {
        const broadcast = await this.prisma.broadcast.findFirst({ where: { id, companyId } });
        if (!broadcast) throw new NotFoundException('Broadcast não encontrado');
        await this.prisma.broadcast.delete({ where: { id } });
        return { success: true };
    }
}
