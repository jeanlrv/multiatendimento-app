import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ReportsService } from './reports.service';
import { DashboardController } from './dashboard.controller';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [DatabaseModule, MailModule],
    providers: [DashboardService, ReportsService],
    controllers: [DashboardController],
    exports: [DashboardService],
})
export class DashboardModule { }
