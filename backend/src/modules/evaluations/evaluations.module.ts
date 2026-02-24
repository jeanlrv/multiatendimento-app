import { Module, forwardRef } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';
import { DatabaseModule } from '../../database/database.module';
import { AIModule } from '../ai/ai.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [DatabaseModule, AIModule, forwardRef(() => WorkflowsModule), forwardRef(() => ChatModule)],
    controllers: [EvaluationsController],
    providers: [EvaluationsService],
    exports: [EvaluationsService],
})
export class EvaluationsModule { }
