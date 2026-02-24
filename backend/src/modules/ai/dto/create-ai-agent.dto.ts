import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateAIAgentDto {
    @ApiProperty({ description: 'Nome do agente' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Descrição do agente', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'ID do Workspace no AnythingLLM' })
    @IsString()
    anythingllmWorkspaceId: string;

    @ApiProperty({ description: 'Configurações adicionais (JSON)', required: false })
    @IsObject()
    @IsOptional()
    configuration?: any;

    @ApiProperty({ description: 'Status do agente', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
