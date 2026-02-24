import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { Company } from '../../common/decorators/company.decorator';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@ApiTags('tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    @Post()
    @RequirePermission(Permission.TAGS_MANAGE)
    @ApiOperation({ summary: 'Criar uma nova tag' })
    @ApiResponse({ status: 201, description: 'Tag criada com sucesso.' })
    create(@Company() companyId: string, @Body() createTagDto: CreateTagDto) {
        return this.tagsService.create(companyId, createTagDto);
    }

    @Get()
    @RequirePermission(Permission.TAGS_READ)
    @ApiOperation({ summary: 'Listar todas as tags' })
    findAll(@Company() companyId: string) {
        return this.tagsService.findAll(companyId);
    }

    @Get(':id')
    @RequirePermission(Permission.TAGS_READ)
    @ApiOperation({ summary: 'Buscar uma tag pelo ID' })
    findOne(@Param('id') id: string, @Company() companyId: string) {
        return this.tagsService.findOne(id, companyId);
    }

    @Patch(':id')
    @RequirePermission(Permission.TAGS_MANAGE)
    @ApiOperation({ summary: 'Atualizar uma tag' })
    update(@Param('id') id: string, @Company() companyId: string, @Body() updateTagDto: UpdateTagDto) {
        return this.tagsService.update(id, companyId, updateTagDto);
    }

    @Delete(':id')
    @RequirePermission(Permission.TAGS_MANAGE)
    @ApiOperation({ summary: 'Excluir uma tag' })
    remove(@Param('id') id: string, @Company() companyId: string) {
        return this.tagsService.remove(id, companyId);
    }
}
