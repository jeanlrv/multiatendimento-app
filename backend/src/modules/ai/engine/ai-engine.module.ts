import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LLMService } from './llm.service';
import { VectorStoreService } from './vector-store.service';
import { LLMProviderFactory } from './llm-provider.factory';
import { EmbeddingProviderFactory } from './embedding-provider.factory';
import { EmbeddingCacheService } from './embedding-cache.service';
import { ConversationHistoryService } from '../conversation-history.service';
import { NotificationService } from '../notifications/notification.service';
import { DatabaseModule } from '../../../database/database.module';

import { S3Service } from '../storage/s3.service';

@Module({
    imports: [
        DatabaseModule,
        BullModule.registerQueue({
            name: 'knowledge-processing',
        }),
    ],
    providers: [LLMService, VectorStoreService, LLMProviderFactory, EmbeddingProviderFactory, EmbeddingCacheService, ConversationHistoryService, NotificationService, S3Service],
    exports: [LLMService, VectorStoreService, LLMProviderFactory, EmbeddingProviderFactory, EmbeddingCacheService, ConversationHistoryService, NotificationService, S3Service],
})
export class AIEngineModule { }
