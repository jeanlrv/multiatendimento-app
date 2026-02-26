import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { VectorStoreService } from './vector-store.service';
import { LLMProviderFactory } from './llm-provider.factory';
import { EmbeddingCacheService } from './embedding-cache.service';
import { ConversationHistoryService } from '../conversation-history.service';
import { NotificationService } from '../notifications/notification.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
    imports: [DatabaseModule],
    providers: [LLMService, VectorStoreService, LLMProviderFactory, EmbeddingCacheService, ConversationHistoryService, NotificationService],
    exports: [LLMService, VectorStoreService, LLMProviderFactory, EmbeddingCacheService, ConversationHistoryService, NotificationService],
})
export class AIEngineModule { }
