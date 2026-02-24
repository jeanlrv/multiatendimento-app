import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { SchedulingProcessor } from './scheduling.processor';
import { DatabaseModule } from '../../database/database.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [
        DatabaseModule,
        BullModule.registerQueue({
            name: 'scheduling',
        }),
    ],
    controllers: [SchedulingController],
    providers: [SchedulingService, SchedulingProcessor],
    exports: [SchedulingService],
})
export class SchedulingModule { }
