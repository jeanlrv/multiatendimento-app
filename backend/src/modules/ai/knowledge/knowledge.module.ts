import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeProcessor } from './processors/knowledge.processor';
import { KnowledgeTextExtractorService } from './processors/knowledge-text-extractor.service';
import { AIEngineModule } from '../engine/ai-engine.module';
import { DatabaseModule } from '../../../database/database.module';
import { SettingsModule } from '../../settings/settings.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
    imports: [
        DatabaseModule,
        AIEngineModule,
        SettingsModule,
        MulterModule.register({
            // Usa memoryStorage para evitar dependência de disco em containers (Railway, Docker)
            // O controller usa seu próprio diskStorage com os.tmpdir() para suportar arquivos grandes
            storage: memoryStorage(),
            limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
        }),
        BullModule.registerQueue({
            name: 'knowledge-processing',
        }),
    ],
    controllers: [KnowledgeController],
    providers: [KnowledgeService, KnowledgeProcessor, KnowledgeTextExtractorService],
    exports: [KnowledgeService, BullModule],
})
export class KnowledgeModule { }
