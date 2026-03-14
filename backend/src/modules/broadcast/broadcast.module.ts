import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BroadcastService } from './broadcast.service';
import { BroadcastController } from './broadcast.controller';
import { BroadcastProcessor } from './broadcast.processor';
import { DatabaseModule } from '../../database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
    imports: [
        DatabaseModule,
        WhatsAppModule,
        BullModule.registerQueue({ name: 'broadcast' }),
    ],
    controllers: [BroadcastController],
    providers: [BroadcastService, BroadcastProcessor],
    exports: [BroadcastService],
})
export class BroadcastModule { }
