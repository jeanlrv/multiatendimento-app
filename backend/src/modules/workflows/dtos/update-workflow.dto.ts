import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpdateWorkflowDto {

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    priority?: number;

    // ===== V1 JSON fields =====

    @IsOptional()
    trigger?: Prisma.InputJsonValue;

    @IsOptional()
    actions?: Prisma.InputJsonValue;

    // ===== V2 Graph fields =====

    @IsOptional()
    nodes?: Prisma.InputJsonValue;

    @IsOptional()
    edges?: Prisma.InputJsonValue;
}
