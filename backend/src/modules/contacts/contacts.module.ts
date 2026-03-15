import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { RiskScoreService } from './risk-score.service';
import { DatabaseModule } from '../../database/database.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
    imports: [DatabaseModule, CustomersModule],
    controllers: [ContactsController],
    providers: [ContactsService, RiskScoreService],
    exports: [ContactsService, RiskScoreService],
})
export class ContactsModule { }
