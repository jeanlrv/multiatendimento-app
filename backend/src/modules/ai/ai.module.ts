import { Module, forwardRef } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { DatabaseModule } from '../../database/database.module';

import { AIEngineModule } from './engine/ai-engine.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { LLMProviderFactory } from './engine/llm-provider.factory';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './storage/s3.service';
import { EmbedModule } from './embed/embed.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SettingsModule } from '../settings/settings.module';
import { ConversationHistoryService } from './conversation-history.service';
import { NotificationService } from './notifications/notification.service';

@Module({
    imports: [DatabaseModule, AIEngineModule, KnowledgeModule, ConfigModule, forwardRef(() => EmbedModule), ApiKeysModule, SettingsModule],

    controllers: [AIController],

    providers: [AIService, LLMProviderFactory, S3Service, ConversationHistoryService, NotificationService],
    exports: [AIService, S3Service, EmbedModule, ConversationHistoryService, NotificationService],
})
export class AIModule { }
