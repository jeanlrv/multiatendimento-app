import { Module, forwardRef } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WebhooksController } from './webhooks.controller';
import { PrismaService } from '../../database/prisma.service';
import { DepartmentsModule } from '../departments/departments.module';
import { ChatModule } from '../chat/chat.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
    imports: [DepartmentsModule, SettingsModule, forwardRef(() => ChatModule)],
    providers: [WhatsAppService],
    controllers: [WhatsAppController, WebhooksController],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }
