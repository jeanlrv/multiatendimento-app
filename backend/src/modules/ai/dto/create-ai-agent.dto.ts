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

    @ApiProperty({ description: 'Provedor de embedding (ex: openai, ollama, native)', required: false })
    @IsString()
    @IsOptional()
    embeddingProvider?: string;

    @ApiProperty({ description: 'Modelo de embedding', required: false })
    @IsString()
    @IsOptional()
    embeddingModel?: string;

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

    // --- Widget Embed Fields ---

    @ApiProperty({ description: 'Habilitar widget de chat', required: false })
    @IsBoolean()
    @IsOptional()
    embedEnabled?: boolean;

    @ApiProperty({ description: 'Cor da marca no widget', required: false })
    @IsString()
    @IsOptional()
    embedBrandColor?: string;

    @ApiProperty({ description: 'URL da logo no widget', required: false })
    @IsString()
    @IsOptional()
    embedBrandLogo?: string;

    @ApiProperty({ description: 'Nome do agente exibido no widget', required: false })
    @IsString()
    @IsOptional()
    embedAgentName?: string;

    @ApiProperty({ description: 'Mensagem de boas-vindas no widget', required: false })
    @IsString()
    @IsOptional()
    embedWelcomeMsg?: string;

    @ApiProperty({ description: 'Texto de ajuda no input do widget', required: false })
    @IsString()
    @IsOptional()
    embedPlaceholder?: string;

    @ApiProperty({ description: 'Posição do widget (bottom-right, bottom-left)', required: false })
    @IsString()
    @IsOptional()
    embedPosition?: string;

    @ApiProperty({ description: 'Domínios permitidos para o widget', required: false })
    @IsOptional()
    embedAllowedDomains?: string[];

    @ApiProperty({ description: 'Limite de mensagens por sessão (10min)', required: false })
    @IsOptional()
    embedRateLimit?: number;

    @ApiProperty({ description: 'Permite downgrade automático para queries simples', required: false })
    @IsBoolean()
    @IsOptional()
    allowModelDowngrade?: boolean;

    @ApiProperty({ description: 'Limite de tokens por dia para este agente (0 = ilimitado)', required: false })
    @IsNumber()
    @IsOptional()
    limitTokensPerDay?: number;
}
