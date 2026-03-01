import { Module, forwardRef } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { DatabaseModule } from '../../database/database.module';

import { AIEngineModule } from './engine/ai-engine.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ConfigModule } from '@nestjs/config';
import { EmbedModule } from './embed/embed.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SettingsModule } from '../settings/settings.module';

// ConversationHistoryService, NotificationService, LLMProviderFactory e S3Service são
// fornecidos e exportados por AIEngineModule — não precisam ser redeclarados aqui.
// Redeclarar causaria falha de DI porque @InjectQueue('knowledge-processing')
// só está registrado em AIEngineModule.

@Module({
    imports: [
        DatabaseModule,
        AIEngineModule,
        KnowledgeModule,
        ConfigModule,
        forwardRef(() => EmbedModule),
        ApiKeysModule,
        SettingsModule,
    ],
    controllers: [AIController],
    providers: [AIService],
    exports: [AIService, EmbedModule],
})
export class AIModule { }
