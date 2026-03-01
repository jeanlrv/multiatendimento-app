import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeProcessor } from './processors/knowledge.processor';
import { AIEngineModule } from '../engine/ai-engine.module';
import { DatabaseModule } from '../../../database/database.module';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

@Module({
    imports: [
        DatabaseModule,
        AIEngineModule,
        MulterModule.register({
            storage: diskStorage({
                destination: './storage/uploads',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
                },
            }),
        }),
        BullModule.registerQueue({
            name: 'knowledge-processing',
        }),
    ],
    controllers: [KnowledgeController],
    providers: [KnowledgeService, KnowledgeProcessor],
    exports: [KnowledgeService, BullModule],
})
export class KnowledgeModule { }
