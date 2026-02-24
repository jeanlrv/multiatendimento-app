import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

/** Campos que sempre incluímos em queries de usuário */
const USER_INCLUDE = {
    role: true,
    departments: {
        include: { department: true },
    },
} as const;

/** Remove o hash de senha do objeto retornado */
function stripPassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
    const { password, ...safe } = user;
    return safe;
}

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async create(companyId: string, createUserDto: CreateUserDto) {
        const { password, departmentIds, departmentId, ...userData } = createUserDto;

        const existingUser = await this.prisma.user.findUnique({
            where: { email: userData.email.toLowerCase() },
        });

        if (existingUser) {
            throw new ConflictException('Email já cadastrado');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Suporta tanto departmentIds[] quanto departmentId (retrocompatibilidade)
        const deptIds = departmentIds ?? (departmentId ? [departmentId] : undefined);

        const newUser = await this.prisma.user.create({
            data: {
                ...userData,
                email: userData.email.toLowerCase(),
                password: hashedPassword,
                companyId,
                departments: deptIds ? {
                    create: deptIds.map((id: string) => ({ departmentId: id })),
                } : undefined,
            },
            include: USER_INCLUDE,
        });

        return stripPassword(newUser);
    }

    async findAll(companyId: string) {
        const users = await this.prisma.user.findMany({
            where: { companyId },
            include: USER_INCLUDE,
            orderBy: { name: 'asc' },
        });

        return users.map(stripPassword);
    }

    async findAllMentionable(companyId: string) {
        return this.prisma.user.findMany({
            where: { companyId },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(companyId: string, id: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, companyId },
            include: USER_INCLUDE,
        });

        if (!user) {
            throw new NotFoundException('Usuário não encontrado nesta empresa');
        }

        return stripPassword(user);
    }

    async findByEmail(email: string) {
        // Usado pelo AuthService — mantém password para validação
        return this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: USER_INCLUDE,
        });
    }

    async update(companyId: string, id: string, updateUserDto: UpdateUserDto) {
        await this.findOne(companyId, id);
        const { password, departmentIds, departmentId, ...userData } = updateUserDto;
        const data: any = { ...userData };

        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        const deptIds = departmentIds ?? (departmentId ? [departmentId] : undefined);
        if (deptIds !== undefined) {
            data.departments = {
                deleteMany: {},
                create: deptIds.map((dId: string) => ({ departmentId: dId })),
            };
        }

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data,
            include: USER_INCLUDE,
        });

        return stripPassword(updatedUser);
    }

    async remove(companyId: string, id: string) {
        await this.findOne(companyId, id);
        await this.prisma.user.delete({ where: { id } });
        return { message: 'Usuário removido com sucesso' };
    }
}
