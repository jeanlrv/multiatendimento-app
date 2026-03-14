import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get()
    @ApiOperation({ summary: 'Busca global em tickets e contatos' })
    search(
        @Req() req: any,
        @Query('q') q: string,
        @Query('types') types?: string,
    ) {
        const typeList = types ? types.split(',') : ['tickets', 'contacts'];
        return this.searchService.globalSearch(req.user.companyId, q || '', typeList);
    }
}
