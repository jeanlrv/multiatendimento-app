import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { RiskScoreService } from './risk-score.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [ContactsController],
    providers: [ContactsService, RiskScoreService],
    exports: [ContactsService, RiskScoreService],
})
export class ContactsModule { }
