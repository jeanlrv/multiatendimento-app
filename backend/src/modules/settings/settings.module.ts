import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { QuickRepliesService } from './quick-replies.service';
import { QuickRepliesController } from './quick-replies.controller';
import { ProviderConfigService } from './provider-config.service';
import { ProviderConfigController } from './provider-config.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SettingsController, IntegrationsController, QuickRepliesController, ProviderConfigController],
    providers: [SettingsService, IntegrationsService, QuickRepliesService, ProviderConfigService],
    exports: [SettingsService, IntegrationsService, QuickRepliesService, ProviderConfigService],
})
export class SettingsModule { }
