import { Module, forwardRef } from '@nestjs/common';
import { EmbedService } from './embed.service';
import { EmbedController } from './embed.controller';
import { PrismaService } from '../../../database/prisma.service';
import { AIModule } from '../ai.module';

@Module({
    imports: [forwardRef(() => AIModule)],
    // AIService e Engine(s) são importadas através do AIModule caso necessário,
    // Mas como EmbedModule pode ser injetado no AIModule ou compartilhar providers,
    // É importante passar os providers ou importar módulos corretos.
    providers: [EmbedService, PrismaService],
    controllers: [EmbedController],
    exports: [EmbedService]
})
export class EmbedModule { }
