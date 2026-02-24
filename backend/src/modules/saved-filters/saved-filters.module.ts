import { Module } from '@nestjs/common';
import { SavedFiltersService } from './saved-filters.service';
import { SavedFiltersController } from './saved-filters.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [SavedFiltersController],
    providers: [SavedFiltersService],
    exports: [SavedFiltersService],
})
export class SavedFiltersModule { }
