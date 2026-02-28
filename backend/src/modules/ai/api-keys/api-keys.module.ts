import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PrismaService } from '../../../database/prisma.service';

@Module({
    providers: [ApiKeysService],
    controllers: [ApiKeysController],
    exports: [ApiKeysService],
})
export class ApiKeysModule { }
