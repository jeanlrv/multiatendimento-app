import {
    Injectable,
    Logger,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScheduleStatus } from '@prisma/client';

@Injectable()
export class SchedulingService {
    private readonly logger = new Logger(SchedulingService.name);

    constructor(
        private prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        @InjectQueue('scheduling') private schedulingQueue: Queue,
    ) { }

    async createSchedule(companyId: string, data: any) {
        if (!data.userId || !data.startTime || !data.endTime) {
            throw new ConflictException('Dados obrigatórios ausentes');
        }

        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);

        if (startTime >= endTime) {
            throw new ConflictException('Horário inválido');
        }

        await this.checkConflict(companyId, data.userId, startTime, endTime);

        const schedule = await this.prisma.schedule.create({
            data: {
                contactId: data.contactId,
                departmentId: data.departmentId,
                userId: data.userId,
                companyId,
                startTime,
                endTime,
                notes: data.notes || '',
                status: 'PENDING',
            },
            include: {
                contact: true,
                user: true,
            },
        });

        this.logger.log(`Schedule criado: ${schedule.id} na empresa ${companyId}`);

        await this.scheduleReminder(schedule);

        this.eventEmitter.emit('schedule.created', schedule);

        return schedule;
    }

    async findAll(companyId: string, filters: any) {
        return this.prisma.schedule.findMany({
            where: {
                companyId,
                departmentId: filters.departmentId || undefined,
                userId: filters.userId || undefined,
                contactId: filters.contactId || undefined,
                startTime: {
                    gte: filters.start ? new Date(filters.start) : undefined,
                    lte: filters.end ? new Date(filters.end) : undefined,
                },
            },
            include: {
                contact: true,
                user: true,
            },
            orderBy: {
                startTime: 'asc',
            },
        });
    }

    async updateStatus(companyId: string, id: string, status: ScheduleStatus) {
        const schedule = await this.prisma.schedule.findFirst({
            where: { id, companyId },
        });

        if (!schedule) {
            throw new NotFoundException('Agendamento não encontrado nesta empresa');
        }

        const updated = await this.prisma.schedule.update({
            where: { id },
            data: { status },
        });

        this.logger.log(`Schedule ${id} atualizado para ${status}`);

        this.eventEmitter.emit('schedule.status_changed', updated);
        this.eventEmitter.emit(`schedule.${status.toLowerCase()}`, updated);

        return updated;
    }

    async updateTime(
        companyId: string,
        id: string,
        body: { startTime: string; endTime: string },
    ) {
        const schedule = await this.prisma.schedule.findFirst({
            where: { id, companyId },
        });

        if (!schedule) {
            throw new NotFoundException('Agendamento não encontrado nesta empresa');
        }

        const startTime = new Date(body.startTime);
        const endTime = new Date(body.endTime);

        if (startTime >= endTime) {
            throw new ConflictException('Horário inválido');
        }

        await this.checkConflict(companyId, schedule.userId, startTime, endTime, id);

        const updated = await this.prisma.schedule.update({
            where: { id },
            data: {
                startTime,
                endTime,
            },
        });

        this.logger.log(`Schedule ${id} teve horário alterado`);

        await this.scheduleReminder(updated);

        this.eventEmitter.emit('schedule.updated', updated);

        return updated;
    }

    async delete(companyId: string, id: string) {
        const schedule = await this.prisma.schedule.findFirst({
            where: { id, companyId },
        });

        if (!schedule) {
            throw new NotFoundException('Agendamento não encontrado nesta empresa');
        }

        await this.prisma.schedule.delete({
            where: { id },
        });

        this.logger.log(`Schedule ${id} removido`);

        this.eventEmitter.emit('schedule.deleted', schedule);

        return { success: true };
    }

    private async checkConflict(
        companyId: string,
        userId: string,
        startTime: Date,
        endTime: Date,
        ignoreId?: string,
    ) {
        const conflict = await this.prisma.schedule.findFirst({
            where: {
                id: ignoreId ? { not: ignoreId } : undefined,
                companyId,
                userId,
                status: { in: ['PENDING', 'CONFIRMED'] },
                startTime: { lt: endTime },
                endTime: { gt: startTime },
            },
        });

        if (conflict) {
            throw new ConflictException('Conflito de horário detectado');
        }
    }

    private async scheduleReminder(schedule: any) {
        const remindAt = new Date(
            schedule.startTime.getTime() - 60 * 60 * 1000,
        );

        if (remindAt.getTime() > Date.now()) {
            await this.schedulingQueue.add(
                'send-reminder',
                { scheduleId: schedule.id },
                {
                    delay: remindAt.getTime() - Date.now(),
                },
            );
        }
    }
}
