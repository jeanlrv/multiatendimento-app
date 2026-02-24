import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PlanTier } from '@prisma/client';

export class UpdateCompanyDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    primaryColor?: string;

    @IsOptional()
    @IsString()
    secondaryColor?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    limitTokens?: number;

    @IsOptional()
    @IsEnum(PlanTier)
    plan?: PlanTier;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    maxUsers?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    maxDepartments?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    maxWhatsApp?: number;

    @IsOptional()
    @IsISO8601()
    expiresAt?: string;
}
