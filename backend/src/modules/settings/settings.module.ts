import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { QuickRepliesService } from './quick-replies.service';
import { QuickRepliesController } from './quick-replies.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [],
    controllers: [SettingsController, IntegrationsController, QuickRepliesController],
    providers: [SettingsService, IntegrationsService, QuickRepliesService],
    exports: [SettingsService, IntegrationsService, QuickRepliesService],
})
export class SettingsModule { }
