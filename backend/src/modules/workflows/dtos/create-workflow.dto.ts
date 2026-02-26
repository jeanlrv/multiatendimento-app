import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class WorkflowTriggerDto {
    @ApiProperty({ example: 'ticket.created' })
    @IsString()
    @IsNotEmpty()
    event: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => WorkflowConditionDto)
    conditions?: WorkflowConditionDto[];
}

export class WorkflowConditionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    field: string;

    @ApiProperty({ example: '>' })
    @IsString()
    @IsNotEmpty()
    operator: string;

    @ApiProperty()
    @IsNotEmpty()
    value: any;
}

export class WorkflowActionDto {
    @ApiProperty({ example: 'send_message' })
    @IsString()
    @IsNotEmpty()
    type: string;

    @ApiProperty({ required: false })
    @IsOptional()
    params?: any;
}

export class CreateWorkflowDto {
    @ApiProperty({ example: 'Regra de Auto-Atendimento' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @ValidateNested()
    @Type(() => WorkflowTriggerDto)
    trigger: WorkflowTriggerDto;

    @ApiProperty({ type: [WorkflowActionDto], required: false })
    @ValidateNested({ each: true })
    @Type(() => WorkflowActionDto)
    @IsOptional()
    actions?: WorkflowActionDto[];

    @ApiProperty({ default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ default: 0 })
    @IsInt()
    @IsOptional()
    priority?: number;

    @ApiProperty({ enum: ['PRODUCTION', 'TEST'], default: 'PRODUCTION' })
    @IsEnum(['PRODUCTION', 'TEST'])
    @IsOptional()
    environment?: 'PRODUCTION' | 'TEST';

    // V2 Graph fields
    @ApiProperty({ required: false })
    @IsOptional()
    nodes?: any;

    @ApiProperty({ required: false })
    @IsOptional()
    edges?: any;
}
