import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhookProcessingService } from './webhook-processing.service';
import { WebhookProcessor } from './webhook.processor';
import { DepartmentsModule } from '../departments/departments.module';
import { ChatModule } from '../chat/chat.module';
import { SettingsModule } from '../settings/settings.module';
import { LockService } from '../workflows/core/lock.service';

@Module({
    imports: [
        DepartmentsModule,
        SettingsModule,
        forwardRef(() => ChatModule),
        BullModule.registerQueue({
            name: 'webhooks-incoming',
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        }),
    ],
    providers: [WhatsAppService, LockService, WebhookProcessingService, WebhookProcessor],
    controllers: [WhatsAppController, WebhooksController],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }
