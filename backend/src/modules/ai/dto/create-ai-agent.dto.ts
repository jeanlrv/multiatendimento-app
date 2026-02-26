import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject, IsNumber } from 'class-validator';

export class CreateAIAgentDto {
    @ApiProperty({ description: 'Nome do agente' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Descrição do agente', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'System prompt — define o comportamento do agente', required: false })
    @IsString()
    @IsOptional()
    prompt?: string;

    @ApiProperty({ description: 'ID do modelo de linguagem (ex: gpt-4o-mini, claude-3-5-sonnet, gemini-2.0-flash)', required: false })
    @IsString()
    @IsOptional()
    modelId?: string;

    @ApiProperty({ description: 'Temperatura (criatividade) do modelo, de 0 a 1', required: false })
    @IsNumber()
    @IsOptional()
    temperature?: number;

    @ApiProperty({ description: 'ID da base de conhecimento vinculada (RAG)', required: false })
    @IsString()
    @IsOptional()
    knowledgeBaseId?: string;

    @ApiProperty({ description: 'ID do Workspace no AnythingLLM (legado)', required: false })
    @IsString()
    @IsOptional()
    anythingllmWorkspaceId?: string;

    @ApiProperty({ description: 'Configurações adicionais (JSON)', required: false })
    @IsObject()
    @IsOptional()
    configuration?: any;

    @ApiProperty({ description: 'Status do agente', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
