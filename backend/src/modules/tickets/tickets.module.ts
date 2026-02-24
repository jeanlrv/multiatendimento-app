import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TicketsService } from './tickets.service';
import { SlaMonitorService } from './sla-monitor.service';
import { TicketsController } from './tickets.controller';
import { DatabaseModule } from '../../database/database.module';
import { AIModule } from '../ai/ai.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'tickets-monitor',
        }),
        DatabaseModule,
        AIModule,
        EvaluationsModule,
        AuditModule
    ],
    controllers: [TicketsController],
    providers: [TicketsService, SlaMonitorService],
    exports: [TicketsService]
})
export class TicketsModule { }
