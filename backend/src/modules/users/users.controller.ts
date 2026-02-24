import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission } from '../auth/constants/permissions';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { Company } from '../../common/decorators/company.decorator';
import { SubscriptionLimit } from '../../common/decorators/subscription-limit.decorator';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('mentionable')
    @ApiOperation({ summary: 'Listar usuários para menção (apenas dados básicos)' })
    findAllMentionable(@Company() companyId: string) {
        return this.usersService.findAllMentionable(companyId);
    }

    @Get('me')
    @ApiOperation({ summary: 'Obter dados do usuário logado' })
    findMe(@Req() req: any) {
        return this.usersService.findOne(req.user.companyId, req.user.id);
    }

    @Patch('me')
    @ApiOperation({ summary: 'Atualizar dados do próprio usuário (nome, avatar)' })
    updateMe(@Req() req: any, @Body() updateUserDto: Partial<UpdateUserDto>) {
        return this.usersService.update(req.user.companyId, req.user.id, updateUserDto as UpdateUserDto);
    }

    @Patch('me/avatar')
    @ApiOperation({ summary: 'Atualizar avatar do usuário logado' })
    updateMyAvatar(@Req() req: any, @Body() body: { avatarUrl: string }) {
        return this.usersService.update(req.user.companyId, req.user.id, { avatar: body.avatarUrl } as any);
    }

    @Post()
    @UseGuards(SubscriptionGuard)
    @SubscriptionLimit('maxUsers')
    @RequirePermission(Permission.USERS_CREATE)
    @ApiOperation({ summary: 'Criar novo usuário' })
    @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
    create(@Company() companyId: string, @Body() createUserDto: CreateUserDto) {
        return this.usersService.create(companyId, createUserDto);
    }

    @Get()
    @RequirePermission(Permission.USERS_READ)
    @ApiOperation({ summary: 'Listar todos os usuários' })
    findAll(@Company() companyId: string) {
        return this.usersService.findAll(companyId);
    }

    @Get(':id')
    @RequirePermission(Permission.USERS_READ)
    @ApiOperation({ summary: 'Buscar usuário por ID' })
    findOne(@Company() companyId: string, @Param('id') id: string) {
        return this.usersService.findOne(companyId, id);
    }

    @Patch(':id')
    @RequirePermission(Permission.USERS_UPDATE)
    @ApiOperation({ summary: 'Atualizar usuário' })
    update(@Company() companyId: string, @Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.usersService.update(companyId, id, updateUserDto);
    }

    @Delete(':id')
    @RequirePermission(Permission.USERS_DELETE)
    @ApiOperation({ summary: 'Remover usuário' })
    remove(@Company() companyId: string, @Param('id') id: string) {
        return this.usersService.remove(companyId, id);
    }
}
