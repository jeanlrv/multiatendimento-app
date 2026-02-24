import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { CannedResponsesService } from './canned-responses.service';
import { CannedResponsesController } from './canned-responses.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SettingsController, IntegrationsController, CannedResponsesController],
    providers: [SettingsService, IntegrationsService, CannedResponsesService],
    exports: [SettingsService, IntegrationsService, CannedResponsesService],
})
export class SettingsModule { }
