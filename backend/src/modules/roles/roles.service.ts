import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ALL_PERMISSIONS } from '../auth/constants/permissions';

/** Nomes de perfis protegidos que não podem ser excluídos */
const PROTECTED_ROLE_NAMES = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADOR GLOBAL'];

const isProtectedRole = (name: string) =>
    PROTECTED_ROLE_NAMES.some(p => name.toUpperCase().includes(p));

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) { }

    async findAll(companyId: string) {
        return this.prisma.role.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { users: true } },
            },
        });
    }

    async findOne(companyId: string, id: string) {
        const role = await this.prisma.role.findFirst({
            where: { id, companyId },
            include: {
                _count: { select: { users: true } },
            },
        });
        if (!role) throw new NotFoundException('Perfil de acesso não encontrado');
        return role;
    }

    async create(companyId: string, dto: CreateRoleDto) {
        const existing = await this.prisma.role.findFirst({
            where: { companyId, name: { equals: dto.name, mode: 'insensitive' } },
        });
        if (existing) throw new ConflictException('Já existe um perfil com esse nome');

        // Se for admin, garante todas as permissões
        const permissions = isProtectedRole(dto.name)
            ? ALL_PERMISSIONS
            : (dto.permissions ?? []);

        return this.prisma.role.create({
            data: { name: dto.name, description: dto.description, permissions, companyId },
            include: { _count: { select: { users: true } } },
        });
    }

    async update(companyId: string, id: string, dto: UpdateRoleDto) {
        const role = await this.findOne(companyId, id);

        // Admin sempre mantém todas as permissões
        let permissions = dto.permissions ?? role.permissions;
        if (isProtectedRole(role.name) || (dto.name && isProtectedRole(dto.name))) {
            permissions = ALL_PERMISSIONS;
        }

        // Se mudar o nome, verificar unicidade
        if (dto.name && dto.name !== role.name) {
            const conflict = await this.prisma.role.findFirst({
                where: { companyId, name: { equals: dto.name, mode: 'insensitive' }, NOT: { id } },
            });
            if (conflict) throw new ConflictException('Já existe um perfil com esse nome');
        }

        return this.prisma.role.update({
            where: { id },
            data: {
                name: dto.name ?? role.name,
                description: dto.description !== undefined ? dto.description : role.description,
                permissions,
            },
            include: { _count: { select: { users: true } } },
        });
    }

    async remove(companyId: string, id: string) {
        const role = await this.findOne(companyId, id);

        if (isProtectedRole(role.name)) {
            throw new ForbiddenException(
                'O perfil de administrador é protegido e não pode ser excluído',
            );
        }

        if ((role as any)._count?.users > 0) {
            throw new ConflictException(
                `Este perfil possui ${(role as any)._count.users} usuário(s) vinculado(s). Remova ou reatribua os usuários antes de excluí-lo.`,
            );
        }

        await this.prisma.role.delete({ where: { id } });
        return { message: 'Perfil removido com sucesso' };
    }
}
