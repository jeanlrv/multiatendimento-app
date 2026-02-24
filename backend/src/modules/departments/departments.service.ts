import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
    constructor(private prisma: PrismaService) { }

    async create(createDepartmentDto: CreateDepartmentDto, companyId: string) {
        const existingDepartment = await this.prisma.department.findUnique({
            where: {
                companyId_name: {
                    companyId,
                    name: createDepartmentDto.name,
                },
            },
        });

        if (existingDepartment) {
            throw new ConflictException('Já existe um departamento com este nome nesta empresa');
        }

        return this.prisma.department.create({
            data: {
                ...createDepartmentDto,
                companyId,
            },
        });
    }

    async findAll(companyId: string) {
        return this.prisma.department.findMany({
            where: { companyId },
            orderBy: [
                { displayOrder: 'asc' },
                { name: 'asc' }
            ],
        });
    }

    async findOne(id: string, companyId: string) {
        const department = await this.prisma.department.findUnique({
            where: { id, companyId },
        });

        if (!department) {
            throw new NotFoundException(`Departamento com ID ${id} não encontrado nesta empresa`);
        }

        return department;
    }

    async update(id: string, updateDepartmentDto: UpdateDepartmentDto, companyId: string) {
        await this.findOne(id, companyId);

        if (updateDepartmentDto.name) {
            const existingDepartment = await this.prisma.department.findUnique({
                where: {
                    companyId_name: {
                        companyId,
                        name: updateDepartmentDto.name,
                    },
                },
            });

            if (existingDepartment && existingDepartment.id !== id) {
                throw new ConflictException('Já existe um departamento com este nome nesta empresa');
            }
        }

        return this.prisma.department.update({
            where: { id },
            data: updateDepartmentDto,
        });
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);

        return this.prisma.department.delete({
            where: { id },
        });
    }

    async checkBusinessHours(departmentId: string): Promise<boolean> {
        const department = await this.prisma.department.findUnique({
            where: { id: departmentId },
            select: { businessHours: true, isActive: true }
        });

        if (!department || !department.isActive) return false;
        if (!department.businessHours) return true; // If no hours defined, assume always open

        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const schedule = (department.businessHours as any)[currentDay];

        if (!schedule || !schedule.active) return false; // Closed on this day

        return currentTime >= schedule.start && currentTime <= schedule.end;
    }
}
