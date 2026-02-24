import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { SavedFiltersService } from './saved-filters.service';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('saved-filters')
@UseGuards(JwtAuthGuard)
export class SavedFiltersController {
    constructor(private readonly savedFiltersService: SavedFiltersService) { }

    @Post()
    create(@Request() req: any, @Body() createSavedFilterDto: CreateSavedFilterDto) {
        return this.savedFiltersService.create(req.user.sub, req.user.companyId, createSavedFilterDto);
    }

    @Get()
    findAll(@Request() req: any) {
        return this.savedFiltersService.findAll(req.user.sub, req.user.companyId);
    }

    @Delete(':id')
    remove(@Request() req: any, @Param('id') id: string) {
        return this.savedFiltersService.remove(id, req.user.sub);
    }
}
