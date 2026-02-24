import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Company } from '../../common/decorators/company.decorator';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Permission } from '../auth/constants/permissions';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) { }

    @Get()
    @ApiOperation({ summary: 'Listar perfis de acesso da empresa' })
    findAll(@Company() companyId: string) {
        return this.rolesService.findAll(companyId);
    }

    @Get(':id')
    @RequirePermission(Permission.ROLES_READ)
    @ApiOperation({ summary: 'Buscar perfil por ID' })
    findOne(
        @Company() companyId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.rolesService.findOne(companyId, id);
    }

    @Post()
    @RequirePermission(Permission.ROLES_CREATE)
    @ApiOperation({ summary: 'Criar novo perfil de acesso' })
    create(
        @Company() companyId: string,
        @Body() createRoleDto: CreateRoleDto,
    ) {
        return this.rolesService.create(companyId, createRoleDto);
    }

    @Patch(':id')
    @RequirePermission(Permission.ROLES_UPDATE)
    @ApiOperation({ summary: 'Atualizar perfil de acesso' })
    update(
        @Company() companyId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateRoleDto: UpdateRoleDto,
    ) {
        return this.rolesService.update(companyId, id, updateRoleDto);
    }

    @Delete(':id')
    @RequirePermission(Permission.ROLES_DELETE)
    @ApiOperation({ summary: 'Excluir perfil de acesso' })
    remove(
        @Company() companyId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.rolesService.remove(companyId, id);
    }
}
