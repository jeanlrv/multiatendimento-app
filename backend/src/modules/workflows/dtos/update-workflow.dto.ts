import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';

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
    trigger?: any;

    @IsOptional()
    actions?: any;

    // ===== V2 Graph fields =====

    @IsOptional()
    nodes?: any;

    @IsOptional()
    edges?: any;
}
