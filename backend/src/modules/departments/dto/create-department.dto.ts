import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsHexColor, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketMode } from '@prisma/client';

export class CreateDepartmentDto {
    @ApiProperty({ description: 'Nome do departamento' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Descrição do departamento', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Cor do departamento (HEX)', required: false, default: '#2563eb' })
    @IsHexColor()
    @IsOptional()
    color?: string;

    @ApiProperty({ description: 'Emoji do departamento', required: false, default: '💬' })
    @IsString()
    @IsOptional()
    emoji?: string;

    @ApiProperty({ description: 'Ordem de exibição', required: false, default: 0 })
    @IsNumber()
    @IsOptional()
    displayOrder?: number;

    @ApiProperty({ description: 'ID do Agente de IA padrão', required: false })
    @IsString()
    @IsOptional()
    aiAgentId?: string;

    @ApiProperty({ description: 'ID do Workflow padrão', required: false })
    @IsString()
    @IsOptional()
    workflowId?: string;

    @ApiProperty({ description: 'Modo padrão do ticket', enum: TicketMode, default: TicketMode.AI })
    @IsEnum(TicketMode)
    @IsOptional()
    defaultMode?: TicketMode;

    @ApiProperty({ description: 'SLA de primeira resposta (minutos)', required: false })
    @IsNumber()
    @IsOptional()
    slaFirstResponseMin?: number;

    @ApiProperty({ description: 'SLA de resolução (minutos)', required: false })
    @IsNumber()
    @IsOptional()
    slaResolutionMin?: number;

    @ApiProperty({ description: 'Horário de funcionamento (JSON)', required: false })
    @IsOptional()
    businessHours?: any;

    @ApiProperty({ description: 'Se deve distribuir tickets automaticamente', required: false, default: true })
    @IsBoolean()
    @IsOptional()
    autoDistribute?: boolean;

    @ApiProperty({ description: 'Se o departamento está ativo', required: false, default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
