import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { VectorStoreService } from './vector-store.service';
import { LLMProviderFactory } from './llm-provider.factory';
import { DatabaseModule } from '../../../database/database.module';

@Module({
    imports: [ConfigModule, DatabaseModule],
    providers: [LLMService, VectorStoreService, LLMProviderFactory],
    exports: [LLMService, VectorStoreService, LLMProviderFactory],
})
export class AIEngineModule { }
